#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
label_all_news.py  --  Oracle BIST_NEWS tablosundaki tum haberleri
                       dbmdz BERT modeli ile etiketler.

Akis:
  1. SENTIMENT = 'BEKLIYOR' olan haberleri batch batch ceker (TITLE + SUMMARY)
  2. Her batch'i GPU/CPU uzerinde BERT ile tahminler
  3. UPDATE ile SENTIMENT + SENTIMENT_SCORE kolonlarini gunceller
  4. Ilerlemeyi terminal'e basar, hata olursa kaldigi yerden devam eder

Kullanim:
  cd scrapers/news_scraper
  python label_all_news.py                  # varsayilan: batch=64
  python label_all_news.py --batch-size 128 # daha hizli (GPU varsa)
  python label_all_news.py --dry-run        # DB'ye yazmadan test et
  python label_all_news.py --all            # BEKLIYOR + zaten etiketlenmis HEPSINI yeniden etiketle
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import oracledb
import torch
from dotenv import load_dotenv
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# -- Sabitler ------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE.parent.parent / "model_train" / "sentiment_v4" / "final_model_dbmdz"

ID2LABEL = {0: "NOTR", 1: "OLUMLU", 2: "OLUMSUZ"}
LABEL2ID = {v: k for k, v in ID2LABEL.items()}

# DB sentiment degerleri (Turkce karakter iceren asil degerler)
ID2LABEL_DB = {0: "N\u00d6TR", 1: "OLUMLU", 2: "OLUMSUZ"}

# DB'den her seferde cekilecek satir sayisi
DB_FETCH_SIZE = 500


# -- Oracle Baglantisi ---------------------------------------------------------
def get_connection() -> oracledb.Connection:
    """news_scraper/.env dosyasindan Oracle baglantisi kurar."""
    env_path = HERE / ".env"
    load_dotenv(env_path)

    user = os.environ["ORACLE_DB_USER"]
    password = os.environ["ORACLE_DB_PASSWORD"]
    dsn = os.environ["ORACLE_DB_DSN"]
    raw_wallet = os.environ.get("ORACLE_WALLET_DIR", "oracle_wallet")

    # Wallet yolunu coz
    wallet_dir = str((HERE / raw_wallet).resolve())
    if not os.path.isdir(wallet_dir):
        wallet_dir = str(HERE / "oracle_wallet")
    if not os.path.isdir(wallet_dir):
        sys.exit(f"[HATA] Wallet dizini bulunamadi: {wallet_dir}")

    print(f"[*] Oracle'a baglaniliyor... (user={user}, dsn={dsn})")
    conn = oracledb.connect(
        user=user,
        password=password,
        dsn=dsn,
        config_dir=wallet_dir,
        wallet_location=wallet_dir,
        wallet_password=password,
    )
    print("[OK] Baglanti basarili!")
    return conn


# -- Model Yukleme -------------------------------------------------------------
def load_model(device: str):
    """fine-tuned dbmdz modelini ve tokenizer'ini yukler."""
    if not MODEL_DIR.exists():
        sys.exit(f"[HATA] Model dizini bulunamadi: {MODEL_DIR}")

    print(f"[*] Model yukleniyor: {MODEL_DIR.name}")
    print(f"    Device: {device}")

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.to(device)
    model.eval()

    print("[OK] Model hazir!")
    return model, tokenizer


# -- Tahmin --------------------------------------------------------------------
@torch.no_grad()
def predict_batch(
    texts: list[str],
    model,
    tokenizer,
    device: str,
    max_length: int = 128,
) -> list[tuple[str, float]]:
    """
    Bir batch metin alir, (label, score) listesi doner.
    Score = softmax olasiligi (0-1).
    """
    # Bos metinleri filtrele
    clean_texts = [t if t.strip() else "bos" for t in texts]

    encodings = tokenizer(
        clean_texts,
        truncation=True,
        padding=True,
        max_length=max_length,
        return_tensors="pt",
    )
    encodings = {k: v.to(device) for k, v in encodings.items()}

    outputs = model(**encodings)
    probs = torch.softmax(outputs.logits, dim=-1)
    scores, preds = probs.max(dim=-1)

    results = []
    for pred_id, score in zip(preds.cpu().tolist(), scores.cpu().tolist()):
        label_db = ID2LABEL_DB[pred_id]
        results.append((label_db, round(score, 4)))
    return results


# -- Ana Akis ------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="BIST_NEWS tablosunu BERT ile etiketle")
    parser.add_argument("--batch-size", type=int, default=64, help="Model inference batch boyutu")
    parser.add_argument("--max-length", type=int, default=128, help="Token max uzunluk")
    parser.add_argument("--dry-run", action="store_true", help="DB'ye yazmadan sadece tahmin et")
    parser.add_argument("--all", action="store_true", help="Sadece BEKLIYOR degil, TUM haberleri yeniden etiketle")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, tokenizer = load_model(device)

    conn = get_connection()
    cur_read = conn.cursor()
    cur_write = conn.cursor()

    # -- Kac haber etiketlenecek? -----------------------------------------------
    if args.all:
        count_sql = "SELECT COUNT(*) FROM BIST_NEWS"
        select_sql = """
            SELECT ID, TITLE, SUMMARY
            FROM BIST_NEWS
            ORDER BY ID
        """
        mode_desc = "TUM haberler (yeniden etiketleme)"
    else:
        count_sql = "SELECT COUNT(*) FROM BIST_NEWS WHERE SENTIMENT = 'BEKLIYOR'"
        select_sql = """
            SELECT ID, TITLE, SUMMARY
            FROM BIST_NEWS
            WHERE SENTIMENT = 'BEKLIYOR'
            ORDER BY ID
        """
        mode_desc = "Sadece BEKLIYOR olanlar"

    cur_read.execute(count_sql)
    total = cur_read.fetchone()[0]
    print(f"\n{'='*60}")
    print(f"[INFO] Etiketlenecek haber sayisi: {total}")
    print(f"   Mod: {mode_desc}")
    print(f"   Batch: {args.batch_size}  |  Max-Length: {args.max_length}  |  Dry-Run: {args.dry_run}")
    print(f"{'='*60}\n")

    if total == 0:
        print("[OK] Etiketlenecek haber yok, cikiliyor.")
        cur_read.close()
        cur_write.close()
        conn.close()
        return

    # -- UPDATE sorgusu ---------------------------------------------------------
    update_sql = """
        UPDATE BIST_NEWS
        SET SENTIMENT = :1,
            SENTIMENT_SCORE = :2
        WHERE ID = :3
    """

    # -- Haberleri batch batch cek ve etiketle ----------------------------------
    cur_read.execute(select_sql)
    cur_read.arraysize = DB_FETCH_SIZE

    labeled_count = 0
    batch_ids = []
    batch_texts = []
    start_time = time.time()

    while True:
        rows = cur_read.fetchmany(DB_FETCH_SIZE)
        if not rows:
            break

        for row_id, title, summary in rows:
            # TITLE + SUMMARY birlestir (bos olabilir)
            title = str(title or "").strip()
            summary = str(summary or "").strip()

            if summary and summary != title:
                text = f"{title} {summary}"
            else:
                text = title

            batch_ids.append(row_id)
            batch_texts.append(text if text else "")

            # Batch doldugunda inference yap
            if len(batch_texts) >= args.batch_size:
                predictions = predict_batch(batch_texts, model, tokenizer, device, args.max_length)

                if not args.dry_run:
                    update_data = [
                        (pred[0], pred[1], rid)
                        for rid, pred in zip(batch_ids, predictions)
                    ]
                    cur_write.executemany(update_sql, update_data)
                    conn.commit()

                labeled_count += len(batch_texts)
                elapsed = time.time() - start_time
                speed = labeled_count / elapsed if elapsed > 0 else 0
                eta = (total - labeled_count) / speed if speed > 0 else 0

                # Ilerleme bilgisi (ASCII-safe)
                snippet = batch_texts[0][:50].encode("ascii", "replace").decode()
                print(
                    f"  [+] {labeled_count:>6}/{total}  "
                    f"({labeled_count/total*100:5.1f}%)  "
                    f"| {speed:.0f} haber/sn  "
                    f"| ETA: {eta:.0f}sn  "
                    f"| Son: {snippet}..."
                )

                batch_ids = []
                batch_texts = []

    # Kalan kusuratu isle
    if batch_texts:
        predictions = predict_batch(batch_texts, model, tokenizer, device, args.max_length)

        if not args.dry_run:
            update_data = [
                (pred[0], pred[1], rid)
                for rid, pred in zip(batch_ids, predictions)
            ]
            cur_write.executemany(update_sql, update_data)
            conn.commit()

        labeled_count += len(batch_texts)

    elapsed = time.time() - start_time

    # -- Ozet -------------------------------------------------------------------
    print(f"\n{'='*60}")
    print(f"[BITTI] Etiketleme tamamlandi!")
    print(f"   Toplam: {labeled_count} haber")
    print(f"   Sure : {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    if labeled_count > 0:
        print(f"   Hiz  : {labeled_count/elapsed:.0f} haber/saniye")
    if args.dry_run:
        print(f"   [!] DRY-RUN modu -- DB guncellenmedi!")
    print(f"{'='*60}")

    # -- Etiket dagilimini goster -----------------------------------------------
    if not args.dry_run:
        print("\n[INFO] Guncel BIST_NEWS duygu dagilimi:")
        cur_read2 = conn.cursor()
        cur_read2.execute("""
            SELECT SENTIMENT, COUNT(*) as CNT
            FROM BIST_NEWS
            GROUP BY SENTIMENT
            ORDER BY CNT DESC
        """)
        total_all = 0
        rows_dist = cur_read2.fetchall()
        for _, cnt in rows_dist:
            total_all += cnt
        for sentiment, cnt in rows_dist:
            pct = cnt / total_all * 100 if total_all > 0 else 0
            bar = "#" * int(pct / 2)
            print(f"   {str(sentiment):<10} {cnt:>6}  ({pct:5.1f}%)  {bar}")
        cur_read2.close()

    cur_read.close()
    cur_write.close()
    conn.close()


if __name__ == "__main__":
    main()
