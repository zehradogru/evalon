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

# Check existing tables
cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
print("Mevcut tablolar:")
for t in cur.fetchall():
    print(f"  {t[0]}")

# Check if BIST_CALENDAR exists
cur.execute("SELECT table_name FROM user_tables WHERE table_name = 'BIST_CALENDAR'")
exists = cur.fetchone()
print(f"\nBIST_CALENDAR tablosu: {'VAR' if exists else 'YOK'}")

cur.close()
conn.close()
