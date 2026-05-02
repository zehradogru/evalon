from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from model_utils import BASE_DIR, build_news_text, find_latest_scraped_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hazir etiketlenecek ornek haber csv'si uretir.")
    parser.add_argument("--input", type=str, default="", help="Kaynak ham haber csv yolu")
    parser.add_argument("--output", type=str, default="sample.csv", help="Cikti dosya adi")
    parser.add_argument("--sample-size", type=int, default=200, help="Secilecek ornek sayisi")
    parser.add_argument("--seed", type=int, default=42, help="Ornekleme seed degeri")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_path = Path(args.input) if args.input else find_latest_scraped_csv()
    if not input_path.is_absolute():
        input_path = (BASE_DIR / input_path).resolve()

    print(f"Kaynak veri okunuyor: {input_path}")
    df = pd.read_csv(input_path)

    expected_columns = {"title", "summary", "content"}
    missing_columns = expected_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Eksik kolonlar: {sorted(missing_columns)}")

    df["text"] = df.apply(
        lambda row: build_news_text(row.get("title"), row.get("summary"), row.get("content")),
        axis=1,
    )
    df = df[df["text"].str.len() > 20].copy()

    dedupe_columns = [column for column in ("url_hash", "url", "title", "text") if column in df.columns]
    df = df.drop_duplicates(subset=dedupe_columns, keep="first").reset_index(drop=True)

    sample_size = min(args.sample_size, len(df))
    sample_df = df.sample(n=sample_size, random_state=args.seed).copy()
    sample_df["sentiment"] = "BEKLIYOR"

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = BASE_DIR / output_path

    sample_df[["text", "sentiment"]].to_csv(
        output_path,
        sep="|",
        index=False,
        header=False,
        encoding="utf-8",
    )

    print(f"{sample_size} satirlik ornek veri kaydedildi: {output_path}")


if __name__ == "__main__":
    main()
