import os
import glob
import csv
import subprocess
import oracledb
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent
WALLET_DIR = str(ROOT_DIR / "oracle_wallet")
DATA_DIR = ROOT_DIR / "bist-news-data"

def get_latest_csv():
    list_of_files = glob.glob(str(DATA_DIR / "*haberler*.csv"))
    if not list_of_files:
        return None
    return max(list_of_files, key=os.path.getctime)

def parse_date(date_str):
    if not date_str: return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except:
        return None

def upload_to_oracle(csv_path):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Oracle veritabanina yaziliyor...")
    
    # Load env (Cloud Run uses standard environment variables, dotenv will gracefully fallback)
    from dotenv import load_dotenv
    load_dotenv()
    
    DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
    DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "Ahmetberknurzehra07!")
    DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")
    
    try:
        connection = oracledb.connect(
            user=DB_USER, 
            password=DB_PASSWORD, 
            dsn=DB_DSN, 
            config_dir=WALLET_DIR, 
            wallet_location=WALLET_DIR, 
            wallet_password=DB_PASSWORD
        )
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Baglanti Hatasi: {e}")
        return

    cursor = connection.cursor()

    sql = """
        INSERT INTO BIST_NEWS 
        (MARKET, SYMBOL, NEWS_SOURCE, TITLE, SUMMARY, CONTENT, SENTIMENT, NEWS_URL, AUTHOR, PUBLISHED_AT, SCRAPED_AT, URL_HASH)
        VALUES 
        (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12)
    """

    batch_size = 2000
    batch_data = []
    total_inserted = 0
    total_skipped = 0

    csv.field_size_limit(2147483647)

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            url = str(row.get("url", ""))[:2000]
            url_hash = str(row.get("url_hash", ""))[:64]
            if not url_hash:
                import hashlib
                url_hash = hashlib.sha256((url + str(row.get("title", ""))).encode('utf-8')).hexdigest()

            batch_data.append((
                str(row.get("market", ""))[:10],
                str(row.get("symbol", ""))[:20],
                str(row.get("source", ""))[:255],
                str(row.get("title", ""))[:1000],
                row.get("summary"),
                row.get("content"),
                str(row.get("sentiment", "BEKLIYOR"))[:50],
                url,
                str(row.get("author", "Bilinmiyor"))[:255],
                parse_date(row.get("published_at")),
                parse_date(row.get("scraped_at")),
                url_hash
            ))

            if len(batch_data) >= batch_size:
                try:
                    cursor.executemany(sql, batch_data, batcherrors=True)
                    connection.commit()
                    errors = cursor.getbatcherrors()
                    total_inserted += len(batch_data) - len(errors)
                    total_skipped += len(errors)
                except Exception as e:
                    print(f"Toplu Insert Hatasi: {e}")
                batch_data = []

        if batch_data:
            try:
                cursor.executemany(sql, batch_data, batcherrors=True)
                connection.commit()
                errors = cursor.getbatcherrors()
                total_inserted += (len(batch_data) - len(errors))
                total_skipped += len(errors)
            except Exception as e:
                print(f"Son parti Insert Hatasi: {e}")

    cursor.close()
    connection.close()
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Oracle Kaydi Tamamlandi: {total_inserted} yeni haber, {total_skipped} tekrar eden atlandi.")

def run_job():
    print("--------------------------------------------------")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Cloud Run - Daily BIST News Scrape Job Started")
    try:
        # 1. Haberi çekip geçici olarak yerel CSV dosyalarına kaydeder
        subprocess.run(["python", "collect_markets_news.py"], check=True)
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Haberler basariyla cekildi.")
        
        # 2. En son oluşturulan CSV dosyasını bulur ve Oracle'a atar
        latest_csv = get_latest_csv()
        if latest_csv:
            upload_to_oracle(latest_csv)
            # Cloud Run'da depolama geçici olduğu için istersen burada CSV'yi silebilirsin (temizlik)
            # os.remove(latest_csv) 
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Yeni CSV dosyasi bulunamadi!")
            
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Job Completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scraping esnasinda hata: {e}")
        # Return non-zero exit code so Cloud Run knows it failed
        exit(1)
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Beklenmeyen hata: {e}")
        exit(1)
    print("--------------------------------------------------")

if __name__ == "__main__":
    # Direkt çalıştır ve bitir (Cloud Run / OCI Serverless mantığı)
    run_job()
