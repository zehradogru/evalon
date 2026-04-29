#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bist_mass_scraper.py
────────────────────
Tüm BIST tickerları için toplu haber çekici.
- Kaynak    : Google News (GNews, 2 sorgu/ticker) + RSS feed'leri (toplu batch)
- Dedup     : url_hash, mevcut tüm CSV'lerle karşılaştırır
- Resume    : scraper-data/mass_scraper_progress.json ile kaldığı yerden devam
- Anti-ban  : rastgele sleep, her 30 tickerda uzun mola
- Output    : bist-news-data/bist_haberler_YYYYMMDD_HHMMSS.csv
"""

import csv
import glob
import hashlib
import json
import random
import re
import socket
import sys
import time
from datetime import datetime
from pathlib import Path

import feedparser
import requests
from gnews import GNews

# Global socket timeout — GNews iç bağlantıları da kapsar
socket.setdefaulttimeout(25)

try:
    from googlenewsdecoder.new_decoderv1 import decode_google_news_url
    DECODER_OK = True
except ImportError:
    DECODER_OK = False

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR     = Path(__file__).resolve().parent
DATA_DIR     = ROOT_DIR / "bist-news-data"
SCRAPER_DATA = ROOT_DIR / "scraper-data"
PROGRESS_F   = SCRAPER_DATA / "mass_scraper_progress.json"
MARKETS_TS   = ROOT_DIR.parent.parent / "frontend" / "config" / "markets.ts"

# ── Config ────────────────────────────────────────────────────────────────────
CSV_FIELDS = [
    "market", "symbol", "source", "title", "summary", "content",
    "sentiment", "url", "author", "published_at", "scraped_at", "url_hash",
]

GNEWS_MAX           = 50        # her sorgu için max haber
GNEWS_PERIOD        = "1y"      # GNews dönemi
MAX_PER_TICKER      = 60        # ticker başına CSV'ye yazılacak max satır
MIN_SLEEP           = 3.0       # ticker arası min uyku (sn) — rate limit önleme
MAX_SLEEP           = 6.0       # ticker arası max uyku (sn)
BETWEEN_QUERIES_SLP = 1.5       # aynı ticker için sorgular arası uyku
LONG_BREAK_EVERY    = 25        # kaç tickerda bir uzun mola
LONG_BREAK_MIN      = 45.0      # uzun mola min (sn)
LONG_BREAK_MAX      = 75.0      # uzun mola max (sn)
ZERO_RESULT_SLEEP   = 25.0      # 0 sonuç gelince ek bekleme (rate limit)
SAVE_PROGRESS_EVERY = 1         # her tickerda progress'i diske yaz (crash koruması)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]

RSS_FEEDS = [
    ("Bloomberg HT",   "https://www.bloomberght.com/rss"),
    ("Dünya Gazetesi", "https://www.dunya.com/rss"),
    ("Bigpara",        "https://bigpara.hurriyet.com.tr/rss/"),
    ("Investing TR",   "https://tr.investing.com/rss/news.rss"),
    ("Hürriyet Finans","https://www.hurriyet.com.tr/rss/ekonomi"),
]


# ── Utilities ─────────────────────────────────────────────────────────────────
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()


def strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).replace("&nbsp;", " ").strip()


def format_date(dt_str: str) -> str:
    if not dt_str:
        return ""
    for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(dt_str, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return str(dt_str)


def rand_ua() -> str:
    return random.choice(USER_AGENTS)


def decode_url(url: str) -> str:
    """Google News proxy URL'sini gerçek URL'ye çözer. Başarısız olursa orijinali döner."""
    if not DECODER_OK:
        return url
    if "news.google.com" not in url:
        return url
    try:
        res = decode_google_news_url(url)
        if isinstance(res, dict) and res.get("status"):
            return res.get("decoded_url", url)
    except Exception:
        pass
    return url


# ── BIST tickers ──────────────────────────────────────────────────────────────
def load_bist_tickers() -> list:
    """markets.ts'den BIST_AVAILABLE listesini parse eder."""
    try:
        text = MARKETS_TS.read_text(encoding="utf-8")
        m = re.search(
            r"export const BIST_AVAILABLE\s*=\s*\[(.*?)\]\s*as const",
            text, re.DOTALL
        )
        if m:
            tickers = re.findall(r"'([A-Z0-9]+)'", m.group(1))
            print(f"[INFO] markets.ts'den {len(tickers)} BIST ticker yüklendi.")
            return tickers
    except Exception as e:
        print(f"[UYARI] markets.ts okunamadı: {e}")

    # Fallback
    json_path = ROOT_DIR / "bist_tickers.json"
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            tickers = json.load(f).get("tr", [])
            print(f"[INFO] bist_tickers.json'dan {len(tickers)} ticker yüklendi.")
            return tickers

    print("[HATA] Ticker listesi yüklenemedi!")
    return []


# ── Existing hashes ───────────────────────────────────────────────────────────
def load_existing_hashes() -> set:
    hashes = set()
    csv_files = glob.glob(str(DATA_DIR / "*.csv"))
    for csv_path in csv_files:
        try:
            with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    h = row.get("url_hash", "").strip()
                    if h:
                        hashes.add(h)
        except Exception:
            pass
    print(f"[INFO] Mevcut url_hash yüklendi: {len(hashes)} (dedup için)")
    return hashes


# ── Progress ──────────────────────────────────────────────────────────────────
def load_progress() -> dict:
    SCRAPER_DATA.mkdir(parents=True, exist_ok=True)
    if PROGRESS_F.exists():
        try:
            with open(PROGRESS_F, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_progress(progress: dict):
    with open(PROGRESS_F, "w") as f:
        json.dump(progress, f, indent=2)


# ── RSS batch fetch ───────────────────────────────────────────────────────────
def fetch_all_rss() -> list:
    """Tüm RSS feed'lerini bir kez çeker, ham entry listesi döndürür."""
    all_entries = []
    for source_name, feed_url in RSS_FEEDS:
        try:
            headers = {"User-Agent": rand_ua()}
            resp = requests.get(feed_url, headers=headers, timeout=12)
            feed = feedparser.parse(resp.content)
            for entry in feed.entries:
                entry["_source"] = source_name
            all_entries.extend(feed.entries)
            print(f"  [RSS] {source_name}: {len(feed.entries)} entry")
        except Exception as e:
            print(f"  [RSS HATA] {source_name}: {e}")
    print(f"[INFO] Toplam RSS entry: {len(all_entries)}")
    return all_entries


def filter_rss_for_symbol(
    entries: list, symbol: str, existing_hashes: set
) -> list:
    """RSS entry'lerinden sembolü geçenleri filtreler, row listesi döndürür."""
    rows = []
    sym_lower = symbol.lower()
    for entry in entries:
        title   = strip_html(getattr(entry, "title",   ""))
        summary = strip_html(getattr(entry, "summary", ""))
        link    = getattr(entry, "link", "")
        combined = (title + " " + summary).lower()
        if sym_lower not in combined:
            continue
        url_hash = sha256(link) if link else sha256(title)
        if url_hash in existing_hashes:
            continue
        existing_hashes.add(url_hash)
        rows.append({
            "market":       "TR",
            "symbol":       symbol,
            "source":       entry.get("_source", "RSS"),
            "title":        title,
            "summary":      summary,
            "content":      "",
            "sentiment":    "BEKLIYOR",
            "url":          link,
            "author":       "Bilinmiyor",
            "published_at": format_date(getattr(entry, "published", "")),
            "scraped_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "url_hash":     url_hash,
        })
    return rows


# ── GNews scraper ─────────────────────────────────────────────────────────────
def scrape_gnews(symbol: str, existing_hashes: set) -> list:
    """Bir sembol için GNews'ten haber çeker (iki farklı sorgu)."""
    gn = GNews(
        language="tr",
        country="TR",
        period=GNEWS_PERIOD,
        max_results=GNEWS_MAX,
    )

    # Endeks/ETF kodları için daha genel sorgu
    if symbol.startswith("X") or symbol.startswith("Z") or symbol.startswith("OP") or symbol.startswith("AP"):
        queries = [f"{symbol} borsa"]
    else:
        queries = [f"{symbol} hisse", f"{symbol} borsa"]

    rows = []
    seen = set()

    for qi, query in enumerate(queries):
        try:
            items = gn.get_news(query) or []
            if not items:
                continue
            for item in items:
                raw_url = item.get("url", "")
                title   = strip_html(item.get("title", ""))
                if not title:
                    continue

                url_hash = sha256(raw_url) if raw_url else sha256(title)
                if url_hash in existing_hashes or url_hash in seen:
                    continue

                actual_url = decode_url(raw_url)

                row = {
                    "market":       "TR",
                    "symbol":       symbol,
                    "source":       item.get("publisher", {}).get("title", "Google News"),
                    "title":        title,
                    "summary":      strip_html(item.get("description", "")),
                    "content":      "",
                    "sentiment":    "BEKLIYOR",
                    "url":          actual_url,
                    "author":       "Bilinmiyor",
                    "published_at": format_date(item.get("published date", "")),
                    "scraped_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "url_hash":     url_hash,
                }
                seen.add(url_hash)
                existing_hashes.add(url_hash)
                rows.append(row)

                if len(rows) >= MAX_PER_TICKER:
                    return rows

        except Exception as e:
            print(f"  [GNews HATA] '{query}': {e}")

        if qi < len(queries) - 1:
            time.sleep(BETWEEN_QUERIES_SLP)

    # Rate limit tespiti: sonuç gelmediyse ekstra bekle
    if not rows:
        print(f"  [UYARI] {symbol} GNews 0 sonuç → {ZERO_RESULT_SLEEP:.0f}s backoff", flush=True)
        time.sleep(ZERO_RESULT_SLEEP)

    return rows


# ── CSV writer ────────────────────────────────────────────────────────────────
def append_csv(rows: list, csv_path: Path):
    if not rows:
        return
    with open(csv_path, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writerows(rows)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SCRAPER_DATA.mkdir(parents=True, exist_ok=True)

    tickers        = load_bist_tickers()
    existing_hashes = load_existing_hashes()
    progress       = load_progress()
    done_tickers   = {k for k, v in progress.items() if v == "done"}

    print(f"[INFO] Toplam ticker: {len(tickers)} | Daha önce tamamlanan: {len(done_tickers)}")
    remaining = [t for t in tickers if t not in done_tickers]
    print(f"[INFO] Kalan ticker: {len(remaining)}")

    # Output CSV — çakışmayı önlemek için benzersiz dosya adı
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = DATA_DIR / f"bist_haberler_{ts}.csv"
    n = 1
    while csv_path.exists():
        csv_path = DATA_DIR / f"bist_haberler_{ts}_{n}.csv"
        n += 1
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        csv.DictWriter(f, fieldnames=CSV_FIELDS).writeheader()

    # RSS tek seferlik çek
    print("\n[RSS] RSS feed'leri yükleniyor...")
    rss_entries = fetch_all_rss()

    total_new  = 0
    done_count = 0

    print(f"\n{'='*65}")
    print(f"BIST MASS SCRAPER — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Output: {csv_path.name}")
    print(f"{'='*65}\n")

    # GNews rate limit sıfırlanması için başlangıç beklemesi
    INITIAL_WAIT = 60  # 1 dakika (resume)
    print(f"[INFO] GNews rate limit sıfırlama için {INITIAL_WAIT}s bekleniyor...")
    for remaining in range(INITIAL_WAIT, 0, -30):
        print(f"  {remaining}s kaldı...", flush=True)
        time.sleep(30)
    print("[INFO] Bekleme tamamlandı, scraping başlıyor!\n")

    for idx, symbol in enumerate(tickers, 1):
        if symbol in done_tickers:
            continue

        label = f"[{idx}/{len(tickers)}] {symbol}"
        print(f"{label:<35}", end="", flush=True)

        try:
            gnews_rows = scrape_gnews(symbol, existing_hashes)
            rss_rows   = filter_rss_for_symbol(rss_entries, symbol, existing_hashes)
            all_rows   = (gnews_rows + rss_rows)[:MAX_PER_TICKER]

            if all_rows:
                append_csv(all_rows, csv_path)
                total_new += len(all_rows)

            print(f"GNews={len(gnews_rows):>3}  RSS={len(rss_rows):>2}  │  Toplam={total_new}")

        except Exception as e:
            print(f"HATA: {e} — atlanıyor")

        progress[symbol] = "done"
        done_count += 1
        save_progress(progress)  # her tickerda kaydet

        # Uzun mola
        if done_count % LONG_BREAK_EVERY == 0:
            mola = random.uniform(LONG_BREAK_MIN, LONG_BREAK_MAX)
            print(f"\n  ── MOLA: {LONG_BREAK_EVERY} ticker tamamlandı → {mola:.1f}s bekleniyor ──\n")
            time.sleep(mola)
        else:
            time.sleep(random.uniform(MIN_SLEEP, MAX_SLEEP))

    save_progress(progress)

    print(f"\n{'='*65}")
    print(f"TAMAMLANDI — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Toplam yeni satır: {total_new}")
    print(f"Output: {csv_path}")
    print(f"{'='*65}")


if __name__ == "__main__":
    main()
