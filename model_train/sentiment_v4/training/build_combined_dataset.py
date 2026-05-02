#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/build_combined_dataset.py

label_dataset.py çıktısını (labeled_news.csv) alarak BERT v4 için
temiz, dengeli bir eğitim seti oluşturur.

NOT: model_train/data.csv AI ile üretilmiş (sentetik) veridir — gerçek haber değil.
Varsayılan olarak dahil EDİLMEZ. Sadece gerçek scraper verisini kullanırız.

Çıktı: sentiment_v4/data_v4.csv  (pipe-separated, text|sentiment)

KULLANIM:
  python build_combined_dataset.py            # Sadece labeled_news.csv kullan (önerilen)
  python build_combined_dataset.py --balance  # Sınıfları dengele (oversample)
  python build_combined_dataset.py --include-old  # (ÖNERİLMEZ) eski sentetik data.csv'yi de ekle
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

from model_utils import normalize_label

OLD_DATA = MODEL_TRAIN_DIR / "data.csv"
NEW_LABELED = HERE / "labeled_news.csv"
OUTPUT = HERE / "data_v4.csv"

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--old-data", default=str(OLD_DATA), help="Mevcut data.csv yolu")
    p.add_argument("--new-data", default=str(NEW_LABELED), help="label_dataset.py çıktısı")
    p.add_argument("--output", default=str(OUTPUT), help="Birleşik çıktı CSV yolu")
    p.add_argument("--balance", action="store_true", help="Sınıfları dengele (en az sınıfa oversample)")
    p.add_argument(
        "--include-old",
        action="store_true",
        help="(ÖNERİLMEZ) model_train/data.csv sentetik veriyi de ekle",
    )
    return p.parse_args()


def load_pipe_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep="|", header=None, names=["text", "sentiment"], encoding="utf-8")
    df["text"] = df["text"].fillna("").astype(str).str.strip()
    df["sentiment"] = df["sentiment"].map(normalize_label)
    df = df[df["text"] != ""].copy()
    df = df[df["sentiment"].isin(VALID_LABELS)].copy()
    return df


def main() -> None:
    args = parse_args()

    frames = []

    # Yeni etiketli veri (zorunlu)
    new_path = Path(args.new_data)
    if not new_path.exists():
        print(f"HATA: {new_path} bulunamadı. Önce label_dataset.py çalıştır.")
        sys.exit(1)
    new_df = load_pipe_csv(new_path)
    print(f"Yeni etiketli veri  : {len(new_df)} satır")
    frames.append(new_df)

    # Eski data.csv (varsayılan KAPALI — sentetik/AI üretimi)
    if args.include_old:
        old_path = Path(args.old_data)
        if old_path.exists():
            old_df = load_pipe_csv(old_path)
            print(f"Eski data.csv (sentetik, dahil edildi): {len(old_df)} satır  ⚠️")
            frames.append(old_df)
        else:
            print(f"Uyarı: {old_path} bulunamadı, atlandı.")

    combined = pd.concat(frames, ignore_index=True)

    # Deduplicate (aynı metin varsa ilkini tut)
    before = len(combined)
    combined = combined.drop_duplicates(subset=["text"], keep="first").reset_index(drop=True)
    after = len(combined)
    if before != after:
        print(f"Deduplicate: {before - after} tekrar kaldırıldı.")

    print(f"\nBirleşik toplam     : {len(combined)} satır")
    print("\nDağılım (önce dengeleme):")
    counts = combined["sentiment"].value_counts()
    for label, count in counts.items():
        print(f"  {label:<10}: {count:>5}")

    # Dengeleme (opsiyonel)
    if args.balance:
        min_count = counts.min()
        max_count = counts.max()
        if max_count / min_count > 1.5:
            balanced_frames = []
            for label in VALID_LABELS:
                subset = combined[combined["sentiment"] == label]
                if len(subset) < max_count:
                    subset = subset.sample(max_count, replace=True, random_state=42)
                balanced_frames.append(subset)
            combined = pd.concat(balanced_frames).sample(frac=1, random_state=42).reset_index(drop=True)
            print(f"\nDağılım (dengelemeden sonra, toplam={len(combined)}):")
            for label, count in combined["sentiment"].value_counts().items():
                print(f"  {label:<10}: {count:>5}")

    # Kaydet
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(output_path, sep="|", index=False, header=False, encoding="utf-8")

    print(f"\nKaydedildi: {output_path}")
    print(
        "\nSONRAKİ ADIM:\n"
        f"  python ../train_local.py --data {output_path.name}\n"
        "  (veya train_local.py içindeki DATA_PATH'i güncelle)"
    )


if __name__ == "__main__":
    main()
