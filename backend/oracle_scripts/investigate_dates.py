import oracledb
import os
from datetime import datetime

# Ayarlar
DB_USER = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN = "evalondb_high"
WALLET_DIR = "/Users/aliberkyesilduman/borsa-1/oracle_wallet"

def investigate():
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
        
        target_dates = ['2026-01-21', '2026-01-22', '2026-01-23']
        
        print(f"\n🔍 Hedef Tarihler: {', '.join(target_dates)}")
        
        for date_str in target_dates:
            print(f"\n📅 Tarih: {date_str}")
            
            # O gün için toplam hisse sayısı (işlem gören)
            cursor.execute("""
                SELECT COUNT(DISTINCT TICKER) 
                FROM BIST_PRICES 
                WHERE TRUNC(PRICE_DATETIME) = TO_DATE(:dt, 'YYYY-MM-DD')
            """, {'dt': date_str})
            active_tickers = cursor.fetchone()[0]
            print(f"  • İşlem Gören Hisse Sayısı: {active_tickers}/127")
            
            # En az veri noktasına sahip 5 hisse
            print("  • En AZ verisi olan hisseler (Düşük Hacim Kontrolü):")
            cursor.execute("""
                SELECT TICKER, COUNT(*) as cnt
                FROM BIST_PRICES
                WHERE TRUNC(PRICE_DATETIME) = TO_DATE(:dt, 'YYYY-MM-DD')
                GROUP BY TICKER
                ORDER BY cnt ASC
                FETCH FIRST 5 ROWS ONLY
            """, {'dt': date_str})
            
            for row in cursor.fetchall():
                print(f"    - {row[0]}: {row[1]} dakika")

        conn.close()
        
    except Exception as e:
        print(f"❌ HATA: {e}")

if __name__ == "__main__":
    investigate()
