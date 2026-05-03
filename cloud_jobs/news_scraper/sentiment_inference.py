"""Sentiment inference using fine-tuned BertForSequenceClassification.

Model: final_model_dbmdz (Turkish BERT fine-tuned)
Labels: NÖTR (0), OLUMLU (1), OLUMSUZ (2)

Model önce yerel ./sentiment_model/ klasörüne bakılır.
Yoksa GCS'den SENTIMENT_MODEL_BUCKET / SENTIMENT_MODEL_GCS_PREFIX konumundan indirilir.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)

# Singleton – modül ömrü boyunca bir kez yüklenir
_pipeline = None
_loaded = False  # yükleme bir kez denenir (başarısız olsa da tekrarlanmaz)

# Ortam değişkenleriyle özelleştirilebilir GCS konumu
_GCS_BUCKET = os.environ.get("SENTIMENT_MODEL_BUCKET", "evalon-490523-models")
_GCS_PREFIX = os.environ.get("SENTIMENT_MODEL_GCS_PREFIX", "sentiment_v4/final_model_dbmdz")
_LOCAL_CACHE = os.environ.get("SENTIMENT_MODEL_LOCAL_PATH", "/tmp/sentiment_model")


def _ensure_model_path() -> str:
    """
    Modeli yerel olarak sağlar; yoksa GCS'den indirir.
    Yerel yol döner.
    """
    # 1. Önce bu dosyanın yanındaki sentiment_model/ klasörüne bak (yerel / test)
    local_sibling = Path(__file__).parent / "sentiment_model"
    if local_sibling.is_dir() and (local_sibling / "config.json").exists():
        logger.info(f"Yerel sentiment modeli bulundu: {local_sibling}")
        return str(local_sibling)

    # 2. Cache dizinine bak (/tmp/sentiment_model Cloud Run'da)
    cached = Path(_LOCAL_CACHE)
    if cached.is_dir() and (cached / "config.json").exists():
        logger.info("Sentiment modeli zaten cache'de mevcut, tekrar indirilmiyor.")
        return str(cached)

    # 3. GCS'den indir
    logger.info(f"GCS'den sentiment modeli indiriliyor: gs://{_GCS_BUCKET}/{_GCS_PREFIX}")
    try:
        from google.cloud import storage as gcs  # noqa: PLC0415

        client = gcs.Client()
        bucket = client.bucket(_GCS_BUCKET)
        blobs = list(bucket.list_blobs(prefix=_GCS_PREFIX))

        if not blobs:
            raise RuntimeError(
                f"GCS'de model dosyası bulunamadı: gs://{_GCS_BUCKET}/{_GCS_PREFIX}"
            )

        cached.mkdir(parents=True, exist_ok=True)
        for blob in blobs:
            rel_path = blob.name[len(_GCS_PREFIX):].lstrip("/")
            if not rel_path:
                continue
            dest = cached / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"  → {blob.name}")
            blob.download_to_filename(str(dest))

        logger.info("Model indirme tamamlandı.")
        return str(cached)

    except Exception as exc:
        raise RuntimeError(f"Sentiment modeli indirilemedi: {exc}") from exc


def _load_pipeline() -> None:
    """Model pipeline'ı bir kez yükler (singleton)."""
    global _pipeline, _loaded
    if _loaded:
        return
    _loaded = True  # başarısız olsa bile tekrar deneme

    try:
        from transformers import pipeline as hf_pipeline  # noqa: PLC0415

        model_path = _ensure_model_path()
        logger.info(f"Sentiment pipeline yükleniyor: {model_path}")
        _pipeline = hf_pipeline(
            "text-classification",
            model=model_path,
            tokenizer=model_path,
            device=-1,  # CPU
            truncation=True,
            max_length=128,
        )
        logger.info("Sentiment pipeline hazır.")
    except Exception as exc:
        logger.warning(
            f"Sentiment modeli yüklenemedi: {exc}. Tüm haberler 'BEKLIYOR' olarak kaydedilecek."
        )
        _pipeline = None


import re as _re
import json as _json


def _load_all_tickers() -> set:
    try:
        _json_path = Path(__file__).parent / "bist_tickers.json"
        with open(_json_path, "r", encoding="utf-8") as f:
            data = _json.load(f)
        return set(t.upper() for t in data.get("tr", []))
    except Exception:
        return set()


_ALL_TICKERS: set = _load_all_tickers()


def _find_tickers_in_text(text: str) -> set:
    text_upper = text.upper()
    return {t for t in _ALL_TICKERS if _re.search(rf"\b{_re.escape(t)}\b", text_upper)}


def _sentences_for_ticker(symbol: str, text: str) -> str:
    symbol_upper = symbol.strip().upper()
    sentences = _re.split(r"(?<=[.!?\n])\s+", text)
    relevant = [
        s.strip()
        for s in sentences
        if _re.search(rf"\b{_re.escape(symbol_upper)}\b", s.upper()) and len(s.strip()) > 8
    ]
    return " ".join(relevant[:5])[:400] if relevant else ""


def predict_sentiment(text: str) -> Tuple[str, float]:
    """
    Verilen metin için (etiket, güven_skoru) döner.
    Etiketler: NÖTR, OLUMLU, OLUMSUZ
    Model yüklenemezse ('BEKLIYOR', 0.0) döner.
    """
    _load_pipeline()

    if _pipeline is None:
        return "BEKLIYOR", 0.0

    try:
        result = _pipeline(text[:400], truncation=True)
        label: str = result[0]["label"]
        score: float = round(float(result[0]["score"]), 4)
        return label, score
    except Exception as exc:
        logger.warning(f"Sentiment tahmini başarısız: {exc}")
        return "BEKLIYOR", 0.0


def predict_sentiment_for_ticker(symbol: str, title: str, summary: str = "", content: str = "") -> Tuple[str, float]:
    """
    Belirli bir hisse sembolüne özgü sentiment tahmini yapar.

    - Haberde başka ticker yoksa: tam metin → model
    - Başka ticker varsa: sadece bizim ticker'ı içeren cümleler alınır
      - Focused cümlede 2+ farklı ticker varsa (liste satırı): NÖTR
      - Model skoru < 0.65 ise: NÖTR (belirsiz)
      - Aksi hâlde: model etiketi
    """
    full_text = f"{title} {summary} {content[:800]}".strip()

    found_tickers = _find_tickers_in_text(full_text)
    other_tickers = found_tickers - {symbol.upper()}

    if not other_tickers:
        # Tek ticker ya da hiç yok → normal
        return predict_sentiment(full_text)

    # Birden fazla ticker: sadece bizimkiyle ilgili cümleler
    focused = _sentences_for_ticker(symbol, full_text)
    if not focused:
        # Cümle bulunamadı → fallback
        return predict_sentiment(full_text)

    # Liste satırı kontrolü: focused cümlede 2+ ticker varsa anlamsız satır
    if len(_find_tickers_in_text(focused)) >= 2:
        return "NÖTR", 0.0

    label, score = predict_sentiment(focused)
    if score < 0.65:
        return "NÖTR", score
    return label, score


def warm_up() -> None:
    """Scraping başlamadan önce modeli ısıtmak için çağırılabilir."""
    _load_pipeline()
    if _pipeline is not None:
        logger.info("Sentiment modeli ısındı.")


def label_pending_in_oracle(batch_size: int = 500) -> None:
    """
    Oracle BIST_NEWS tablosundaki SENTIMENT='BEKLIYOR' kayıtlarını etiketler.
    Doğrudan daily_bist_news_job.py tarafından çağrılır.
    """
    import os
    import oracledb
    from pathlib import Path
    from dotenv import load_dotenv

    load_dotenv()

    ROOT_DIR = Path(__file__).resolve().parent
    WALLET_DIR = str(ROOT_DIR / "oracle_wallet")

    DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
    DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "")
    DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")

    _load_pipeline()
    if _pipeline is None:
        logger.warning("Sentiment modeli yüklenemedi, etiketleme atlanıyor.")
        return

    try:
        connection = oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            config_dir=WALLET_DIR,
            wallet_location=WALLET_DIR,
            wallet_password=DB_PASSWORD,
        )
    except Exception as exc:
        logger.error(f"Oracle bağlantı hatası (etiketleme): {exc}")
        return

    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT ID, SYMBOL, TITLE,
                   DBMS_LOB.SUBSTR(SUMMARY, 1000, 1),
                   DBMS_LOB.SUBSTR(CONTENT, 2000, 1)
            FROM BIST_NEWS
            WHERE SENTIMENT = 'BEKLIYOR'
            ORDER BY ID
            FETCH FIRST :bs ROWS ONLY
            """,
            {"bs": batch_size},
        )
        rows = cursor.fetchall()
    except Exception as exc:
        logger.error(f"BEKLIYOR sorgusu başarısız: {exc}")
        cursor.close()
        connection.close()
        return

    if not rows:
        logger.info("Etiketlenecek BEKLIYOR kayıt yok.")
        cursor.close()
        connection.close()
        return

    logger.info(f"{len(rows)} adet BEKLIYOR kayıt etiketlenecek.")

    updates: list[tuple] = []
    counts: dict[str, int] = {}

    for row_id, symbol, title, summary, content in rows:
        label, _ = predict_sentiment_for_ticker(
            symbol or "",
            title or "",
            summary or "",
            content or "",
        )
        # Oracle'da NÖTR değil NÖTR yazılır; ama normalize edelim
        if label == "NÖTR":
            label = "NÖTR"
        updates.append((label, row_id))
        counts[label] = counts.get(label, 0) + 1

    try:
        cursor.executemany(
            "UPDATE BIST_NEWS SET SENTIMENT = :1 WHERE ID = :2 AND SENTIMENT = 'BEKLIYOR'",
            updates,
        )
        connection.commit()
        logger.info(f"Etiketleme tamamlandı: {counts}")
    except Exception as exc:
        logger.error(f"UPDATE başarısız: {exc}")
    finally:
        cursor.close()
        connection.close()
