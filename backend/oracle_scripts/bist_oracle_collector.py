#!/usr/bin/env python3
"""
BIST Hisse Senedi Veri Toplayıcı - Oracle Cloud Database Versiyonu
1 dakikalık aralıklarla BIST hisse verilerini çeker ve Oracle Autonomous DB'ye kaydeder.
VM üzerinde çalıştırılmak üzere tasarlanmıştır.
"""

import yfinance as yf
import oracledb
import os
import time
from datetime import datetime, timedelta
import json

# ==================== YAPILANDIRMA ====================

# Oracle DB Bağlantı Ayarları
DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "SIFREYI_BURAYA_YAZ")  # Environment variable önerilir
DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")
WALLET_DIR = os.environ.get("ORACLE_WALLET_DIR", "/home/opc/wallet")

# Hisse Listesi
TICKERS_RAW = [
    "AEFES","AGHOL","AKBNK","AKSA","AKSEN","ALARK","ALTNY","ANSGR","ARCLK","ASELS",
    "ASTOR","BALSU","BIMAS","BRSAN","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA",
    "CWENE","DAPGM","DOAS","DOHOL","DSTKF","ECILC","EFOR","EGEEN","EKGYO","ENERY",
    "ENJSA","ENKAI","EREGL","EUPWR","FENER","FROTO","GARAN","GENIL","GESAN","GLRMK",
    "GRSEL","GRTHO","GSRAY","GUBRF","HALKB","HEKTS","ISCTR","ISMEN","IZENR","KCAER",
    "KCHOL","KLRHO","KONTR","KRDMD","KTLEV","KUYAS","MAGEN","MAVI","MGROS","MIATK",
    "MPARK","OBAMS","ODAS","OTKAR","OYAKC","PASEU","PATEK","PETKM","PGSUS","QUAGR",
    "RALYH","REEDR","SAHOL","SASA","SISE","SKBNK","SOKM","TABGD","TAVHL","TCELL",
    "THYAO","TKFEN","TOASO","TRALT","TRENJ","TRMET","TSKB","TSPOR","TTKOM","TTRAK",
    "TUKAS","TUPRS","TUREX","TURSG","ULKER","VAKBN","VESTL","YEOTK","YKBNK","ZOREN",
    "AKCNS", "AKENR", "AKFGY", "ALGYO", "ALFAS", "AHGAZ", "AGROT", "ARDYZ", "BAGFS",
    "BIZIM", "CLEBI", "DEVA", "GWIND", "ISGYO", "KAREL", "LOGO", "NETAS", "PETUN",
    "PNSUT", "SELEC", "TMSN", "VESBE", "ZEDUR", "IZFAS",
    "IZMDC", "PRKME", "ERCB"
]

# ==================== VERİTABANI FONKSİYONLARI ====================

def get_db_connection():
    """Oracle Autonomous Database'e bağlantı oluşturur."""
    try:
        connection = oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            config_dir=WALLET_DIR,
            wallet_location=WALLET_DIR,
            wallet_password=DB_PASSWORD
        )
        return connection
    except Exception as e:
        print(f"❌ Veritabanı bağlantı hatası: {e}")
        return None

def create_tables_if_not_exists(connection):
    """Gerekli tabloları oluşturur (yoksa)."""
    cursor = connection.cursor()
    
    # Ana fiyat verisi tablosu - TIMESTAMP WITH TIME ZONE UNIQUE olamaz, VARCHAR2 kullanıyoruz
    create_price_table = """
    BEGIN
        EXECUTE IMMEDIATE '
            CREATE TABLE BIST_PRICES (
                ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                TICKER VARCHAR2(20) NOT NULL,
                PRICE_DATETIME_STR VARCHAR2(50) NOT NULL,
                PRICE_DATETIME TIMESTAMP NOT NULL,
                OPEN_PRICE NUMBER(18,6),
                HIGH_PRICE NUMBER(18,6),
                LOW_PRICE NUMBER(18,6),
                CLOSE_PRICE NUMBER(18,6),
                VOLUME NUMBER(20),
                DIVIDENDS NUMBER(18,6),
                STOCK_SPLITS NUMBER(18,6),
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT UK_BIST_PRICES UNIQUE (TICKER, PRICE_DATETIME_STR)
            )
        ';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;
            ELSE RAISE;
            END IF;
    END;
    """
    
    # Koleksiyon log tablosu
    create_log_table = """
    BEGIN
        EXECUTE IMMEDIATE '
            CREATE TABLE COLLECTION_LOG (
                ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                TICKER VARCHAR2(20) NOT NULL,
                COLLECTION_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                RECORDS_ADDED NUMBER,
                STATUS VARCHAR2(50),
                ERROR_MESSAGE VARCHAR2(4000)
            )
        ';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;
            ELSE RAISE;
            END IF;
    END;
    """
    
    # İndeksler
    create_indexes = """
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_TICKER ON BIST_PRICES(TICKER)';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
    END;
    """
    
    create_indexes2 = """
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_DATETIME ON BIST_PRICES(PRICE_DATETIME)';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
    END;
    """
    
    try:
        cursor.execute(create_price_table)
        cursor.execute(create_log_table)
        cursor.execute(create_indexes)
        cursor.execute(create_indexes2)
        connection.commit()
        print("✅ Tablolar kontrol edildi/oluşturuldu.")
    except Exception as e:
        print(f"⚠️ Tablo oluşturma uyarısı: {e}")
    finally:
        cursor.close()

def get_last_datetime_for_ticker(connection, ticker):
    """Bir hisse için veritabanındaki en son kayıt tarihini döndürür."""
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT MAX(PRICE_DATETIME) FROM BIST_PRICES WHERE TICKER = :ticker
        """, {"ticker": ticker})
        result = cursor.fetchone()
        return result[0] if result and result[0] else None
    except Exception as e:
        print(f"⚠️ Son tarih sorgulama hatası ({ticker}): {e}")
        return None
    finally:
        cursor.close()

def insert_price_data(connection, ticker, df):
    """Fiyat verilerini veritabanına ekler."""
    if df.empty:
        return 0
    
    cursor = connection.cursor()
    inserted_count = 0
    
    # Basit INSERT kullan, duplicate olursa atla
    insert_sql = """
        INSERT INTO BIST_PRICES (TICKER, PRICE_DATETIME_STR, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME, DIVIDENDS, STOCK_SPLITS)
        VALUES (:ticker, :dt_str, TO_TIMESTAMP(:dt_ts, 'YYYY-MM-DD HH24:MI:SS'), :open, :high, :low, :close, :volume, :dividends, :splits)
    """
    
    try:
        for idx, row in df.iterrows():
            dt_str = idx.strftime('%Y-%m-%d %H:%M:%S %z')
            dt_ts = idx.strftime('%Y-%m-%d %H:%M:%S')
            
            try:
                cursor.execute(insert_sql, {
                    "ticker": ticker,
                    "dt_str": dt_str,
                    "dt_ts": dt_ts,
                    "open": float(row['Open']) if row['Open'] else None,
                    "high": float(row['High']) if row['High'] else None,
                    "low": float(row['Low']) if row['Low'] else None,
                    "close": float(row['Close']) if row['Close'] else None,
                    "volume": int(row['Volume']) if row['Volume'] else 0,
                    "dividends": float(row.get('Dividends', 0)),
                    "splits": float(row.get('Stock Splits', 0))
                })
                inserted_count += 1
            except Exception as row_err:
                # Duplicate key hatası ise atla (ORA-00001)
                if "ORA-00001" in str(row_err):
                    continue
                else:
                    raise row_err
        
        connection.commit()
        print(f"   💾 {inserted_count} kayıt eklendi")
    except Exception as e:
        print(f"❌ Veri ekleme hatası ({ticker}): {e}")
        connection.rollback()
    finally:
        cursor.close()
    
    return inserted_count

def log_collection(connection, ticker, records_added, status, error_message=None):
    """Koleksiyon işlemini loglar."""
    cursor = connection.cursor()
    try:
        cursor.execute("""
            INSERT INTO COLLECTION_LOG (TICKER, RECORDS_ADDED, STATUS, ERROR_MESSAGE)
            VALUES (:ticker, :records, :status, :error)
        """, {
            "ticker": ticker,
            "records": records_added,
            "status": status,
            "error": error_message[:4000] if error_message else None
        })
        connection.commit()
    except Exception as e:
        print(f"⚠️ Log yazma hatası: {e}")
    finally:
        cursor.close()

# ==================== VERİ ÇEKME FONKSİYONLARI ====================

def get_bist_tickers():
    """Hisse listesini Yahoo Finance formatına çevirir."""
    clean_tickers = [t.strip().upper() for t in TICKERS_RAW]
    return [f"{t}.IS" for t in clean_tickers if not t.endswith(".IS")]

def fetch_stock_data(ticker, last_datetime=None):
    """Yahoo Finance'den 1 dakikalık veri çeker."""
    print(f"📊 {ticker} verisi çekiliyor...")
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker)
            # Yahoo Finance 1m veri için maksimum 7 gün veriyor
            df = stock.history(period="5d", interval="1m")
            
            if df.empty:
                if attempt < max_retries - 1:
                    print(f"⏳ Boş veri, 3 saniye bekleniyor...")
                    time.sleep(3)
                    continue
                print(f"⚠️ {ticker} için veri bulunamadı!")
                return None
            
            # Eğer son tarih varsa, sadece yeni verileri al
            if last_datetime:
                # Timezone uyumu
                # df.index genellikle aware (yfinance). last_datetime Oracle'dan geliyorsa naive olabilir.
                if df.index.tz is not None:
                    if last_datetime.tzinfo is None:
                        # last_datetime naive ise, df'in timezone'unu varsay
                        # Önce pandas Timestamp'e çevirip localize etmek daha güvenli
                        import pandas as pd
                        last_datetime = pd.Timestamp(last_datetime).tz_localize(df.index.tz)
                    else:
                        last_datetime = last_datetime.astimezone(df.index.tz)
                elif df.index.tz is None and last_datetime.tzinfo is not None:
                     # df naive, last_datetime aware -> last_datetime'i naive yap
                     last_datetime = last_datetime.replace(tzinfo=None)

                df = df[df.index > last_datetime]
            
            print(f"✅ {ticker}: {len(df)} yeni veri noktası")
            return df
            
        except Exception as e:
            if "Rate limited" in str(e) or "Too Many Requests" in str(e):
                wait_time = (attempt + 1) * 10
                print(f"⏳ Rate limit, {wait_time} saniye bekleniyor... (Deneme {attempt+1}/{max_retries})")
                time.sleep(wait_time)
            else:
                print(f"❌ {ticker} verisi çekilirken hata: {e}")
                return None
    
    return None

# ==================== ANA FONKSİYON ====================

def collect_all_data():
    """Tüm hisseler için veri toplar ve veritabanına kaydeder."""
    print("="*60)
    print("🏦 BIST Veri Toplayıcı - Oracle Cloud Database")
    print(f"📅 Başlangıç: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # Veritabanı bağlantısı
    connection = get_db_connection()
    if not connection:
        print("❌ Veritabanına bağlanılamadı. Çıkılıyor...")
        return
    
    print(f"✅ Veritabanına bağlandı: {connection.version}")
    
    # Tabloları oluştur
    create_tables_if_not_exists(connection)
    
    tickers = get_bist_tickers()
    total_tickers = len(tickers)
    total_records = 0
    successful = 0
    failed = 0
    
    print(f"\n📋 {total_tickers} hisse işlenecek...\n")
    
    for i, ticker in enumerate(tickers, 1):
        symbol = ticker.replace(".IS", "")
        print(f"[{i}/{total_tickers}] ", end="")
        
        try:
            # Son kayıt tarihini al
            last_dt = get_last_datetime_for_ticker(connection, symbol)
            if last_dt:
                print(f"(Son kayıt: {last_dt.strftime('%Y-%m-%d %H:%M')}) ", end="")
            
            # Veri çek
            df = fetch_stock_data(ticker, last_dt)
            
            if df is not None and not df.empty:
                # Veritabanına kaydet
                records = insert_price_data(connection, symbol, df)
                total_records += records
                log_collection(connection, symbol, records, "SUCCESS")
                successful += 1
            else:
                log_collection(connection, symbol, 0, "NO_DATA")
                
        except Exception as e:
            print(f"❌ Hata: {e}")
            log_collection(connection, symbol, 0, "ERROR", str(e))
            failed += 1
        
        # Rate limit için bekleme
        time.sleep(1.5)
    
    # Özet
    print("\n" + "="*60)
    print("📊 TOPLAMA ÖZET")
    print("="*60)
    print(f"✅ Başarılı: {successful}/{total_tickers}")
    print(f"❌ Başarısız: {failed}/{total_tickers}")
    print(f"📝 Toplam Kayıt: {total_records}")
    print(f"⏱️ Bitiş: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    connection.close()

def test_connection():
    """Veritabanı bağlantısını test eder."""
    print("📡 Oracle Autonomous Database bağlantısı test ediliyor...")
    
    connection = get_db_connection()
    if connection:
        print("-" * 30)
        print("✅ BAŞARILI: Veritabanına erişildi!")
        print(f"Veritabanı Sürümü: {connection.version}")
        print("-" * 30)
        
        cursor = connection.cursor()
        cursor.execute("SELECT 'Merhaba Oracle!' FROM DUAL")
        result = cursor.fetchone()
        print(f"Test Mesajı: {result[0]}")
        
        cursor.close()
        connection.close()
        return True
    else:
        print("-" * 30)
        print("❌ BAĞLANTI BAŞARISIZ!")
        print("-" * 30)
        return False

# ==================== GİRİŞ NOKTASI ====================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Sadece bağlantı testi
        test_connection()
    else:
        # Tam veri toplama
        collect_all_data()
