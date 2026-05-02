from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DATA_PATH = BASE_DIR / "data.csv"
MODEL_DIR = BASE_DIR / "bist_bert_model"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DERIVED_DIR = BASE_DIR / "derived"
DERIVED_DATA_DIR = DERIVED_DIR / "training"
DERIVED_REPORTS_DIR = DERIVED_DIR / "reports"
DERIVED_MODELS_DIR = DERIVED_DIR / "models"
SCRAPER_DATA_DIR = ROOT_DIR / "scrapers" / "news_scraper" / "bist-news-data"

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR", "BEKLIYOR"}
TRAINING_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}

SOURCE_SUFFIX_RE = re.compile(
    r"\s*-\s*(Bigpara|getmidas\.com|Investing\.com(?: Türkiye)?|Mynet Finans|Rota Borsa|rotaborsa\.com|"
    r"Borsanın Gündemi|Paratic Haber|Gazete Oksijen|Borsagundem\.com\.tr|Paranın Yönü|Borsametre)\s*$",
    flags=re.IGNORECASE,
)
URL_RE = re.compile(r"https?://\S+", flags=re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\s+")
NOISE_PATTERNS = [
    r"Bizi WhatsApp Kanalımız üzerinden de takip edebilirsiniz\.?",
    r"WhatsApp kanal[ıi] linki:?\s*\S+",
    r"Bu sitede yer alan .*? yatırım tavsiyesi değildir\.?",
    r"Yasal uyar[ıi].*",
    r"Kabul Et",
    r"Çerez.*",
    r"Sayfada yer alan .*",
    r"Burada yer alan .*",
]


def normalize_label(label: object) -> str:
    value = str(label or "").strip().upper()
    replacements = {
        "NÖTR.": "NÖTR",
        "NÖTR ": "NÖTR",
        "NEUTRAL": "NÖTR",
        "NEGATIVE": "OLUMSUZ",
        "POSITIVE": "OLUMLU",
        "LABEL_0": "LABEL_0",
        "LABEL_1": "LABEL_1",
        "LABEL_2": "LABEL_2",
    }
    return replacements.get(value, value)


def clean_fragment(text: object) -> str:
    if not isinstance(text, str):
        return ""

    value = text.replace("\r", " ").replace("\n", " ").strip()
    value = URL_RE.sub(" ", value)
    value = SOURCE_SUFFIX_RE.sub("", value)

    for pattern in NOISE_PATTERNS:
        value = re.sub(pattern, " ", value, flags=re.IGNORECASE)

    value = WHITESPACE_RE.sub(" ", value)
    return value.strip(" .|-")


def ensure_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_news_text(
    title: object,
    summary: object,
    content: object,
    *,
    content_char_limit: int = 1500,
) -> str:
    parts = []
    seen = set()

    for fragment in (
        clean_fragment(title),
        clean_fragment(summary),
        clean_fragment(str(content)[:content_char_limit] if content else ""),
    ):
        if not fragment:
            continue
        if fragment in seen:
            continue
        seen.add(fragment)
        parts.append(fragment)

    return ". ".join(parts)


def find_latest_scraped_csv(data_dir: Path | None = None) -> Path:
    search_dir = data_dir or SCRAPER_DATA_DIR
    candidates = [
        path
        for path in search_dir.glob("tr_haberler*.csv")
        if "copy" not in path.name.lower()
    ]
    if not candidates:
        raise FileNotFoundError(f"No raw scraper csv found under: {search_dir}")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def resolve_device_index() -> int:
    import torch

    return 0 if torch.cuda.is_available() else -1


def load_sentiment_pipeline(model_dir: Path | None = None):
    from transformers import pipeline

    target_dir = Path(model_dir or MODEL_DIR)
    return pipeline(
        "text-classification",
        model=str(target_dir),
        tokenizer=str(target_dir),
        device=resolve_device_index(),
    )


def score_texts(classifier, texts: Iterable[str], *, batch_size: int = 8) -> list[dict]:
    prepared = [text if isinstance(text, str) else "" for text in texts]
    return classifier(prepared, truncation=True, max_length=512, batch_size=batch_size)


def load_training_dataframe(data_path: Path | None = None) -> pd.DataFrame:
    target_path = Path(data_path or DATA_PATH)
    df = pd.read_csv(target_path, sep="|", names=["text", "sentiment"], encoding="utf-8")
    df["text"] = df["text"].fillna("").astype(str).str.strip()
    df["sentiment"] = df["sentiment"].map(normalize_label)
    df = df[df["text"] != ""].copy()
    df = df[df["sentiment"].isin(TRAINING_LABELS)].copy()
    df = df.drop_duplicates(subset=["text"], keep="first").reset_index(drop=True)
    return df


def timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
