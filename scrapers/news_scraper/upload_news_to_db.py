import os
import sys
import csv
from pathlib import Path
import oracledb
from datetime import datetime

# Yollar (Borsa-1 ana dizini ve cüzdan)
ROOT_DIR = Path(__file__).resolve().parent.parent
WALLET_DIR = str(ROOT_DIR / "oracle_wallet")

# Yüklemek istediğin en güncel ve düzgün veri dosyası (Gerekirse adını değiştirebilirsin)
CSV_PATH = ROOT_DIR / "news_microservice" / "bist-news-data" / "tr_haberler_215206_fixed-2.csv"

# Veritabanı Ayarları
DB_USER = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN = "evalondb_high"

def parse_date(date_str):
    if not date_str: return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except:
        return None

def setup_table(cursor):
    """BIST_NEWS tablosu yoksa veritabanında oluşturur."""
    try:
        cursor.execute("SELECT count(*) FROM user_tables WHERE table_name = 'BIST_NEWS'")
        if cursor.fetchone()[0] == 0:
            print("🏗️ BIST_NEWS tablosu bulunamadı, oluşturuluyor...")
            cursor.execute("""
                CREATE TABLE BIST_NEWS (
                    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    MARKET VARCHAR2(10),
                    SYMBOL VARCHAR2(20),
                    NEWS_SOURCE VARCHAR2(255),
                    TITLE VARCHAR2(1000),
                    SUMMARY VARCHAR2(4000),
                    CONTENT CLOB,
                    SENTIMENT VARCHAR2(50),
                    SENTIMENT_SCORE NUMBER(5,4),
                    NEWS_URL VARCHAR2(2000),
                    AUTHOR VARCHAR2(255),
                    PUBLISHED_AT TIMESTAMP,
                    SCRAPED_AT TIMESTAMP,
                    URL_HASH VARCHAR2(64) UNIQUE
                )
            """)
            print("✅ Tablo başarıyla oluşturuldu!")
        else:
            print("✅ BIST_NEWS tablosu zaten veritabanında mevcut.")
    except Exception as e:
        print(f"❌ Tablo kurulum hatası: {e}")

def upload_news():
    if not CSV_PATH.exists():
        print(f"❌ CSV dosyası bulunamadı: {CSV_PATH}")
        return

    print("📡 Oracle DB'ye bağlanılıyor... (Thin Mode)")
    
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
        print(f"❌ Bağlantı Hatası: {e}")
        return

    cursor = connection.cursor()
    
    # Adım 1: Tablo kontrolü / Kurulumu
    setup_table(cursor)

    # Adım 2: Verileri Ekleme
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

    print(f"\n📂 Veriler okutuluyor: {CSV_PATH.name}")
    # CSV boyut limitini artırıyoruz (uzun haberler için)
    # Windows ortamında sys.maxsize bazen C limitini aşabilir, güvenli bir tavan değer giriyoruz:
    csv.field_size_limit(2147483647)

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            batch_data.append((
                str(row.get("market", ""))[:10],
                str(row.get("symbol", ""))[:20],
                str(row.get("source", ""))[:255],
                str(row.get("title", ""))[:1000],
                str(row.get("summary", ""))[:4000],
                row.get("content"),  # CLOB limit tanımaksızın alır
                str(row.get("sentiment", "BEKLIYOR"))[:50],
                str(row.get("url", ""))[:2000],
                str(row.get("author", "Bilinmiyor"))[:255],
                parse_date(row.get("published_at")),
                parse_date(row.get("scraped_at")),
                str(row.get("url_hash", ""))[:64]
            ))

            # Sepet (batch) dolduğunda hepsini tek işlemde (executemany) DB'ye yansıt
            if len(batch_data) >= batch_size:
                try:
                    cursor.executemany(sql, batch_data, batcherrors=True)
                    connection.commit()
                    
                    # Başarılı / Başarısız sayılarını ayır (Oracle batcherrors)
                    errors = cursor.getbatcherrors()
                    inserted_this_batch = len(batch_data) - len(errors)
                    total_inserted += inserted_this_batch
                    total_skipped += len(errors)
                    
                    print(f"📦 {total_inserted} satır veritabanına aktarıldı... (Bu pakette {len(errors)} hata/kopya vardı atlandı)")
                    
                except Exception as e:
                    print(f"❌ Toplu Insert Hatası: {e}")
                
                batch_data = [] # Sepeti boşalt

        # Kalan küsürat satırları da yükle
        if batch_data:
            try:
                cursor.executemany(sql, batch_data, batcherrors=True)
                connection.commit()
                
                errors = cursor.getbatcherrors()
                total_inserted += (len(batch_data) - len(errors))
                total_skipped += len(errors)
                print(f"📦 Son parti eklendi! Toplam: {total_inserted}")
            except Exception as e:
                print(f"❌ Son parti Insert Hatası: {e}")

    cursor.close()
    connection.close()

    print("\n" + "="*50)
    print("✅ YÜKLEME İŞLEMİ BİTTİ!")
    print(f"Başarıyla Bağlanan Haber: {total_inserted}")
    print(f"Tekrar Eden / Hatalı (Atlanan): {total_skipped}")
    print("="*50)

if __name__ == "__main__":
    upload_news()
