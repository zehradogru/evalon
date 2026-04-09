import oracledb
import pandas as pd
import os

# Oracle veritabanı bilgileri (Eğer çevre değişkeni yoksa kodu test edebilin diye direkt şifrenizi ekledim)
DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "Ahmetberknurzehra07!")
DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")

# Cüzdanınızın yolu - Mac'inizdeki borsa-1 içindeki oracle_wallet
WALLET_DIR = "/Users/aliberkyesilduman/borsa-1/oracle_wallet"

def get_historical_data_for(ticker, limit=100):
    """
    Belirli bir hissenin 1 saatlik verilerini Oracle'dan Pandas DataFrame'ine çevirir.
    Limit parametresi ile kaç satır çekmek isteğinizi ayarlayabilirsiniz.
    """
    print(f"📡 Veritabanına bağlanılıyor... {ticker} aranıyor")
    
    try:
        # Cüzdan (Wallet) ile Autonomous DB'ye güvenli bağlanım
        conn = oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            config_dir=WALLET_DIR,
            wallet_location=WALLET_DIR,
            wallet_password=DB_PASSWORD
        )
        
        query = f"""
            SELECT TICKER, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME
            FROM BIST_PRICES_1H
            WHERE TICKER = '{ticker}'
            ORDER BY PRICE_DATETIME DESC
            FETCH FIRST {limit} ROWS ONLY
        """
        
        # Pandas ile doğrudan SQL sorgusunu çalıştırıp veriyi DataFrame içine alıyoruz.
        df = pd.read_sql(query, conn)
        
        conn.close()
        return df

    except Exception as e:
        print(f"❌ HATA: {e}")
        return pd.DataFrame() # hata durumunda boş df döner

if __name__ == "__main__":
    # Test Amaçlı: THYAO (Türk Hava Yolları) hissesinin verisini çekiyoruz
    target_ticker = "THYAO" 
    
    # İster tüm veriyi (limit'i kaldırarak veya 10000 yaparak), ister son X mumu çekin
    df_thyao = get_historical_data_for(target_ticker, limit=5)
    
    if not df_thyao.empty:
        print(f"\n📊 {target_ticker} için Oracle'dan çekilen en güncel 5 adet 1-Saatlik Mum:\n")
        print(df_thyao)
        print("\n✅ Veriler başarıyla Pandas verisetine eklendi. Artık bu df'i matplotlib veya ML (yapay zeka) modelinize besleyebilirsiniz!")
    else:
        print("Uyarı: Veri bulunamadı veya bağlantı hatası oluştu.")
