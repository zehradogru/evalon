from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from model_utils import (
    BASE_DIR,
    build_news_text,
    find_latest_scraped_csv,
    load_sentiment_pipeline,
    normalize_label,
    score_texts,
    timestamp,
)


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path

    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate

    base_candidate = (BASE_DIR / path).resolve()
    if base_candidate.exists():
        return base_candidate

    return cwd_candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="En guncel scraper haberlerini yerel modelle etiketler.")
    parser.add_argument("--input", type=str, default="", help="Kaynak haber csv yolu")
    parser.add_argument("--output", type=str, default="", help="Cikti haber csv yolu")
    parser.add_argument("--limit", type=int, default=0, help="Sadece ilk N bekleyen kaydi isle")
    parser.add_argument("--batch-size", type=int, default=8, help="Inference batch size")
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.0,
        help="Bu skorun altindaki tahminleri BEKLIYOR olarak birak",
    )
    return parser.parse_args()


def resolve_input_path(raw_input: str) -> Path:
    if raw_input:
        return resolve_path(raw_input)
    return find_latest_scraped_csv()


def resolve_output_path(input_path: Path, raw_output: str) -> Path:
    if raw_output:
        return resolve_path(raw_output)
    return input_path.with_name(f"{input_path.stem}_local_labeled.csv")


def main() -> None:
    args = parse_args()
    input_path = resolve_input_path(args.input)
    output_path = resolve_output_path(input_path, args.output)

    print(f"Girdi dosyasi: {input_path}")
    df = pd.read_csv(input_path)

    required_columns = {"title", "summary", "content", "sentiment"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Eksik kolonlar: {sorted(missing_columns)}")

    target_mask = df["sentiment"].fillna("BEKLIYOR").astype(str).str.upper().eq("BEKLIYOR")
    target_indexes = df.index[target_mask].tolist()
    if args.limit and args.limit > 0:
        target_indexes = target_indexes[: args.limit]

    print(f"Islenecek haber sayisi: {len(target_indexes)}")
    if not target_indexes:
        print("Etiketlenecek yeni haber yok.")
        return

    classifier = load_sentiment_pipeline()

    records = []
    for index in target_indexes:
        row = df.loc[index]
        records.append(
            {
                "index": index,
                "text": build_news_text(row.get("title"), row.get("summary"), row.get("content")),
            }
        )

    texts = [record["text"] for record in records]
    predictions = score_texts(classifier, texts, batch_size=args.batch_size)

    labeled_count = 0
    for record, prediction in zip(records, predictions):
        label = normalize_label(prediction["label"])
        score = float(prediction["score"])

        final_label = label if score >= args.min_score else "BEKLIYOR"
        row_index = record["index"]
        df.at[row_index, "sentiment"] = final_label
        df.at[row_index, "sentiment_score"] = round(score, 6)
        df.at[row_index, "sentiment_model"] = "local_bist_bert_model"
        df.at[row_index, "sentiment_scored_at"] = timestamp()

        if final_label != "BEKLIYOR":
            labeled_count += 1

    df.to_csv(output_path, index=False, encoding="utf-8")
    print(f"Cikti dosyasi kaydedildi: {output_path}")
    print(f"Etiketlenen haber sayisi: {labeled_count}")
    print(f"BEKLIYOR birakilan haber sayisi: {len(records) - labeled_count}")


if __name__ == "__main__":
    main()
