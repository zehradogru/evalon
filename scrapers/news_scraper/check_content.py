import csv

with open("scrapers/news_scraper/bist-news-data/bist_haberler_ALL_content.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

gnews = [r for r in rows if r.get("content","").strip() and "news.google.com" in r.get("url","")]
other = [r for r in rows if r.get("content","").strip() and "news.google.com" not in r.get("url","")]
total_filled = len([r for r in rows if r.get("content","").strip()])

print(f"Toplam content dolu: {total_filled}")
print(f"  - Google News URL ile cekilen (yanlis olabilir): {len(gnews)}")
print(f"  - Diger URL (dogru): {len(other)}")
if gnews:
    print(f"\nGoogle News ornegi:")
    print(f"  URL: {gnews[0]['url'][:80]}")
    print(f"  Icerik: {gnews[0]['content'][:200]}")
