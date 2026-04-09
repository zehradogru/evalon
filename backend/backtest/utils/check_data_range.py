
import os
from bist_prices_client import BistPricesClient
from dotenv import load_dotenv

def check_data_range():
    load_dotenv()
    wallet_dir = os.path.join(os.path.dirname(__file__), "wallet")
    
    client = BistPricesClient(
        user=os.environ.get("ORACLE_DB_USER", "ADMIN"),
        password=os.environ.get("ORACLE_DB_PASSWORD"),
        dsn=os.environ.get("ORACLE_DB_DSN", "evalondb_high"),
        wallet_dir=wallet_dir,
        wallet_password=os.environ.get("ORACLE_WALLET_PASSWORD"),
        debug=True
    )
    
    print("Veritabanına bağlanılıyor...")
    
    with client._connect() as conn:
        with conn.cursor() as cur:
            print("Sorgu çalıştırılıyor...")
            # En eski ve en yeni tarih
            cur.execute("""
                SELECT 
                    MIN(PRICE_DATETIME) as earliest, 
                    MAX(PRICE_DATETIME) as latest, 
                    COUNT(*) as total_rows,
                    COUNT(DISTINCT TRUNC(PRICE_DATETIME)) as unique_days
                FROM BIST_PRICES
            """)
            row = cur.fetchone()
            earliest, latest, total_rows, unique_days = row
            
            print("-" * 40)
            print(f"Toplam Veri Sayısı: {total_rows:,}")
            print(f"Toplam Gün Sayısı : {unique_days}")
            print(f"En Eski Tarih     : {earliest}")
            print(f"En Yeni Tarih     : {latest}")
            print("-" * 40)
            
            # Gün bazında kayıt sayıları (son 5 gün)
            print("\nSon 5 Günlük Veri Dağılımı:")
            cur.execute("""
                SELECT TRUNC(PRICE_DATETIME) as day, COUNT(*) as cnt
                FROM BIST_PRICES
                GROUP BY TRUNC(PRICE_DATETIME)
                ORDER BY day DESC
                FETCH FIRST 90 ROWS ONLY
            """)
            for r in cur.fetchall():
                print(f"{r[0].date()}: {r[1]:,} kayıt")

if __name__ == "__main__":
    check_data_range()
