#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
label_bekliyor_db.py — Oracle BIST_NEWS tablosundaki BEKLIYOR kayıtları
sentiment_v4 (final_model_dbmdz) modeli ile etiketleyip DB'ye yazar.

Sadece SENTIMENT = 'BEKLIYOR' olan satırlar güncellenir.
Mevcut OLUMLU / OLUMSUZ / NÖTR etiketlerine kesinlikle dokunulmaz.

Çalıştır:
  python label_bekliyor_db.py

GPU varsa otomatik kullanılır.
"""
import os
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# ── Yollar ────────────────────────────────────────────────────────────────────
HERE        = Path(__file__).resolve().parent
MODEL_PATH  = HERE / "final_model_dbmdz"
WALLET_DIR  = str(Path(r"C:\Users\zehra\Masaüstü\evalonn\cloud_jobs\news_scraper\oracle_wallet"))

# ── Oracle Bağlantı ───────────────────────────────────────────────────────────
DB_USER     = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN      = "evalondb_high"

BATCH_SIZE  = 128   # GPU varken daha büyük batch


# ─────────────────────────────────────────────────────────────────────────────

def load_model():
    print(f"Model yükleniyor: {MODEL_PATH}")
    tok = AutoTokenizer.from_pretrained(str(MODEL_PATH))
    mdl = AutoModelForSequenceClassification.from_pretrained(str(MODEL_PATH))
    mdl.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    mdl = mdl.to(device)
    print(f"  ✓ Model yüklendi | device={device} | labels={mdl.config.id2label}")
    return tok, mdl, device


def batch_predict(tok, mdl, device, texts, max_len=256):
    enc = tok(
        texts,
        truncation=True,
        padding=True,
        max_length=max_len,
        return_tensors="pt",
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    idxs  = torch.argmax(logits, dim=-1).cpu().tolist()
    confs = torch.softmax(logits, dim=-1).max(dim=-1).values.cpu().tolist()
    id2l  = mdl.config.id2label
    return [(id2l[i], round(c, 4)) for i, c in zip(idxs, confs)]


def fetch_bekliyor(cursor):
    """Sadece BEKLIYOR olan kayıtları çek — READ."""
    cursor.execute("""
        SELECT ID, SYMBOL, TITLE,
               TO_CHAR(SUBSTR(CONTENT, 1, 3000)) AS CONTENT,
               SUMMARY
        FROM BIST_NEWS
        WHERE SENTIMENT = 'BEKLIYOR'
        ORDER BY ID
    """)
    cols = [d[0] for d in cursor.description]
    rows = cursor.fetchall()
    print(f"  ✓ {len(rows)} BEKLIYOR kayıt çekildi")
    return cols, rows


def make_text(row_dict):
    """CONTENT > SUMMARY > TITLE önceliğiyle metin üret."""
    content = (row_dict.get("CONTENT") or "").strip()
    summary = (row_dict.get("SUMMARY") or "").strip()
    title   = (row_dict.get("TITLE")   or "").strip()
    return content or summary or title


def run(dry_run=False):
    import oracledb

    tok, mdl, device = load_model()

    print("\nOracle'a bağlanılıyor...")
    conn = oracledb.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        dsn=DB_DSN,
        config_dir=WALLET_DIR,
        wallet_location=WALLET_DIR,
        wallet_password=DB_PASSWORD,
    )
    cursor = conn.cursor()

    cols, rows = fetch_bekliyor(cursor)

    if not rows:
        print("Güncellenecek BEKLIYOR kayıt yok. Çıkılıyor.")
        cursor.close()
        conn.close()
        return

    col_idx = {c: i for i, c in enumerate(cols)}

    # Metinleri oluştur
    records = []
    for row in rows:
        row_dict = {c: row[col_idx[c]] for c in cols}
        text = make_text(row_dict)
        records.append((row_dict["ID"], text))

    ids   = [r[0] for r in records]
    texts = [r[1] for r in records]

    print(f"\nInference başlıyor — {len(texts)} kayıt, batch={BATCH_SIZE}, device={device}...")
    all_results = []
    for start in range(0, len(texts), BATCH_SIZE):
        end    = min(start + BATCH_SIZE, len(texts))
        batch  = texts[start:end]
        res    = batch_predict(tok, mdl, device, batch)
        all_results.extend(res)
        done = end
        if done % 500 == 0 or done == len(texts):
            print(f"  {done}/{len(texts)} tahmin tamamlandı...", flush=True)

    # Dağılım özeti
    from collections import Counter
    dist = Counter(label for label, _ in all_results)
    print(f"\nTahmin dağılımı: {dict(dist)}")

    if dry_run:
        print("\n[DRY RUN] DB'ye yazılmadı. dry_run=False ile tekrar çalıştır.")
        for i, (rid, (label, conf)) in enumerate(zip(ids, all_results)):
            print(f"  ID={rid}  →  {label} ({conf:.3f})")
            if i >= 9:
                print(f"  ... ve {len(ids)-10} kayıt daha")
                break
        cursor.close()
        conn.close()
        return

    # ── DB'ye yaz ─────────────────────────────────────────────────────────────
    print(f"\n{len(ids)} kayıt DB'ye yazılıyor (sadece BEKLIYOR olanlar güncelleniyor)...")

    update_sql = """
        UPDATE BIST_NEWS
        SET SENTIMENT = :sentiment
        WHERE ID = :id
          AND SENTIMENT = 'BEKLIYOR'
    """

    batch_data = [
        {"sentiment": label, "id": rid}
        for rid, (label, _) in zip(ids, all_results)
    ]

    # Toplu update — 500'lük bloklar halinde commit
    total_updated = 0
    for start in range(0, len(batch_data), 500):
        chunk = batch_data[start:start+500]
        cursor.executemany(update_sql, chunk)
        conn.commit()
        total_updated += len(chunk)
        print(f"  {total_updated}/{len(batch_data)} satır güncellendi ve commit edildi...")

    print(f"\n✅ Tamamlandı! {total_updated} BEKLIYOR kayıt etiketlendi ve DB'ye yazıldı.")
    print(f"   Dağılım: {dict(dist)}")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    if dry:
        print("=== DRY RUN MODU (DB'ye yazılmaz) ===\n")
    run(dry_run=dry)
