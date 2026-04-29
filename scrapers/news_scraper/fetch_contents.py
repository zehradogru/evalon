"""
Mevcut bist_haberler_ALL.csv'deki boş content alanlarını doldurur.
newspaper3k ile her URL'den makale metni çeker.
Progress: her 100 satırda bir kaydeder, crash'e karşı güvenli.
Google News URL'leri için gerçek makale URL'si çözme desteği.
"""
import csv
import time
import random
import socket
import re
from pathlib import Path

import requests
from newspaper import Article
from bs4 import BeautifulSoup

socket.setdefaulttimeout(12)

CSV_PATH    = Path(__file__).parent / "bist-news-data" / "bist_haberler_ALL.csv"
OUT_PATH    = Path(__file__).parent / "bist-news-data" / "bist_haberler_ALL_content.csv"
SAVE_EVERY  = 100   # kaç satırda bir kaydet
SLEEP_MIN   = 0.3   # istek arası min bekleme (sn)
SLEEP_MAX   = 0.8   # istek arası max bekleme (sn)
MAX_CONTENT = 2000  # max karakter (db boyutu için)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
}

# Mobile UA — Google News bu ile HTTP redirect döner
MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/112.0.0.0 Mobile Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9",
}


def resolve_google_news_url(url: str) -> str:
    """Google News URL'sini gerçek makale URL'sine çevirir."""
    # Yöntem 1: RSS redirect trick (articles/ → __i/rss/rd/articles/)
    rss_url = url.replace("/articles/", "/__i/rss/rd/articles/", 1)
    if rss_url != url:
        try:
            resp = requests.get(rss_url, headers=HEADERS, timeout=12, allow_redirects=True)
            if resp.status_code == 200 and "news.google.com" not in resp.url:
                return resp.url
        except Exception:
            pass

    # Yöntem 2: Mobile UA ile HTTP redirect
    try:
        resp = requests.get(url, headers=MOBILE_HEADERS, timeout=12, allow_redirects=True)
        if resp.status_code == 200 and "news.google.com" not in resp.url:
            return resp.url
        # Yöntem 3: HTML parse — window.location veya og:url
        html = resp.text
        # window.location = "url"
        m = re.search(r'window\.location\s*=\s*["\']([^"\']+)["\']', html)
        if m and "google" not in m.group(1):
            return m.group(1)
        soup = BeautifulSoup(html, "html.parser")
        # og:url meta
        og = soup.find("meta", property="og:url")
        if og and og.get("content","").startswith("http") and "google" not in og.get("content",""):
            return og["content"]
        # canonical link
        canon = soup.find("link", rel="canonical")
        if canon and canon.get("href","").startswith("http") and "google" not in canon.get("href",""):
            return canon["href"]
        # İlk dış bağlantı
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http") and "google" not in href:
                return href
    except Exception:
        pass

    return ""


def fetch_content(url: str) -> str:
    # Google News URL'leri çekilemiyor (CAPTCHA) — atla
    if "news.google.com" in url:
        return ""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return ""
        a = Article(resp.url, language="tr")
        a.set_html(resp.text)
        a.parse()
        text = (a.text or "").strip()
        return text[:MAX_CONTENT]
    except Exception:
        return ""


def main():
    # Mevcut CSV'yi yükle
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
    total = len(rows)
    print(f"Toplam satır: {total}")

    # Eğer OUT_PATH varsa resume — zaten içeriği olanları oku ve sakla
    done_content = {}  # url_hash → content
    if OUT_PATH.exists():
        with open(OUT_PATH, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                c = r.get("content", "").strip()
                if c:
                    done_content[r["url_hash"]] = c
        print(f"Resume: {len(done_content)} URL zaten çekilmiş, atlanıyor")

    # Tüm satırları işle
    results = []
    fetched = 0
    skipped = 0
    failed  = 0
    gnews_skip = 0

    for i, row in enumerate(rows):
        url_hash = row.get("url_hash", "")
        content  = row.get("content", "").strip()

        # Zaten dolu veya daha önce çekildiyse atla (içeriği geri yükle)
        if content:
            results.append(row)
            skipped += 1
            continue
        if url_hash in done_content:
            row["content"] = done_content[url_hash]  # eski içeriği koru
            results.append(row)
            skipped += 1
            continue

        url = row.get("url", "")
        if not url:
            results.append(row)
            skipped += 1
            continue

        # Google News URL'lerini atla
        if "news.google.com" in url:
            results.append(row)
            gnews_skip += 1
            continue

        new_content = fetch_content(url)
        row["content"] = new_content
        results.append(row)

        if new_content:
            fetched += 1
        else:
            failed += 1

        # İlerleme
        done_total = fetched + failed + skipped + gnews_skip
        if done_total % 50 == 0:
            print(f"  [{done_total}/{total}] çekilen={fetched} başarısız={failed} atlanan={skipped} gnews={gnews_skip}", flush=True)

        # Her SAVE_EVERY satırda kaydet
        if len(results) % SAVE_EVERY == 0:
            _save(OUT_PATH, fieldnames, results)

        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    # Son kayıt
    _save(OUT_PATH, fieldnames, results)
    print(f"\nTAMAMLANDI — çekilen={fetched} başarısız={failed} atlanan={skipped} gnews_atlanan={gnews_skip}")
    print(f"Çıktı: {OUT_PATH}")


def _save(path, fieldnames, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
