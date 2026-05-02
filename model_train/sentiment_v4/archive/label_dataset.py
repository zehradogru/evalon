#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/label_dataset.py

Scraper CSV'sindeki haberleri BERT v3 + Ollama hibrit yaklaşımıyla etiketler.
Çıktı: model_train/data.csv formatında (pipe-separated, text|sentiment).

STRATEJİ:
  1. BERT v3 ile tüm haberleri hızlıca etiketle
  2. Güven skoru < eşik olanları Ollama dolphin-llama3 ile yeniden etiketle
  3. İkisi anlaşamazsa Ollama'nın kararına güven (daha bağlamsal)

SÜRE TAHMİNİ (6000 haber, CPU):
  --bert-only : ~8-12 dakika
  --hybrid    : ~40-60 dakika (önerilen, kalite çok daha yüksek)

KULLANIM:
  # Önerilen (hibrit):
  python label_dataset.py

  # Sadece BERT (hızlı ama daha az hassas):
  python label_dataset.py --bert-only

  # Test için ilk 100 satır:
  python label_dataset.py --limit 100

  # BERT eşiğini artır (%90 güven altındakileri Ollama'ya gönder):
  python label_dataset.py --confidence 0.90
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

# model_train dizinini Python path'e ekle
HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

from model_utils import build_news_text, load_sentiment_pipeline, score_texts

# ── Sabit yollar ──────────────────────────────────────────────────────────────
DEFAULT_INPUT = HERE / "train_unlabeled.csv"
DEFAULT_OUTPUT = HERE / "labeled_news.csv"
BERT_MODEL_DIR = MODEL_TRAIN_DIR / "bist_bert_model_v3"

# BERT max_length=256 token → Türkçe'de ~600-800 karakter yeterli
# title + summary + content[:600] ≈ 200 token, limit içinde kalır
CONTENT_CHAR_LIMIT = 600

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "dolphin-llama3"  # deepseek-r1 reasoning=çok yavaş, dolphin yeterli


# ── Argümanlar ────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="BIST haber sentiment etiketleyici (BERT v3 + Ollama hibrit)")
    p.add_argument("--input", default=str(DEFAULT_INPUT), help="Kaynak CSV (scraper çıktısı)")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Çıktı CSV (text|sentiment formatı)")
    p.add_argument(
        "--confidence",
        type=float,
        default=0.85,
        help="BERT güven eşiği (0-1). Altındakiler Ollama'ya gider. Varsayılan: 0.85",
    )
    p.add_argument("--bert-only", action="store_true", help="Sadece BERT kullan (~8-12 dk, daha hızlı)")
    p.add_argument("--limit", type=int, default=0, help="Test için ilk N satırı işle (0=hepsi)")
    p.add_argument("--batch-size", type=int, default=16, help="BERT batch büyüklüğü")
    return p.parse_args()


# ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
def build_text(row: pd.Series) -> str:
    """title + summary + content[:600] → BERT için optimal metin."""
    return build_news_text(
        row.get("title", ""),
        row.get("summary", ""),
        row.get("content", ""),
        content_char_limit=CONTENT_CHAR_LIMIT,
    )


def ollama_label(text: str) -> str:
    """Ollama dolphin-llama3 ile tek bir metni etiketle."""
    prompt = (
        "Sen bir Borsa İstanbul (BIST) finans analistisin.\n"
        "Aşağıdaki haberin hisse senedi fiyatına etkisini analiz et.\n"
        "Sadece şu 3 kelimeden BİRİNİ yaz: OLUMLU, OLUMSUZ, NÖTR\n"
        "Açıklama yapma. Sadece tek kelime.\n\n"
        f"Haber:\n{text[:800]}\n\n"
        "Cevap:"
    )
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=45,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip().upper()
        # İlk kelimeyi al, noktalama temizle
        word = raw.split()[0].replace(".", "").replace(",", "").replace(":", "") if raw else ""
        if word in ("OLUMLU", "OLUMSUZ", "NÖTR"):
            return word
        # Türkçe karakter varyantları
        if "OLUMLU" in raw:
            return "OLUMLU"
        if "OLUMSUZ" in raw:
            return "OLUMSUZ"
        return "NÖTR"
    except requests.exceptions.ConnectionError:
        print("  [UYARI] Ollama bağlantısı kurulamadı. Ollama çalışıyor mu? (ollama serve)")
        return None
    except Exception as e:
        print(f"  [Ollama hata]: {e}")
        return None


# ── Ana fonksiyon ─────────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"HATA: Kaynak dosya bulunamadı: {input_path}")
        sys.exit(1)

    print("=" * 60)
    print("BIST Sentiment Etiketleyici — BERT v3 + Ollama Hibrit")
    print("=" * 60)
    print(f"Kaynak  : {input_path}")
    print(f"Çıktı   : {output_path}")
    print(f"Mod     : {'BERT-only' if args.bert_only else f'Hibrit (BERT≥{args.confidence} + Ollama)'}")
    print()

    # CSV oku
    df = pd.read_csv(input_path)
    if args.limit > 0:
        df = df.head(args.limit)
        print(f"[TEST MODU] İlk {args.limit} satır işlenecek.")
    print(f"Toplam haber: {len(df)}\n")

    # Metinleri oluştur
    print("Metinler hazırlanıyor...")
    texts = [build_text(row) for _, row in df.iterrows()]
    empty_count = sum(1 for t in texts if not t.strip())
    if empty_count:
        print(f"  Uyarı: {empty_count} satırda metin boş (title+summary+content hepsi boş)")

    # ── STAGE 1: BERT v3 ──────────────────────────────────────────────────────
    print(f"\n[1/2] BERT v3 etiketleniyor (batch={args.batch_size})...")
    t0 = time.time()
    classifier = load_sentiment_pipeline(BERT_MODEL_DIR)
    raw_results = score_texts(classifier, texts, batch_size=args.batch_size)
    bert_time = time.time() - t0

    final_labels: list[str | None] = []
    low_conf_indices: list[int] = []

    for i, result in enumerate(raw_results):
        label = result["label"]   # Doğrudan "OLUMLU"/"OLUMSUZ"/"NÖTR" — config.json'dan gelir
        score = result["score"]

        if not texts[i].strip():
            # Boş metin — NÖTR olarak işaretle
            final_labels.append("NÖTR")
        elif score >= args.confidence or args.bert_only:
            final_labels.append(label)
        else:
            final_labels.append(None)   # Ollama'ya gidecek
            low_conf_indices.append(i)

    bert_kept = sum(1 for l in final_labels if l is not None)
    print(f"  BERT ile kesinleşti : {bert_kept:>5} / {len(texts)}  ({bert_kept/len(texts)*100:.1f}%)")
    print(f"  Ollama'ya gidecek   : {len(low_conf_indices):>5}")
    print(f"  BERT süresi         : {bert_time:.1f}s")

    # ── STAGE 2: Ollama ───────────────────────────────────────────────────────
    ollama_failed = 0
    if low_conf_indices and not args.bert_only:
        print(f"\n[2/2] Ollama ({OLLAMA_MODEL}) ile {len(low_conf_indices)} düşük-güven satır etiketleniyor...")
        print(f"  Tahmini süre: ~{len(low_conf_indices) * 1.5 / 60:.1f} dakika\n")
        t1 = time.time()

        for progress, i in enumerate(low_conf_indices):
            if progress % 100 == 0:
                elapsed = time.time() - t1
                rate = (progress / elapsed) if elapsed > 0 and progress > 0 else 0
                remaining = ((len(low_conf_indices) - progress) / rate / 60) if rate > 0 else "?"
                print(f"  {progress}/{len(low_conf_indices)} — "
                      f"geçen: {elapsed:.0f}s — kalan: ~{remaining:.1f}dk")

            label = ollama_label(texts[i])
            if label is None:
                # Ollama çalışmıyor — BERT sonucunu fallback olarak kullan
                label = raw_results[i]["label"]
                ollama_failed += 1
            final_labels[i] = label

        ollama_time = time.time() - t1
        print(f"\n  Ollama tamamlandı: {time.time() - t1:.1f}s")
        if ollama_failed:
            print(f"  Uyarı: {ollama_failed} satır Ollama hatası, BERT fallback kullanıldı.")
    elif args.bert_only:
        print("\n[2/2] BERT-only mod — Ollama atlandı.")

    # ── Sonuçları kaydet ──────────────────────────────────────────────────────
    valid_mask = [bool(t.strip()) and l is not None for t, l in zip(texts, final_labels)]
    out_texts = [texts[i] for i in range(len(texts)) if valid_mask[i]]
    out_labels = [final_labels[i] for i in range(len(texts)) if valid_mask[i]]

    out_df = pd.DataFrame({"text": out_texts, "sentiment": out_labels})

    # data.csv ile aynı format: pipe-separated, başlık satırı yok
    out_df.to_csv(output_path, sep="|", index=False, header=False, encoding="utf-8")

    # ── Özet ──────────────────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"Toplam etiketlendi : {len(out_df)}")
    print(f"\nDağılım:")
    for label, count in out_df["sentiment"].value_counts().items():
        print(f"  {label:<10}: {count:>5} ({count/len(out_df)*100:.1f}%)")
    print(f"\nDosya kaydedildi: {output_path}")
    print(
        "\nSONRAKİ ADIMLAR:\n"
        "  1. Çıktıyı gözden geçir: head labeled_news.csv\n"
        "  2. model_train/data.csv ile birleştir (build_combined_dataset.py)\n"
        "  3. python ../train_local.py ile BERT v4'ü eğit\n"
        "  4. Eğitim bittikten sonra DB etiketleme: label_oracle_db.py"
    )


if __name__ == "__main__":
    main()
