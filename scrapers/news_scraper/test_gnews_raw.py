"""Google News URL raw response test."""
import csv, requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
}
MOBILE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
}

with open("scrapers/news_scraper/bist-news-data/bist_haberler_ALL.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

gnews_urls = [r["url"] for r in rows if "news.google.com" in r.get("url","")][:3]

for url in gnews_urls:
    print(f"\n=== URL: {url[:90]}")

    # Desktop
    try:
        r = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        print(f"  Desktop: status={r.status_code}, final_url={r.url[:80]}")
        print(f"  HTML snippet: {r.text[:300]}")
    except Exception as e:
        print(f"  Desktop error: {e}")

    # Mobile
    try:
        r = requests.get(url, headers=MOBILE_HEADERS, timeout=10, allow_redirects=True)
        print(f"  Mobile: status={r.status_code}, final_url={r.url[:80]}")
    except Exception as e:
        print(f"  Mobile error: {e}")
