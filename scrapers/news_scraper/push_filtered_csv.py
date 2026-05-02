import os
import sys
import csv
from pathlib import Path
import oracledb
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent
WALLET_DIR = str(ROOT_DIR / "oracle_wallet")
CSV_PATH = ROOT_DIR / "bist-news-data" / "bist_haberler_ALL_content.csv"

DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "Ahmetberknurzehra07!")
DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")

BIST_AVAILABLE = [
    'AEFES', 'AGHOL', 'AGROT', 'AHGAZ', 'AKBNK', 'AKCNS', 'AKENR', 'AKFGY', 'AKSA',  'AKSEN', 'ALARK', 'ALFAS',
    'ALGYO', 'ALTNY', 'ANSGR', 'ARCLK', 'ARDYZ', 'ASELS', 'ASTOR', 'BAGFS', 'BALSU', 'BIMAS', 'BIZIM', 'BRSAN',
    'BRYAT', 'BSOKE', 'BTCIM', 'CANTE', 'CCOLA', 'CIMSA', 'CLEBI', 'CWENE', 'DAPGM', 'DEVA',  'DOAS',  'DOHOL',
    'DSTKF', 'ECILC', 'EFOR',  'EGEEN', 'EKGYO', 'ENERY', 'ENJSA', 'ENKAI', 'ERCB',  'EREGL', 'EUPWR', 'FENER',
    'FROTO', 'GARAN', 'GENIL', 'GESAN', 'GLRMK', 'GRSEL', 'GRTHO', 'GSRAY', 'GUBRF', 'GWIND', 'HALKB', 'HEKTS',
    'ISCTR', 'ISGYO', 'ISMEN', 'IZENR', 'IZFAS', 'IZMDC', 'KAREL', 'KCAER', 'KCHOL', 'KLRHO', 'KONTR', 'KRDMD',
    'KTLEV', 'KUYAS', 'LOGO',  'MAGEN', 'MAVI',  'MGROS', 'MIATK', 'MPARK', 'NETAS', 'OBAMS', 'ODAS',  'OTKAR',
    'OYAKC', 'PASEU', 'PATEK', 'PETKM', 'PETUN', 'PGSUS', 'PNSUT', 'PRKME', 'QUAGR', 'RALYH', 'REEDR', 'SAHOL',
    'SASA',  'SELEC', 'SISE',  'SKBNK', 'SOKM',  'TABGD', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TMSN',  'TOASO',
    'TRALT', 'TRENJ', 'TRMET', 'TSKB',  'TSPOR', 'TTKOM', 'TTRAK', 'TUKAS', 'TUPRS', 'TUREX', 'TURSG', 'ULKER',
    'VAKBN', 'VESBE', 'VESTL', 'YEOTK', 'YKBNK', 'ZEDUR', 'ZOREN',
]

def parse_date(date_str):
    if not date_str: return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except:
        return None

def upload_news():
    from dotenv import load_dotenv
    load_dotenv()
    
    if not CSV_PATH.exists():
        print(f"CSV dosyasi bulunamadi: {CSV_PATH}")
        return

    print("Oracle DB baglaniliyor... (Thin Mode)")
    
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
        print(f"Baglanti Hatasi: {e}")
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

    print(f"\\nVeriler okutuluyor: {CSV_PATH.name}")
    csv.field_size_limit(2147483647)

    bist_set = set([x.upper() for x in BIST_AVAILABLE])

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            symbol = str(row.get("symbol", "")).upper()
            if symbol not in bist_set:
                continue

            url = str(row.get("url", ""))[:2000]
            url_hash = str(row.get("url_hash", ""))[:64]
            if not url_hash:
                import hashlib
                url_hash = hashlib.sha256((url + str(row.get("title", ""))).encode('utf-8')).hexdigest()

            batch_data.append((
                str(row.get("market", ""))[:10],
                symbol[:20],
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
                    inserted_this_batch = len(batch_data) - len(errors)
                    total_inserted += inserted_this_batch
                    total_skipped += len(errors)
                    print(f"{total_inserted} satir aktarildi... ({len(errors)} atlandi)")
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
                print(f"Son parti eklendi! Toplam: {total_inserted}")
            except Exception as e:
                print(f"Son parti Insert Hatasi: {e}")

    cursor.close()
    connection.close()

    print("\\n" + "="*50)
    print("YUKLEME ISLEMI BITTI!")
    print(f"Basariyla Yuklenen Haber: {total_inserted}")
    print(f"Tekrar Eden / Atlanan: {total_skipped}")
    print("="*50)

if __name__ == "__main__":
    upload_news()
