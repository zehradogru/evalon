import csv, requests, socket
from newspaper import Article

socket.setdefaulttimeout(10)
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}

with open("scrapers/news_scraper/bist-news-data/bist_haberler_ALL.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

error_types = {}
ok = 0
tested = 0

for row in rows:
    url = row.get("url", "")
    if not url:
        continue
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            a = Article(url, language="tr")
            a.set_html(resp.text)
            a.parse()
            chars = len(a.text or "")
            print(f"OK [{resp.status_code}] {chars}ch  {url[:80]}")
            ok += 1
        else:
            key = f"HTTP{resp.status_code}"
            error_types[key] = error_types.get(key, 0) + 1
            print(f"{key}  {url[:80]}")
    except Exception as e:
        key = type(e).__name__
        error_types[key] = error_types.get(key, 0) + 1
        print(f"ERR {key}: {str(e)[:80]}")
        print(f"    URL: {url[:80]}")
    tested += 1
    if tested >= 20:
        break

print("\n--- ÖZET ---")
print(f"OK: {ok}, Hatalı: {tested-ok}")
print("Hata tipleri:", error_types)
