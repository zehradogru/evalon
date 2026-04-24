import oracledb
from dotenv import load_dotenv
import os

load_dotenv()

user = os.environ["ORACLE_DB_USER"]
password = os.environ["ORACLE_DB_PASSWORD"]
dsn = os.environ["ORACLE_DB_DSN"]
_raw_wallet = os.environ["ORACLE_WALLET_DIR"]
# .env'deki path script'in cwd'sine gore degil, .env'nin konumuna gore
_env_dir = os.path.dirname(os.path.abspath(".env"))
wallet_dir = os.path.normpath(os.path.join(_env_dir, _raw_wallet))
# Bulunamazsa news_scraper/oracle_wallet'ı dene
if not os.path.isdir(wallet_dir):
    wallet_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oracle_wallet")

print(f"Baglaniyor: user={user}, dsn={dsn}, wallet={wallet_dir}")

conn = oracledb.connect(user=user, password=password, dsn=dsn, config_dir=wallet_dir, wallet_location=wallet_dir, wallet_password=password)
cur = conn.cursor()

# Tüm NEWS tablolarını bul
cur.execute("SELECT table_name FROM user_tables WHERE table_name LIKE '%NEWS%' ORDER BY table_name")
tables = cur.fetchall()
print("NEWS tablolari:", [t[0] for t in tables])

# Her tablodaki satır sayısı
for (tbl,) in tables:
    cur.execute(f"SELECT COUNT(*) FROM {tbl}")
    count = cur.fetchone()[0]
    print(f"  {tbl}: {count} satir")

# BIST_NEWS varsa ilk 3 satırın kolonlarını da göster
if ("BIST_NEWS",) in tables:
    print("\nBIST_NEWS kolonlari:")
    cur.execute("SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'BIST_NEWS' ORDER BY column_id")
    for col in cur.fetchall():
        print(f"  {col[0]} ({col[1]})")
    print("\nBIST_NEWS ornek satirlar (ilk 3):")
    cur.execute("SELECT ID, SYMBOL, TITLE, SENTIMENT FROM BIST_NEWS FETCH FIRST 3 ROWS ONLY")
    for row in cur.fetchall():
        print(f"  {row}")

if ("BIST_NEWS_ARTICLES",) in tables:
    print("\nBIST_NEWS_ARTICLES kolonlari:")
    cur.execute("SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'BIST_NEWS_ARTICLES' ORDER BY column_id")
    for col in cur.fetchall():
        print(f"  {col[0]} ({col[1]})")

cur.close()
conn.close()
print("\nBitti.")
