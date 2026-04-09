
import oracledb
import os
from datetime import datetime

# Ayarlar
DB_USER = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN = "evalondb_high"
WALLET_DIR = "/Users/aliberkyesilduman/borsa-1/oracle_wallet"

def check_stats():
    print("📡 Veritabanına bağlanılıyor...")
    
    try:
        conn = oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            config_dir=WALLET_DIR,
            wallet_location=WALLET_DIR,
            wallet_password=DB_PASSWORD
        )
        
        cursor = conn.cursor()
        
        # Genel İstatistikler
        cursor.execute("""
            SELECT 
                MIN(PRICE_DATETIME) as earliest, 
                MAX(PRICE_DATETIME) as latest, 
                COUNT(*) as total_rows,
                COUNT(DISTINCT TRUNC(PRICE_DATETIME)) as unique_days
            FROM BIST_PRICES
        """)
        earliest, latest, total_rows, unique_days = cursor.fetchone()
        
        print("\n" + "="*40)
        print("📊 VERİTABANI İSTATİSTİKLERİ")
        print("="*40)
        print(f"Toplam Veri Sayısı: {total_rows:,}")
        print(f"Toplam Gün Sayısı : {unique_days}")
        print(f"En Eski Veri      : {earliest}")
        print(f"En Yeni Veri      : {latest}")
        print("-" * 40)
        
        # Gün Bazlı Dağılım
        print("\n📅 Gün Bazlı Kayıt Sayıları:")
        cursor.execute("""
            SELECT TRUNC(PRICE_DATETIME) as day, COUNT(*) as cnt
            FROM BIST_PRICES
            GROUP BY TRUNC(PRICE_DATETIME)
            ORDER BY day DESC
        """)
        
        for row in cursor.fetchall():
            day = row[0].date() if row[0] else "N/A"
            count = row[1]
            print(f"  • {day}: {count:,} kayıt")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ HATA: {e}")

if __name__ == "__main__":
    check_stats()
