#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/prepare_data.py  —  Faz 0: Veri Temizleme

train_unlabeled.csv (6000) ve test_unlabeled.csv (399) dosyalarını filtreler,
normalleştirir ve BERT v4 pipeline'ına hazır hale getirir.

Çıktılar:
  train_clean.csv  —  eğitim havuzu (~5000 satır beklenir)
  test_clean.csv   —  test havuzu (~330 satır beklenir)

Her iki dosya aynı kolon yapısına sahiptir:
  text, symbol, source, published_at
  (text = build_news_text sonucu, etiket henüz yok)

Filtreleme kuralları:
  1. content IS NULL + summary kısa (<50 kar.) → sadece title → DROP
     (model kaynak isminden sentiment öğrenir — gürültü)
  2. title + summary + content toplam < 200 karakter → DROP
  3. Aynı title → sadece ilk satırı tut (duplicate)
  4. title yalnızca source adından oluşuyor (boş içerik) → DROP

Normalizasyon:
  - HTML tag temizleme (BeautifulSoup, varsa)
  - URL → <URL>
  - Source kuyruğu kaldırma ("... - Bigpara" → model kaynağı öğreniyor)
  - Fazla whitespace collapse
  - content 1500 karakter ile sınırla
  - text sonuna [TICKER:SYMBOL] ekle (ticker context)

KULLANIM:
  python prepare_data.py
  python prepare_data.py --train train_unlabeled.csv --test test_unlabeled.csv
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

from model_utils import build_news_text, clean_fragment, normalize_label

# BeautifulSoup opsiyonel — yoksa basit regex ile temizle
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

HTML_TAG_RE = re.compile(r"<[^>]+>")
VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}

# Zaten model_utils.SOURCE_SUFFIX_RE var ama burada genişlet
SOURCE_NAMES = [
    "Bigpara", "getmidas.com", "Investing.com", "Investing.com Türkiye",
    "Mynet Finans", "finans.mynet.com", "Rota Borsa", "rotaborsa.com",
    "Borsanın Gündemi", "Paratic Haber", "borsagundem.com.tr",
    "Paranın Yönü", "TradingView", "Para Ajansı", "CNBC-e",
    "Ekonomim", "Bloomberght", "bloomberght.com", "Gazete Oksijen",
]
_source_pattern = "|".join(re.escape(s) for s in SOURCE_NAMES)
SOURCE_SUFFIX_EXTENDED_RE = re.compile(
    rf"\s*[-–—|]\s*(?:{_source_pattern})\s*$", flags=re.IGNORECASE
)


def strip_html(text: str) -> str:
    if HAS_BS4:
        return BeautifulSoup(text, "html.parser").get_text(separator=" ")
    return HTML_TAG_RE.sub(" ", text)


def clean_text(text: object) -> str:
    if not isinstance(text, str):
        return ""
    t = strip_html(text)
    t = clean_fragment(t)
    return t


def build_text(row: pd.Series, content_char_limit: int = 1500) -> str:
    title = clean_text(row.get("title", ""))
    summary = clean_text(row.get("summary", ""))
    content = clean_text(str(row.get("content", "") or "")[:content_char_limit * 2])[:content_char_limit]
    text = build_news_text(title, summary, content, content_char_limit=content_char_limit)

    # Ticker bağlamı ekle — model hangi hisse için haberlendiğini bilsin
    symbol = str(row.get("symbol", "") or "").strip()
    if symbol and symbol != "nan":
        text = text + f" [TICKER:{symbol}]"

    return text.strip()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--train", default=str(HERE / "train_unlabeled.csv"))
    p.add_argument("--test", default=str(HERE / "test_unlabeled.csv"))
    p.add_argument("--out-train", default=str(HERE / "train_clean.csv"))
    p.add_argument("--out-test", default=str(HERE / "test_clean.csv"))
    p.add_argument("--min-chars", type=int, default=200, help="Minimum toplam metin uzunluğu")
    return p.parse_args()


def process(df: pd.DataFrame, min_chars: int, name: str) -> pd.DataFrame:
    original = len(df)
    stats: dict[str, int] = {}

    # ── 1. Duplicate title ─────────────────────────────────────────────────
    before = len(df)
    df = df.drop_duplicates(subset=["title"], keep="first").reset_index(drop=True)
    stats["dup_title"] = before - len(df)

    # ── 2. Boş content + kısa summary ─────────────────────────────────────
    before = len(df)
    no_content = df["content"].isna() | (df["content"].fillna("").str.strip() == "")
    short_summary = df["summary"].fillna("").str.strip().str.len() < 50
    df = df[~(no_content & short_summary)].reset_index(drop=True)
    stats["no_content_short_summary"] = before - len(df)

    # ── 3. Toplam metin çok kısa ───────────────────────────────────────────
    before = len(df)
    total_len = (
        df["title"].fillna("").str.len()
        + df["summary"].fillna("").str.len()
        + df["content"].fillna("").str.len()
    )
    df = df[total_len >= min_chars].reset_index(drop=True)
    stats["too_short"] = before - len(df)

    # ── 4. Text oluştur ────────────────────────────────────────────────────
    df["text"] = df.apply(build_text, axis=1)

    # Metin oluşturulduktan sonra boş kalanları da drop et
    before = len(df)
    df = df[df["text"].str.strip() != ""].reset_index(drop=True)
    stats["empty_text_after_clean"] = before - len(df)

    # ── Özet ───────────────────────────────────────────────────────────────
    total_dropped = original - len(df)
    print(f"\n{'─'*50}")
    print(f"{name}: {original} → {len(df)} satır (−{total_dropped} drop)")
    for reason, count in stats.items():
        if count > 0:
            print(f"  {reason}: −{count}")

    print(f"\n  Metin uzunluğu (karakter):")
    lengths = df["text"].str.len()
    print(f"    min={lengths.min()}, median={int(lengths.median())}, max={lengths.max()}, mean={int(lengths.mean())}")

    if "symbol" in df.columns:
        print(f"\n  Top ticker'lar:")
        print("  " + str(df["symbol"].value_counts().head(5).to_dict()))

    return df[["text", "symbol", "source", "published_at"]].copy()


def main() -> None:
    args = parse_args()

    print("=" * 60)
    print("Faz 0 — Veri Temizleme")
    print("=" * 60)
    if not HAS_BS4:
        print("  [!] beautifulsoup4 yüklü değil → regex ile HTML temizlenecek (pip install beautifulsoup4)")

    for in_path, out_path, name in [
        (args.train, args.out_train, "TRAIN"),
        (args.test, args.out_test, "TEST"),
    ]:
        if not Path(in_path).exists():
            print(f"HATA: {in_path} bulunamadı, atlandı.")
            continue
        df = pd.read_csv(in_path)
        clean_df = process(df, args.min_chars, name)
        clean_df.to_csv(out_path, index=False, encoding="utf-8")
        print(f"  → {out_path}")

    print("\nFaz 0 tamamlandı.")
    print(
        "\nSONRAKİ ADIM:\n"
        "  python multi_label.py   # Faz 1: 3-model konsensüs etiketleme\n"
        "  python build_gold_test.py   # Faz 2: Gold test set oluştur (Faz 1 ile paralel)\n"
        "\n  Önce qwen2.5:7b indirin (arka planda):\n"
        "  ollama pull qwen2.5:7b"
    )


if __name__ == "__main__":
    main()
