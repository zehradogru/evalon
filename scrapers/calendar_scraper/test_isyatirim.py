import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except: pass

import requests
from bs4 import BeautifulSoup

url = "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=THYAO"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
}

resp = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(resp.text, "lxml")

for i, table in enumerate(soup.find_all("table")):
    ths = [th.get_text(strip=True).lower() for th in table.find_all("th")]
    joined = " ".join(ths)
    
    is_temettu = "dağ. tarihi" in joined or ("temettü" in joined and "hisse" in joined)
    is_sermaye = "bedelsiz" in joined or ("sermaye" in joined and "oran" in joined)
    is_bilanco = any(kw in joined for kw in ["tarih", "dönem", "bilanço"]) and "temettü" not in joined
    
    if is_temettu or is_sermaye:
        marker = "TEMETTU" if is_temettu else "SERMAYE"
        print(f"\n=== Tablo {i} [{marker}] ===")
        print(f"  Headers: {ths}")
        rows = table.find_all("tr")[1:3]
        for j, row in enumerate(rows):
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            print(f"  Row {j}: {cells}")
