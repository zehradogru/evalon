#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BIST News Oracle Collector

BIST sembolleri için haberleri çoklu kaynaktan toplar.
1) Önce kontrol amaçlı JSON/CSV dosyasına kaydeder.
2) Sonra Oracle DB'ye yazar.

Oracle bağlantı ayarları, bist_oracle_collector.py ile aynıdır:
- ORACLE_DB_USER
- ORACLE_DB_PASSWORD
- ORACLE_DB_DSN
- ORACLE_WALLET_DIR
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import oracledb


# Workspace root: this script lives in borsa-1/news_microservice
ROOT_DIR = Path(__file__).resolve().parent
NEWS_DATA_DIR = ROOT_DIR.parent / "news-data"

# Make news-data/scraper package importable
sys.path.insert(0, str(NEWS_DATA_DIR))

from scraper.tr.scrapers import get_tr_scraper
from scraper.universal.scrapers import get_universal_scraper
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv(ROOT_DIR / ".env")

# ==================== DB CONFIG (same as bist_oracle_collector.py) ====================

DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD")        
DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")
WALLET_DIR = os.environ.get("ORACLE_WALLET_DIR", "../oracle_wallet")

# ==================== BIST SYMBOLS ====================

def load_tickers_from_json() -> List[str]:
    """bist_tickers.json dosyasından sembolleri oku ve döndür."""
    json_path = ROOT_DIR / "bist_tickers.json"
    if not json_path.exists():
        print(f"Uyarı: {json_path} bulunamadı! Boş liste dönülüyor.")
        return []
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # tr anahtarı altındaki listeyi döndür
            return data.get("tr", [])
    except Exception as e:
        print(f"Uyarı: {json_path} okunurken hata: {e}")
        return []

TICKERS_RAW = load_tickers_from_json()


# ==================== Helpers ====================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_any_datetime(value: Optional[str]) -> datetime:
    """Best-effort datetime parser for mixed RSS/API formats."""
    if not value:
        return datetime.now()

    text = str(value).strip()

    # Fast path: ISO-ish
    try:
        text_norm = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(text_norm)
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        pass

    # RSS-style fallback
    try:
        from email.utils import parsedate_to_datetime

        dt = parsedate_to_datetime(text)
        if dt is None:
            return datetime.now()
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return datetime.now()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def clean_tickers(limit_symbols: Optional[int] = None) -> List[str]:
    symbols = [t.strip().upper() for t in TICKERS_RAW if t and t.strip()]
    if limit_symbols and limit_symbols > 0:
        return symbols[:limit_symbols]
    return symbols


def article_to_row(article: Dict) -> Dict:
    url = article.get("url") or ""
    published_at_raw = article.get("published_at")
    scraped_at_raw = article.get("scraped_at")

    published_at = parse_any_datetime(published_at_raw)
    scraped_at = parse_any_datetime(scraped_at_raw)

    return {
        "market": (article.get("market") or "tr").lower(),
        "symbol": (article.get("symbol") or "GENERAL").upper(),
        "source_name": (article.get("source") or "unknown").lower(),
        "title": (article.get("title") or "")[:1000],
        "summary": article.get("summary") or "",
        "content": article.get("content") or "",
        "url": url[:2000],
        "author": (article.get("author") or "")[:200],
        "published_at": published_at,
        "scraped_at": scraped_at,
        "url_hash": sha256_text(url) if url else sha256_text((article.get("article_id") or "") + (article.get("title") or "")),
    }


def dedupe_rows(rows: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for row in rows:
        key = row.get("url_hash")
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


# ==================== Scraping ====================

def scrape_bist_news(symbols: List[str], per_source_limit: int, sleep_sec: float) -> Tuple[List[Dict], Dict[str, int]]:
    """Collects news from TR and universal sources for BIST symbols."""
    stats = {
        "hurriyet": 0,
        "bloomberght": 0,
        "investing_tr": 0,
        "google_news": 0,
        "errors": 0,
    }
    collected: List[Dict] = []

    print("\n[1/4] Scrapers initialize ediliyor...")
    hurriyet = get_tr_scraper("hurriyet")
    bloomberght = get_tr_scraper("bloomberght")
    investing_tr = get_tr_scraper("investing_tr")
    google_news = get_universal_scraper("google_news")

    # General TR economy feed once
    print("\n[2/4] Hürriyet genel ekonomi haberleri çekiliyor...")
    try:
        general_news = hurriyet.scrape_news("GENERAL", limit=per_source_limit)
        for item in general_news:
            collected.append(item.to_dict())
        stats["hurriyet"] += len(general_news)
        print(f"   Hürriyet: {len(general_news)} haber")
    except Exception as exc:
        stats["errors"] += 1
        print(f"   Hürriyet hata: {exc}")

    print(f"\n[3/4] {len(symbols)} sembol icin kaynaklar taraniyor...")
    for i, symbol in enumerate(symbols, 1):
        print(f"   [{i}/{len(symbols)}] {symbol}")

        # Bloomberg HT
        try:
            news = bloomberght.scrape_news(symbol, limit=per_source_limit)
            for item in news:
                collected.append(item.to_dict())
            stats["bloomberght"] += len(news)
            print(f"      bloomberght: +{len(news)}")
        except Exception as exc:
            stats["errors"] += 1
            print(f"      bloomberght hata: {exc}")

        # Investing TR
        try:
            news = investing_tr.scrape_news(symbol, limit=per_source_limit)
            for item in news:
                collected.append(item.to_dict())
            stats["investing_tr"] += len(news)
            print(f"      investing_tr: +{len(news)}")
        except Exception as exc:
            stats["errors"] += 1
            print(f"      investing_tr hata: {exc}")

        # Google News (TR language)
        try:
            news = google_news.scrape_news(symbol, limit=per_source_limit, language="tr")
            for item in news:
                collected.append(item.to_dict())
            stats["google_news"] += len(news)
            print(f"      google_news: +{len(news)}")
        except Exception as exc:
            stats["errors"] += 1
            print(f"      google_news hata: {exc}")

        time.sleep(max(sleep_sec, 0.0))

    return collected, stats


# ==================== Local Preview Save (JSON/CSV) ====================

def save_preview_files(rows: List[Dict], output_dir: Path) -> Tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"bist_news_preview_{ts}.json"
    csv_path = output_dir / f"bist_news_preview_{ts}.csv"

    # JSON raw
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(rows, jf, ensure_ascii=False, indent=2)

    # CSV normalized
    csv_fields = [
        "market",
        "symbol",
        "source_name",
        "title",
        "summary",
        "content",
        "url",
        "author",
        "published_at",
        "scraped_at",
        "url_hash",
    ]

    with open(csv_path, "w", encoding="utf-8", newline="") as cf:
        writer = csv.DictWriter(cf, fieldnames=csv_fields)
        writer.writeheader()
        for row in rows:
            serializable = dict(row)
            serializable["published_at"] = row.get("published_at").strftime("%Y-%m-%d %H:%M:%S") if isinstance(row.get("published_at"), datetime) else ""
            serializable["scraped_at"] = row.get("scraped_at").strftime("%Y-%m-%d %H:%M:%S") if isinstance(row.get("scraped_at"), datetime) else ""
            writer.writerow(serializable)

    return json_path, csv_path


# ==================== Oracle Save ====================

def get_db_connection() -> Optional[oracledb.Connection]:
    """Connects to Oracle using same env vars as bist_oracle_collector.py."""
    try:
        wallet_path = Path(WALLET_DIR)
        if wallet_path.exists():
            return oracledb.connect(
                user=DB_USER,
                password=DB_PASSWORD,
                dsn=DB_DSN,
                config_dir=str(wallet_path),
                wallet_location=str(wallet_path),
                wallet_password=DB_PASSWORD,
            )

        # Fallback for direct DSN usage when wallet not present
        return oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
        )
    except Exception as exc:
        print(f"DB baglanti hatasi: {exc}")
        return None


def ensure_news_table(connection: oracledb.Connection) -> None:
    cursor = connection.cursor()

    ddl_table = """
    BEGIN
        EXECUTE IMMEDIATE '
            CREATE TABLE BIST_NEWS_ARTICLES (
                ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                MARKET VARCHAR2(30) NOT NULL,
                SYMBOL VARCHAR2(20) NOT NULL,
                SOURCE_NAME VARCHAR2(100) NOT NULL,
                TITLE VARCHAR2(1000) NOT NULL,
                SUMMARY CLOB,
                CONTENT CLOB,
                URL VARCHAR2(2000),
                AUTHOR VARCHAR2(200),
                PUBLISHED_AT TIMESTAMP,
                SCRAPED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                URL_HASH VARCHAR2(64) NOT NULL,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT UK_BIST_NEWS_URL_HASH UNIQUE (URL_HASH)
            )
        ';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;
            ELSE RAISE;
            END IF;
    END;
    """

    ddl_idx_symbol = """
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_NEWS_SYMBOL ON BIST_NEWS_ARTICLES(SYMBOL)';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
    END;
    """

    ddl_idx_date = """
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_NEWS_PUBLISHED_AT ON BIST_NEWS_ARTICLES(PUBLISHED_AT)';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
    END;
    """

    try:
        cursor.execute(ddl_table)
        cursor.execute(ddl_idx_symbol)
        cursor.execute(ddl_idx_date)
        connection.commit()
        print("BIST_NEWS_ARTICLES tablo/index kontrolu tamamlandi.")
    finally:
        cursor.close()


def insert_news_rows(connection: oracledb.Connection, rows: List[Dict]) -> Tuple[int, int]:
    """Insert rows; skips duplicate URL_HASH (ORA-00001)."""
    insert_sql = """
        INSERT INTO BIST_NEWS_ARTICLES (
            MARKET, SYMBOL, SOURCE_NAME, TITLE, SUMMARY, CONTENT, URL, AUTHOR, PUBLISHED_AT, SCRAPED_AT, URL_HASH
        ) VALUES (
            :market, :symbol, :source_name, :title, :summary, :content, :url, :author, :published_at, :scraped_at, :url_hash
        )
    """

    inserted = 0
    duplicates = 0
    cursor = connection.cursor()

    try:
        for row in rows:
            try:
                cursor.execute(insert_sql, row)
                inserted += 1
            except Exception as exc:
                if "ORA-00001" in str(exc):
                    duplicates += 1
                    continue
                raise

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()

    return inserted, duplicates


# ==================== Main ====================

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="BIST haberlerini topla: once JSON/CSV, sonra Oracle",
    )
    parser.add_argument("--limit", type=int, default=25, help="Kaynak-basina sembol basina haber limiti")
    parser.add_argument("--max-symbols", type=int, default=0, help="Test icin sembol siniri (0=tumu)")
    parser.add_argument("--sleep", type=float, default=0.5, help="Semboller arasi bekleme (saniye)")
    parser.add_argument("--output-dir", default=str(ROOT_DIR / "news-data" / "scraper-data" / "tr" / "oracle_preview"), help="JSON/CSV cikti klasoru")
    parser.add_argument("--skip-db", action="store_true", help="Sadece JSON/CSV kaydet, DB yazma")
    parser.add_argument("--test-db", action="store_true", help="Sadece DB baglantisini test et")
    return parser


def main() -> None:
    args = build_parser().parse_args()

    print("=" * 70)
    print("BIST NEWS ORACLE COLLECTOR")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    if args.test_db:
        conn = get_db_connection()
        if conn:
            print(f"DB baglanti OK. Surum: {conn.version}")
            conn.close()
            return
        print("DB baglanti basarisiz.")
        return

    symbols = clean_tickers(args.max_symbols if args.max_symbols > 0 else None)
    print(f"Toplam sembol: {len(symbols)}")
    print(f"Kaynak limiti: {args.limit}")

    raw_articles, stats = scrape_bist_news(
        symbols=symbols,
        per_source_limit=max(args.limit, 1),
        sleep_sec=args.sleep,
    )

    rows = [article_to_row(item) for item in raw_articles]
    rows = dedupe_rows(rows)

    print("\n[4/4] JSON/CSV kaydi yapiliyor...")
    out_dir = Path(args.output_dir)
    json_path, csv_path = save_preview_files(rows, out_dir)

    print(f"JSON: {json_path}")
    print(f"CSV : {csv_path}")
    print(f"Toplam benzersiz haber: {len(rows)}")

    print("\nKaynak istatistikleri:")
    for key, val in stats.items():
        print(f"- {key}: {val}")

    print("\n-- DB'ye kaydetme işlemi kullanıcı isteği üzerine tamamen devre dışı bırakıldı. --")
    # if args.skip_db:
    #     print("\n--skip-db aktif, DB yazma atlandi.")
    #     return
    #
    # print("\nOracle DB'ye yaziliyor...")
    # conn = get_db_connection()
    # ... (DB kodlari iptal edildi)

    print("=" * 70)
    print(f"Bitis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)


if __name__ == "__main__":
    main()
