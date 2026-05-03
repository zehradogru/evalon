import os, csv, oracledb
from datetime import datetime
from dotenv import load_dotenv

# dotenv'i scraper dizininden yükle (news scraper ile aynı)
load_dotenv('c:/Users/zehra/Masaüstü/evalonn/scrapers/news_scraper/.env')
wallet_dir = 'c:/Users/zehra/Masaüstü/evalonn/scrapers/news_scraper/oracle_wallet'

def get_connection():
    return oracledb.connect(
        user=os.environ['ORACLE_DB_USER'],
        password=os.environ['ORACLE_DB_PASSWORD'],
        dsn=os.environ['ORACLE_DB_DSN'],
        config_dir=wallet_dir,
        wallet_location=wallet_dir,
        wallet_password=os.environ['ORACLE_DB_PASSWORD']
    )

def setup_db():
    conn = get_connection()
    cur = conn.cursor()
    
    # Tablonun var olup olmadığını kontrol et
    cur.execute("SELECT count(*) FROM user_tables WHERE table_name = 'BIST_CALENDAR'")
    exists = cur.fetchone()[0]
    
    if not exists:
        print("BIST_CALENDAR tablosu oluşturuluyor...")
        cur.execute("""
            CREATE TABLE BIST_CALENDAR (
                ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                TICKER VARCHAR2(20),
                EVENT_DATE TIMESTAMP NOT NULL,
                EVENT_TYPE VARCHAR2(50) NOT NULL,
                EVENT_TITLE VARCHAR2(500) NOT NULL,
                IMPORTANCE NUMBER,
                SOURCE VARCHAR2(100),
                EXTRA VARCHAR2(4000),
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_event UNIQUE (TICKER, EVENT_DATE, EVENT_TYPE)
            )
        """)
        print("Tablo oluşturuldu.")
    else:
        print("BIST_CALENDAR tablosu zaten var.")
        
    cur.close()
    conn.close()

def parse_date(date_str):
    try:
        return datetime.strptime(date_str[:19], "%Y-%m-%d %H:%M:%S")
    except:
        return datetime.strptime(date_str[:10], "%Y-%m-%d")

def push_data(csv_file):
    conn = get_connection()
    cur = conn.cursor()
    
    inserted = 0
    skipped = 0
    
    with open(csv_file, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        
        for r in rows:
            try:
                dt = parse_date(r['event_date'])
                cur.execute("""
                    INSERT INTO BIST_CALENDAR (TICKER, EVENT_DATE, EVENT_TYPE, EVENT_TITLE, IMPORTANCE, SOURCE, EXTRA)
                    VALUES (:1, :2, :3, :4, :5, :6, :7)
                """, (r['ticker'], dt, r['event_type'], r['event_title'][:500], int(r.get('importance') or 1), r['source'], r.get('extra', '')))
                inserted += 1
            except Exception as e:
                print(f"Hata: {e} - Satır: {r}")
                skipped += 1
                
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"[{os.path.basename(csv_file)}] {inserted} eklendi, {skipped} atlandı (zaten var).")

if __name__ == "__main__":
    setup_db()
    push_data('c:/Users/zehra/Masaüstü/evalonn/scrapers/calendar_scraper/data/bist_calendar_20260502_233210.csv')
    push_data('c:/Users/zehra/Masaüstü/evalonn/scrapers/calendar_scraper/data/bist_calendar_20260502_234908.csv')
