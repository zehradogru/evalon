from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

import pandas as pd

from model_utils import (
    DATA_PATH,
    DERIVED_DATA_DIR,
    DERIVED_REPORTS_DIR,
    TRAINING_LABELS,
    build_news_text,
    ensure_directory,
    load_training_dataframe,
    normalize_label,
)

DEFAULT_EXTRA_RAW_NEWS = (
    Path(__file__).resolve().parent.parent
    / "scrapers"
    / "news_scraper"
    / "bist-news-data"
    / "tr_haberler_20260405_153757.csv"
)

NEGATIVE_PATTERNS = [
    r"\bzarar\b",
    r"net zarar",
    r"bedelli sermaye artır",
    r"neden düşüyor",
    r"yüklü satış",
    r"satışa geçti",
    r"tedbir",
    r"ceza",
    r"yasak",
    r"borçlanma kararı",
    r"faaliyet.*duru",
]

POSITIVE_PATTERNS = [
    r"bedelsiz sermaye artır",
    r"temettü",
    r"kar payı",
    r"hedef fiyat.*(yükselt|art)",
    r"\bal\b tavsiye",
    r"yeni sözleşme",
    r"sözleşme imzala",
    r"anlaşma",
    r"iş birliği",
    r"ihale kazandı",
    r"geri alım",
    r"üretimi başlattı",
    r"mağaza duyurusu",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ham haber CSV'lerini degistirmeden turetilmis egitim setleri uretir."
    )
    parser.add_argument(
        "--base-data",
        type=str,
        default=str(DATA_PATH),
        help="Temel text|label egitim csv yolu",
    )
    parser.add_argument(
        "--audit-data",
        type=str,
        default="real_news_sample_200_manual_audit.csv",
        help="Manuel audit csv yolu",
    )
    parser.add_argument(
        "--real-sample-data",
        type=str,
        default="real_news_sample_200_labeled.csv",
        help="Manuel audit ile eslesecek gercek haber ornek csv yolu",
    )
    parser.add_argument(
        "--extra-raw-news",
        type=str,
        default=str(DEFAULT_EXTRA_RAW_NEWS),
        help="Ek zayif etiket uretilecek ham haber csv yolu",
    )
    parser.add_argument(
        "--skip-weak-labels",
        action="store_true",
        help="Ham haberlerden zayif etiketli veri uretme adimini kapat",
    )
    return parser.parse_args()


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (Path(__file__).resolve().parent / path).resolve()


def build_manual_training_dataframe(audit_path: Path, real_sample_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    audit_df = pd.read_csv(audit_path, encoding="utf-8")
    sample_df = pd.read_csv(real_sample_path, encoding="utf-8")

    required_audit_columns = {"id", "manual_label"}
    missing_audit_columns = required_audit_columns - set(audit_df.columns)
    if missing_audit_columns:
        raise ValueError(f"Audit dosyasinda eksik kolonlar var: {sorted(missing_audit_columns)}")

    required_sample_columns = {"title", "summary", "content", "source"}
    missing_sample_columns = required_sample_columns - set(sample_df.columns)
    if missing_sample_columns:
        raise ValueError(f"Gercek haber ornek dosyasinda eksik kolonlar var: {sorted(missing_sample_columns)}")

    sample_df = sample_df.copy()
    sample_df["id"] = range(1, len(sample_df) + 1)

    merged = sample_df.merge(
        audit_df[["id", "manual_label"]],
        on="id",
        how="inner",
        validate="one_to_one",
    )
    merged["manual_label"] = merged["manual_label"].map(normalize_label)
    merged = merged[merged["manual_label"].isin(TRAINING_LABELS)].copy()
    merged["text"] = merged.apply(
        lambda row: build_news_text(row.get("title"), row.get("summary"), row.get("content")),
        axis=1,
    )
    merged["text"] = merged["text"].fillna("").astype(str).str.strip()
    merged = merged[merged["text"] != ""].copy()
    merged["dataset_source"] = "manual_real_news_audit"

    train_df = merged[["text", "manual_label"]].rename(columns={"manual_label": "sentiment"}).copy()
    return train_df.reset_index(drop=True), merged.reset_index(drop=True)


def infer_weak_label(title: object, summary: object) -> str | None:
    haystack = " ".join(
        fragment.strip()
        for fragment in (
            str(title or ""),
            str(summary or ""),
        )
        if str(fragment or "").strip()
    ).lower()

    if not haystack:
        return None

    negative_hit = any(re.search(pattern, haystack, flags=re.IGNORECASE) for pattern in NEGATIVE_PATTERNS)
    positive_hit = any(re.search(pattern, haystack, flags=re.IGNORECASE) for pattern in POSITIVE_PATTERNS)

    if positive_hit and not negative_hit:
        return "OLUMLU"
    if negative_hit and not positive_hit:
        return "OLUMSUZ"
    return None


def build_weakly_labeled_dataframe(extra_raw_news_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw_df = pd.read_csv(extra_raw_news_path, encoding="utf-8")
    required_columns = {"title", "summary", "content"}
    missing_columns = required_columns - set(raw_df.columns)
    if missing_columns:
        raise ValueError(f"Ek ham haber dosyasinda eksik kolonlar var: {sorted(missing_columns)}")

    weak_df = raw_df.copy()
    weak_df["sentiment"] = weak_df.apply(
        lambda row: infer_weak_label(row.get("title"), row.get("summary")),
        axis=1,
    )
    weak_df = weak_df[weak_df["sentiment"].isin({"OLUMLU", "OLUMSUZ"})].copy()
    weak_df["text"] = weak_df.apply(
        lambda row: build_news_text(row.get("title"), row.get("summary"), row.get("content")),
        axis=1,
    )
    weak_df["text"] = weak_df["text"].fillna("").astype(str).str.strip()
    weak_df = weak_df[weak_df["text"] != ""].copy()
    weak_df = weak_df.drop_duplicates(subset=["text"], keep="first").reset_index(drop=True)
    weak_df["dataset_source"] = "weak_labels_from_raw_news"

    train_df = weak_df[["text", "sentiment"]].copy()
    return train_df.reset_index(drop=True), weak_df.reset_index(drop=True)


def write_pipe_csv(dataframe: pd.DataFrame, output_path: Path) -> None:
    dataframe.to_csv(output_path, sep="|", index=False, header=False, encoding="utf-8")


def main() -> None:
    args = parse_args()

    base_data_path = resolve_path(args.base_data)
    audit_path = resolve_path(args.audit_data)
    real_sample_path = resolve_path(args.real_sample_data)
    extra_raw_news_path = resolve_path(args.extra_raw_news)

    training_dir = ensure_directory(DERIVED_DATA_DIR)
    reports_dir = ensure_directory(DERIVED_REPORTS_DIR)

    base_df = load_training_dataframe(base_data_path)
    base_df["dataset_source"] = "base_data_csv"

    manual_train_df, manual_debug_df = build_manual_training_dataframe(audit_path, real_sample_path)
    manual_train_df["dataset_source"] = "manual_real_news_audit"
    weak_train_df = pd.DataFrame(columns=["text", "sentiment", "dataset_source"])
    weak_debug_df = pd.DataFrame()

    if not args.skip_weak_labels and extra_raw_news_path.exists():
        weak_train_only_df, weak_debug_df = build_weakly_labeled_dataframe(extra_raw_news_path)
        weak_train_df = weak_train_only_df.copy()
        weak_train_df["dataset_source"] = "weak_labels_from_raw_news"

    combined_df = pd.concat(
        [
            manual_train_df[["text", "sentiment", "dataset_source"]],
            weak_train_df[["text", "sentiment", "dataset_source"]],
            base_df[["text", "sentiment", "dataset_source"]],
        ],
        ignore_index=True,
    )
    combined_df = combined_df.drop_duplicates(subset=["text"], keep="first").reset_index(drop=True)

    base_output = training_dir / "base_training_data.csv"
    manual_output = training_dir / "manual_real_news_training.csv"
    weak_output = training_dir / "weak_labeled_news_training.csv"
    combined_output = training_dir / "combined_training_data.csv"
    combined_debug_output = training_dir / "combined_training_debug.csv"
    manual_debug_output = training_dir / "manual_real_news_debug.csv"
    weak_debug_output = training_dir / "weak_labeled_news_debug.csv"

    write_pipe_csv(base_df[["text", "sentiment"]], base_output)
    write_pipe_csv(manual_train_df[["text", "sentiment"]], manual_output)
    if len(weak_train_df) > 0:
        write_pipe_csv(weak_train_df[["text", "sentiment"]], weak_output)
    write_pipe_csv(combined_df[["text", "sentiment"]], combined_output)
    combined_df.to_csv(combined_debug_output, index=False, encoding="utf-8")
    manual_debug_df.to_csv(manual_debug_output, index=False, encoding="utf-8")
    if len(weak_debug_df) > 0:
        weak_debug_df.to_csv(weak_debug_output, index=False, encoding="utf-8")

    summary = {
        "base_rows": int(len(base_df)),
        "manual_real_news_rows": int(len(manual_train_df)),
        "weak_labeled_rows": int(len(weak_train_df)),
        "combined_rows": int(len(combined_df)),
        "base_labels": base_df["sentiment"].value_counts().sort_index().to_dict(),
        "manual_labels": manual_train_df["sentiment"].value_counts().sort_index().to_dict(),
        "weak_labels": weak_train_df["sentiment"].value_counts().sort_index().to_dict(),
        "combined_labels": combined_df["sentiment"].value_counts().sort_index().to_dict(),
        "inputs": {
            "base_data": str(base_data_path),
            "audit_data": str(audit_path),
            "real_sample_data": str(real_sample_path),
            "extra_raw_news": str(extra_raw_news_path),
        },
        "outputs": {
            "base_training_data": str(base_output),
            "manual_real_news_training": str(manual_output),
            "weak_labeled_news_training": str(weak_output),
            "combined_training_data": str(combined_output),
            "combined_training_debug": str(combined_debug_output),
            "manual_real_news_debug": str(manual_debug_output),
            "weak_labeled_news_debug": str(weak_debug_output),
        },
    }

    with open(reports_dir / "derived_dataset_summary.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    print(f"Base egitim verisi: {len(base_df)} satir")
    print(f"Manuel gercek haber verisi: {len(manual_train_df)} satir")
    print(f"Zayif etiketli ek haber verisi: {len(weak_train_df)} satir")
    print(f"Birlestirilmis egitim verisi: {len(combined_df)} satir")
    print(f"Turetilmis dosyalar kaydedildi: {training_dir}")


if __name__ == "__main__":
    main()
