#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
compare_full_db.py — Oracle BIST_NEWS tablosundaki TÜM kayıtları
sentiment_v4 ve entity_aware modelleriyle etiketleyip karşılaştır.

⚠️  DB'ye HİÇBİR ŞEY YAZILMAZ — sadece SELECT.
Çıktı: comparison_full_db.csv  (lokal)

Çalıştır:
  python compare_full_db.py
"""
import os
import sys
import textwrap
from pathlib import Path

import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = Path(__file__).resolve().parent
WALLET_DIR = str(Path(r"C:\Users\zehra\Masaüstü\evalonn\cloud_jobs\news_scraper\oracle_wallet"))

# ── Model Yolları ─────────────────────────────────────────────────────────────
OLD_MODEL_PATH = Path(r"C:\Users\zehra\Masaüstü\evalonn\model_train\sentiment_v4\final_model_dbmdz")
NEW_MODEL_PATH = HERE / "final_model_entity_aware"
OUT_CSV        = HERE / "comparison_full_db.csv"

# ── Oracle Bağlantı ───────────────────────────────────────────────────────────
DB_USER     = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN      = "evalondb_high"

BATCH_SIZE  = 64   # Inference batch boyutu


# ─────────────────────────────────────────────────────────────────────────────

def load_model(path):
    tok = AutoTokenizer.from_pretrained(str(path))
    mdl = AutoModelForSequenceClassification.from_pretrained(str(path))
    mdl.eval()
    if torch.cuda.is_available():
        mdl = mdl.cuda()
    return tok, mdl


def batch_predict_old(tok, mdl, texts, max_len=256):
    enc = tok(texts, truncation=True, padding=True,
               max_length=max_len, return_tensors="pt")
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    idxs  = torch.argmax(logits, dim=-1).cpu().tolist()
    confs = torch.softmax(logits, dim=-1).max(dim=-1).values.cpu().tolist()
    id2l  = mdl.config.id2label
    return [(id2l[i], round(c, 3)) for i, c in zip(idxs, confs)]


def batch_predict_new(tok, mdl, symbols, texts, max_len=256):
    enc = tok(text=symbols, text_pair=texts,
              truncation="only_second", padding=True,
              max_length=max_len, return_tensors="pt")
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    idxs  = torch.argmax(logits, dim=-1).cpu().tolist()
    confs = torch.softmax(logits, dim=-1).max(dim=-1).values.cpu().tolist()
    id2l  = mdl.config.id2label
    return [(id2l[i], round(c, 3)) for i, c in zip(idxs, confs)]


# ─────────────────────────────────────────────────────────────────────────────

def fetch_all_news():
    """Oracle'dan sadece SELECT — DB'ye hiçbir şey yazmaz."""
    import oracledb
    print("Oracle'a bağlanılıyor (READ-ONLY)...")
    conn = oracledb.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        dsn=DB_DSN,
        config_dir=WALLET_DIR,
        wallet_location=WALLET_DIR,
        wallet_password=DB_PASSWORD,
    )
    cursor = conn.cursor()
    # Mevcut SENTIMENT ile karşılaştırabilmek için çekiyoruz
    # CLOB ve VARCHAR2 karıştırılmaz — ayrı ayrı çek, Python'da birleştir
    cursor.execute("""
        SELECT ID, SYMBOL, TITLE,
               TO_CHAR(SUBSTR(CONTENT, 1, 3000)) AS CONTENT,
               SUMMARY,
               SENTIMENT
        FROM BIST_NEWS
        WHERE TITLE IS NOT NULL
        ORDER BY ID
    """)
    cols = [d[0] for d in cursor.description]
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    df = pd.DataFrame(rows, columns=cols)
    # Python'da öncelik: CONTENT > SUMMARY > TITLE
    df["TEXT_COL"] = df["CONTENT"].fillna(df["SUMMARY"]).fillna(df["TITLE"])
    df = df.drop(columns=["CONTENT", "SUMMARY"])
    print(f"  ✓ {len(df)} satır çekildi (DB'ye hiçbir şey yazılmadı)")
    return df


# ─────────────────────────────────────────────────────────────────────────────

def run_inference(df, old_tok, old_mdl, new_tok, new_mdl):
    old_preds, old_confs = [], []
    new_preds, new_confs = [], []

    symbols = df["SYMBOL"].fillna("").astype(str).tolist()
    texts   = df["TEXT_COL"].fillna("").astype(str).tolist()
    n = len(df)

    for start in range(0, n, BATCH_SIZE):
        end     = min(start + BATCH_SIZE, n)
        s_batch = symbols[start:end]
        t_batch = texts[start:end]

        o_res = batch_predict_old(old_tok, old_mdl, t_batch)
        n_res = batch_predict_new(new_tok, new_mdl, s_batch, t_batch)

        for (op, oc), (np_, nc) in zip(o_res, n_res):
            old_preds.append(op); old_confs.append(oc)
            new_preds.append(np_); new_confs.append(nc)

        done = end
        if done % 1000 == 0 or done == n:
            print(f"  {done}/{n} satır işlendi...", flush=True)

    df = df.copy()
    df["old_pred"] = old_preds
    df["old_conf"] = old_confs
    df["new_pred"] = new_preds
    df["new_conf"] = new_confs
    df["models_agree"] = df["old_pred"] == df["new_pred"]
    df["changed"]      = ~df["models_agree"]
    return df


# ─────────────────────────────────────────────────────────────────────────────

def print_report(df):
    print("\n" + "="*65)
    print("GENEL İSTATİSTİKLER")
    print("="*65)
    print(f"  Toplam kayıt  : {len(df)}")
    agree_pct = df["models_agree"].mean() * 100
    print(f"  İki model aynı fikir : {df['models_agree'].sum()} ({agree_pct:.1f}%)")
    print(f"  Farklı tahmin        : {df['changed'].sum()} ({100-agree_pct:.1f}%)")

    # Mevcut DB sentiment dağılımı
    print("\n--- Mevcut DB SENTIMENT dağılımı ---")
    print(df["SENTIMENT"].value_counts().to_string())

    # Her modelin dağılımı
    print("\n--- Eski model (sentiment_v4) dağılımı ---")
    print(df["old_pred"].value_counts().to_string())

    print("\n--- Yeni model (entity_aware) dağılımı ---")
    print(df["new_pred"].value_counts().to_string())

    # Sadece etiketli olanlarla karşılaştır (BEKLIYOR / NULL değil)
    labeled = df[df["SENTIMENT"].isin(["NÖTR", "OLUMLU", "OLUMSUZ", "NOTR"])]
    labeled = labeled.copy()
    labeled["SENTIMENT"] = labeled["SENTIMENT"].replace("NOTR", "NÖTR")

    if len(labeled) > 0:
        print(f"\n--- DB'de etiketli kayıtlar üzerinde doğruluk ({len(labeled)} adet) ---")
        old_acc = (labeled["old_pred"] == labeled["SENTIMENT"]).mean()
        new_acc = (labeled["new_pred"] == labeled["SENTIMENT"]).mean()
        print(f"  Eski model accuracy : {old_acc:.3f}")
        print(f"  Yeni model accuracy : {new_acc:.3f}")

        print("\n  Sınıf bazlı:")
        for lbl in ["OLUMLU", "OLUMSUZ", "NÖTR"]:
            sub = labeled[labeled["SENTIMENT"] == lbl]
            if len(sub) == 0: continue
            o = (sub["old_pred"] == lbl).mean()
            n = (sub["new_pred"] == lbl).mean()
            print(f"    {lbl:8s}  eski={o:.3f}  yeni={n:.3f}  (n={len(sub)})")

    # ── Multi-ticker analizi ─────────────────────────────────────────────────
    # "Multi-ticker" = aynı haber birden fazla sembol için kayıtlı (TITLE aynı, SYMBOL farklı)
    dupe_titles = df[df.duplicated(subset=["TITLE"], keep=False)].copy()
    multi_news  = dupe_titles.groupby("TITLE").filter(lambda g: g["SYMBOL"].nunique() > 1)

    print("\n" + "="*65)
    print("MULTI-TICKER HABERLER (aynı haber, birden fazla sembol)")
    print("="*65)
    print(f"  Satır sayısı : {len(multi_news)}")
    unique_titles = multi_news["TITLE"].nunique()
    print(f"  Benzersiz haber başlığı : {unique_titles}")

    # İki modelin farklı tahmin ettiği multi-ticker kayıtlar
    diff_multi = multi_news[multi_news["changed"] == True]
    print(f"  Modellerin farklı tahmin ettiği : {len(diff_multi)} satır")

    if len(diff_multi) > 0:
        print("\n  --- İlk 10 örnek (farklı tahmin edilen multi-ticker) ---")
        # Başlık bazında grupla — her başlıktan bir kez göster
        shown = set()
        count = 0
        for _, r in diff_multi.iterrows():
            if count >= 10: break
            key = r["TITLE"]
            if key in shown: continue
            shown.add(key)
            # Aynı başlıktaki tüm semboller
            same = multi_news[multi_news["TITLE"] == key]
            syms = ", ".join(sorted(same["SYMBOL"].unique()))
            print(f"\n  [{count+1}] {textwrap.shorten(key, 80)}")
            print(f"       Semboller : {syms}")
            for _, row in same.iterrows():
                print(f"       {row['SYMBOL']:10s}  eski={row['old_pred']} ({row['old_conf']:.2f})  "
                      f"yeni={row['new_pred']} ({row['new_conf']:.2f})  "
                      f"DB={row['SENTIMENT']}")
            count += 1

    # Yeni modelin DB'deki BEKLIYOR'ları nasıl etiketlediği
    bekliyor = df[df["SENTIMENT"] == "BEKLIYOR"]
    if len(bekliyor) > 0:
        print("\n" + "="*65)
        print(f"BEKLIYOR (henüz etiketlenmemiş) — {len(bekliyor)} kayıt")
        print("="*65)
        print("  Eski model dağılımı:")
        print(bekliyor["old_pred"].value_counts().to_string())
        print("  Yeni model dağılımı:")
        print(bekliyor["new_pred"].value_counts().to_string())

    # Kazanç / kayıp vs DB etiketi
    if len(labeled) > 0:
        new_wins  = labeled[(labeled["new_pred"] == labeled["SENTIMENT"]) &
                            (labeled["old_pred"] != labeled["SENTIMENT"])]
        new_loses = labeled[(labeled["new_pred"] != labeled["SENTIMENT"]) &
                            (labeled["old_pred"] == labeled["SENTIMENT"])]
        print(f"\n  Yeni model kazandı  (eski yanlış → yeni doğru) : {len(new_wins)}")
        print(f"  Yeni model kaybetti (eski doğru → yeni yanlış) : {len(new_loses)}")

    print(f"\nTüm sonuçlar kaydedildi: {OUT_CSV}")
    print("(DB'ye hiçbir şey yazılmadı)")


# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("Modeller yükleniyor...")
    old_tok, old_mdl = load_model(OLD_MODEL_PATH)
    new_tok, new_mdl = load_model(NEW_MODEL_PATH)
    print("  ✓ Eski: sentiment_v4/final_model_dbmdz")
    print("  ✓ Yeni: final_model_entity_aware")

    df = fetch_all_news()

    print(f"\nInference başlıyor — {len(df)} satır, batch={BATCH_SIZE}...")
    df = run_inference(df, old_tok, old_mdl, new_tok, new_mdl)

    df.to_csv(OUT_CSV, index=False)
    print_report(df)


if __name__ == "__main__":
    main()
