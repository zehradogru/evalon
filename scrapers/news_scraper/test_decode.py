"""Google News URL çözüm yöntemlerini test eder."""
import base64, re, csv, requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
}

with open("scrapers/news_scraper/bist-news-data/bist_haberler_ALL.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

gnews_urls = [r["url"] for r in rows if "news.google.com" in r.get("url","")][:5]

for url in gnews_urls:
    # Trick: /rss/articles/ → /articles/
    article_url = url.replace("/rss/articles/", "/articles/", 1)
    print(f"\nORJINAL:  {url[:80]}")
    print(f"DENENEN:  {article_url[:80]}")
    try:
        r = requests.get(article_url, headers=HEADERS, timeout=12, allow_redirects=True)
        final = r.url
        print(f"STATUS:   {r.status_code}")
        print(f"FINAL:    {final[:80]}")
        if "news.google.com" not in final:
            print(">>> REDIRECT BASARILI!")
    except Exception as e:
        print(f"HATA: {e}")


