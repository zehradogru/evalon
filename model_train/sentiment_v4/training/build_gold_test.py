#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/build_gold_test.py  —  Faz 2: Gold Test Set Oluşturma

test_clean.csv (Faz 0 çıktısı, ~330 satır) üzerine aynı 3-model konsensüsünü
uygular. Sadece 3/3 anlaşılan satırlar gold_test.csv'ye girer.

Bu dosya ASLA training pipeline'ına girmez.
%95 hedefinin ölçüldüğü ground-truth'tur.

ÇIKTI:
  gold_test.csv         — 3/3 konsensüs (güvenilir, ~170-220 satır beklenir)
  gold_test_2of3.csv    — 2/3 konsensüs (yedek, gold küçükse kullanılabilir)

KULLANIM:
  python build_gold_test.py
  python build_gold_test.py --bert-only   # Hızlı kontrol (düşük kalite)
  python build_gold_test.py --use-2of3    # gold'a 2/3'leri de ekle
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

from model_utils import load_sentiment_pipeline, score_texts

BERT_MODEL_DIR = MODEL_TRAIN_DIR / "bist_bert_model_v3"
INPUT_DEFAULT = HERE / "test_clean.csv"
OUTPUT_GOLD = HERE / "gold_test.csv"
OUTPUT_2OF3 = HERE / "gold_test_2of3.csv"

OLLAMA_URL = "http://localhost:11434/api/generate"
LABEL_MAP = {"OLUMLU", "OLUMSUZ", "NÖTR"}

PROMPT = (
    "Sen bir Borsa İstanbul (BIST) finans analistisin.\n"
    "Aşağıdaki haber, bir Türk şirketinin hisse senedi fiyatına nasıl etki eder?\n"
    "Yalnızca şu 3 kelimeden BİRİNİ yaz: OLUMLU, OLUMSUZ, NÖTR\n"
    "Açıklama yapma. Sadece tek kelime.\n\n"
    "Haber:\n{text}\n\n"
    "Cevap:"
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--input", default=str(INPUT_DEFAULT))
    p.add_argument("--bert-only", action="store_true")
    p.add_argument("--use-2of3", action="store_true", help="2/3 anlaşmaları da gold_test'e ekle")
    p.add_argument("--batch-size", type=int, default=16)
    return p.parse_args()


def ollama_label(text: str, model: str) -> str | None:
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": model, "prompt": PROMPT.format(text=text[:900]), "stream": False},
            timeout=60,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip().upper()
        first = raw.split()[0].rstrip(".,;:") if raw.split() else ""
        if first in LABEL_MAP:
            return first
        for lbl in LABEL_MAP:
            if lbl in raw:
                return lbl
        return "NÖTR"
    except Exception:
        return None


def check_ollama(model: str) -> bool:
    try:
        r = requests.post(OLLAMA_URL, json={"model": model, "prompt": "test", "stream": False}, timeout=90)
        return r.status_code == 200
    except Exception:
        return False


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadı. Önce prepare_data.py çalıştır.")
        sys.exit(1)

    print("=" * 60)
    print("Faz 2 — Gold Test Set Oluşturma")
    print("=" * 60)

    df = pd.read_csv(input_path)
    texts = df["text"].fillna("").tolist()
    total = len(texts)
    print(f"Test havuzu: {total} satır")

    # Aktif modeller
    active = ["bert"]
    has_dolphin = (not args.bert_only) and check_ollama("dolphin-llama3")
    has_qwen = (not args.bert_only) and check_ollama("qwen2.5:7b")
    if has_dolphin:
        active.append("dolphin")
    elif not args.bert_only:
        print("  [!] dolphin-llama3 erişilemiyor")
    if has_qwen:
        active.append("qwen")
    elif not args.bert_only:
        print("  [!] qwen2.5:7b erişilemiyor")

    print(f"Aktif modeller: {active}\n")

    # BERT
    print("[1] BERT v3 inference...")
    t0 = time.time()
    classifier = load_sentiment_pipeline(BERT_MODEL_DIR)
    bert_results = score_texts(classifier, texts, batch_size=args.batch_size)
    bert_labels = [r["label"] for r in bert_results]
    bert_scores = [r["score"] for r in bert_results]
    print(f"  BERT tamamlandı: {time.time() - t0:.1f}s")

    # Ollama
    dolphin_labels: list[str | None] = [None] * total
    qwen_labels: list[str | None] = [None] * total

    if has_dolphin or has_qwen:
        print(f"\n[2] Ollama inference ({total} satır × {len(active)-1} model)...")
        t1 = time.time()
        for i in range(total):
            if i % 100 == 0 and i > 0:
                print(f"  {i}/{total} — {time.time()-t1:.0f}s")
            if has_dolphin:
                dolphin_labels[i] = ollama_label(texts[i], "dolphin-llama3")
            if has_qwen:
                qwen_labels[i] = ollama_label(texts[i], "qwen2.5:7b")
        print(f"  Ollama tamamlandı: {time.time()-t1:.1f}s")

    # Konsensüs
    rows_3of3 = []
    rows_2of3 = []

    for i in range(total):
        votes: list[str] = [bert_labels[i]]
        if has_dolphin and dolphin_labels[i]:
            votes.append(dolphin_labels[i])
        if has_qwen and qwen_labels[i]:
            votes.append(qwen_labels[i])

        from collections import Counter
        counts = Counter(votes)
        top_label, top_count = counts.most_common(1)[0]

        row = {
            "text": texts[i],
            "label": top_label,
            "agreement": f"{top_count}/{len(votes)}",
            "bert_label": bert_labels[i],
            "bert_score": round(bert_scores[i], 4),
            "dolphin_label": dolphin_labels[i],
            "qwen_label": qwen_labels[i],
        }

        if top_count == len(votes):
            rows_3of3.append(row)
        elif top_count >= 2:
            rows_2of3.append(row)
        # 1/1/1 → DROP

    gold_df = pd.DataFrame(rows_3of3)
    df_2of3 = pd.DataFrame(rows_2of3)

    if args.use_2of3 and not df_2of3.empty:
        print(f"\n[--use-2of3] 2/3 anlaşmalar da gold'a ekleniyor: +{len(df_2of3)}")
        gold_df = pd.concat([gold_df, df_2of3], ignore_index=True)

    gold_df.to_csv(OUTPUT_GOLD, index=False, encoding="utf-8")
    df_2of3.to_csv(OUTPUT_2OF3, index=False, encoding="utf-8")

    # Özet
    print(f"\n{'=' * 60}")
    print(f"Test havuzu   : {total}")
    print(f"3/3 anlaşma   : {len(rows_3of3)} ({len(rows_3of3)/total*100:.1f}%)")
    print(f"2/3 anlaşma   : {len(df_2of3)} ({len(df_2of3)/total*100:.1f}%)")
    print(f"Reddedilen    : {total - len(rows_3of3) - len(df_2of3)}")

    print(f"\nGold test label dağılımı ({len(gold_df)} satır):")
    for lbl, cnt in gold_df["label"].value_counts().items():
        print(f"  {lbl:<10}: {cnt:>4} ({cnt/len(gold_df)*100:.1f}%)")

    print(f"\nDosyalar:")
    print(f"  {OUTPUT_GOLD}")
    print(f"  {OUTPUT_2OF3}")

    # Uyarı: gold çok küçükse
    if len(gold_df) < 150:
        print(
            f"\n  ⚠️  Gold test seti çok küçük ({len(gold_df)} satır)."
            "\n  2/3 anlaşmaları da eklemek için: python build_gold_test.py --use-2of3"
        )

    print(
        "\nSONRAKİ ADIM:\n"
        "  python train_v4.py --model savasy   # Faz 3: İlk model\n"
        "  python train_v4.py --model xlmr     # Faz 3: İkinci model (RTX 5070 önerilen)\n"
        "  python train_v4.py --model dbmdz    # Faz 3: Baseline"
    )


if __name__ == "__main__":
    main()
