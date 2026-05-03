import os, oracledb
from dotenv import load_dotenv
load_dotenv('c:/Users/zehra/Masaüstü/evalonn/scrapers/news_scraper/.env')
wallet_dir = 'c:/Users/zehra/Masaüstü/evalonn/scrapers/news_scraper/oracle_wallet'
conn = oracledb.connect(
    user=os.environ['ORACLE_DB_USER'],
    password=os.environ['ORACLE_DB_PASSWORD'],
    dsn=os.environ['ORACLE_DB_DSN'],
    config_dir=wallet_dir,
    wallet_location=wallet_dir,
    wallet_password=os.environ['ORACLE_DB_PASSWORD']
)
cur = conn.cursor()
cur.execute("DELETE FROM BIST_NEWS WHERE SCRAPED_AT >= TO_TIMESTAMP('2026-05-02 20:36:00', 'YYYY-MM-DD HH24:MI:SS')")
deleted = cur.rowcount
conn.commit()
print(f'{deleted} haber silindi')
cur.execute('SELECT COUNT(*) FROM BIST_NEWS')
print(f'Kalan toplam: {cur.fetchone()[0]}')
cur.close()
conn.close()
