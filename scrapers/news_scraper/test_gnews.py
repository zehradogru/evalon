"""Google News URL çözümünü test eder."""
import sys, os
os.chdir("C:/Users/zehra/Masaüstü/evalonn")
sys.path.insert(0, "scrapers/news_scraper")

from fetch_contents import resolve_google_news_url, fetch_content
import csv

with open("scrapers/news_scraper/bist-news-data/bist_haberler_ALL.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

gnews_rows = [r for r in rows if "news.google.com" in r.get("url","")][:5]
for r in gnews_rows:
    url = r["url"]
    print(f"\nORJINAL: {url[:80]}")
    real = resolve_google_news_url(url)
    print(f"COZULDU: {real[:80] if real else '--- BASARISIZ ---'}")
    if real:
        content = fetch_content(url)
        print(f"ICERIK : {content[:120] if content else '--- BOSH ---'}")

    article = google_news.get_full_article(n['url'])
    print("URL:", n['url'])
    if article:
        print("CONTENT LEN:", len(article.text))
        print("CONTENT:", article.text[:200])
    else:
        print("CONTENT_LEN: failed")
