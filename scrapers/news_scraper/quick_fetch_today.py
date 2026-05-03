"""
Bugünün BIST haberlerini çekip doğrudan Oracle DB'ye yazan hızlı script.
Sadece önemli hisseleri çeker, tüm listeyi değil.
"""
import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except: pass

import hashlib
import re
import time
import csv
from datetime import datetime
from pathlib import Path

from gnews import GNews
from googlenewsdecoder.new_decoderv1 import decode_google_news_url
import newspaper
import oracledb
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

WALLET_DIR = str(ROOT_DIR / "oracle_wallet")

TOP_SYMBOLS = [
    "THYAO", "ASELS", "EREGL", "GARAN", "AKBNK", "ISCTR", "SAHOL",
    "KCHOL", "BIMAS", "TUPRS", "FROTO", "SISE", "TOASO", "TCELL",
    "PGSUS", "HALKB", "VAKBN", "YKBNK", "ARCLK", "DOAS", "ENKAI",
    "PETKM", "MGROS", "CCOLA", "TAVHL", "TKFEN", "AEFES"
]

def strip_html(text):
    if not text: return ""
    return re.sub(r'<[^>]+>', '', text).replace('&nbsp;', ' ').strip()

def sha256(text):
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()

def format_date(dt_str):
    if not dt_str: return None
    try:
        dt = datetime.strptime(dt_str, "%a, %d %b %Y %H:%M:%S %Z")
        return dt
    except:
        return None

def main():
    gn = GNews(language='tr', country='TR', period='2d', max_results=15)
    
    conn = oracledb.connect(
        user=os.environ['ORACLE_DB_USER'],
        password=os.environ['ORACLE_DB_PASSWORD'],
        dsn=os.environ['ORACLE_DB_DSN'],
        config_dir=WALLET_DIR,
        wallet_location=WALLET_DIR,
        wallet_password=os.environ['ORACLE_DB_PASSWORD']
    )
    cursor = conn.cursor()
    
    sql = """INSERT INTO BIST_NEWS 
        (MARKET, SYMBOL, NEWS_SOURCE, TITLE, SUMMARY, CONTENT, SENTIMENT, NEWS_URL, AUTHOR, PUBLISHED_AT, SCRAPED_AT, URL_HASH)
        VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12)"""
    
    total_inserted = 0
    total_skipped = 0
    
    for i, sym in enumerate(TOP_SYMBOLS, 1):
        print(f"\n[{i}/{len(TOP_SYMBOLS)}] {sym} haberleri cekiliyor...")
        try:
            news = gn.get_news(f"{sym} hisse")
            if not news:
                print(f"  Haber bulunamadi")
                continue
                
            for item in news:
                url = item.get("url", "")
                title = item.get("title", "")
                url_hash = sha256(url) if url else sha256(title)
                
                # Icerik cek
                content = ""
                try:
                    dec = decode_google_news_url(url)
                    actual_url = dec.get("decoded_url") if isinstance(dec, dict) and dec.get("status") else url
                    url = actual_url
                    
                    config = newspaper.Config()
                    config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    article = newspaper.Article(actual_url, language='tr', config=config)
                    article.download()
                    article.parse()
                    if hasattr(article, 'text') and article.text:
                        content = strip_html(article.text)
                except:
                    pass
                
                pub_date = format_date(item.get("published date"))
                source = item.get('publisher', {}).get('title', 'Google News')
                
                row = (
                    "TR", sym, source[:255], title[:1000],
                    strip_html(item.get("description", "")),
                    content, "BEKLIYOR", url[:2000],
                    "Bilinmiyor", pub_date,
                    datetime.now(), url_hash[:64]
                )
                
                try:
                    cursor.execute(sql, row)
                    conn.commit()
                    total_inserted += 1
                    print(f"  + {title[:60]}...")
                except oracledb.IntegrityError:
                    total_skipped += 1
                except Exception as e:
                    print(f"  DB Hata: {e}")
                
                time.sleep(0.5)
                
        except Exception as e:
            print(f"  Hata: {e}")
        
        time.sleep(1)
    
    cursor.close()
    conn.close()
    print(f"\n{'='*50}")
    print(f"TAMAMLANDI! {total_inserted} yeni haber, {total_skipped} tekrar eden")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
