# BIST Oracle Cloud Veri Toplayıcı - VM Kurulum Rehberi

## 🎯 Amaç
Bu sistem, BIST (Borsa İstanbul) hisselerinin 1 dakikalık fiyat verilerini Yahoo Finance'den çekip Oracle Autonomous Database'e kaydeder.

## 📋 Gereksinimler

### VM Üzerinde:
```bash
pip3 install --user yfinance oracledb pandas
```

### Oracle Wallet:
- `/home/opc/wallet` dizininde hazır olmalı
- `cwallet.sso`, `tnsnames.ora`, `sqlnet.ora` dosyaları mevcut olmalı

## 🚀 Kurulum

### 1. Dosyaları VM'e Kopyala
```bash
scp bist_oracle_collector.py opc@<VM_IP>:~/bist_collector/
scp setup_vm.sh opc@<VM_IP>:~/bist_collector/
```

### 2. VM'de Kurulum Scriptini Çalıştır
```bash
ssh opc@<VM_IP>
cd ~/bist_collector
chmod +x setup_vm.sh
./setup_vm.sh
```

### 3. Şifreyi Ayarla
```bash
nano ~/.bist_env
# ORACLE_DB_PASSWORD satırını gerçek şifre ile değiştir
```

### 4. Bağlantıyı Test Et
```bash
source ~/.bist_env
python3 bist_oracle_collector.py --test
```

## 📅 Otomatik Çalışma

Cron job her **2 günde bir, akşam 22:00'de** çalışacak şekilde ayarlanmıştır (borsa kapandıktan sonra o günün verisi dahil çekilir).

### Cron Job Kontrol:
```bash
crontab -l
```

### Manuel Tetikleme:
```bash
source ~/.bist_env
python3 bist_oracle_collector.py
```

### Log Takibi:
```bash
tail -f ~/bist_collector/collector.log
```

## 🗄️ Veritabanı Tabloları

### BIST_PRICES
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| ID | NUMBER | Auto-increment PK |
| TICKER | VARCHAR2(20) | Hisse sembolü (örn: THYAO) |
| PRICE_DATETIME | TIMESTAMP WITH TZ | Fiyat zamanı |
| OPEN_PRICE | NUMBER | Açılış fiyatı |
| HIGH_PRICE | NUMBER | En yüksek |
| LOW_PRICE | NUMBER | En düşük |
| CLOSE_PRICE | NUMBER | Kapanış fiyatı |
| VOLUME | NUMBER | İşlem hacmi |


### COLLECTION_LOG
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| ID | NUMBER | Auto-increment PK |
| TICKER | VARCHAR2(20) | Hisse sembolü |
| COLLECTION_TIME | TIMESTAMP | Toplama zamanı |
| RECORDS_ADDED | NUMBER | Eklenen kayıt sayısı |
| STATUS | VARCHAR2(50) | SUCCESS/NO_DATA/ERROR |

## 📊 Örnek Sorgular

### Son Fiyatları Listele:
```sql
SELECT TICKER, CLOSE_PRICE, PRICE_DATETIME
FROM BIST_PRICES
WHERE PRICE_DATETIME = (
    SELECT MAX(PRICE_DATETIME) FROM BIST_PRICES p2 
    WHERE p2.TICKER = BIST_PRICES.TICKER
)
ORDER BY TICKER;
```

### Belirli Hissenin Geçmişi:
```sql
SELECT * FROM BIST_PRICES 
WHERE TICKER = 'THYAO' 
ORDER BY PRICE_DATETIME DESC
FETCH FIRST 100 ROWS ONLY;
```

### Toplama İstatistikleri:
```sql
SELECT TICKER, COUNT(*) as RECORDS, MAX(PRICE_DATETIME) as LAST_UPDATE
FROM BIST_PRICES
GROUP BY TICKER
ORDER BY LAST_UPDATE DESC;
```

## ⚠️ Notlar

1. **Rate Limiting**: Yahoo Finance rate limit uyguluyor, script otomatik olarak bekliyor
2. **Veri Süresi**: Yahoo 1 dakikalık veri için maksimum 7 gün geriye gidiyor
3. **Duplicate Önleme**: MERGE kullanılarak aynı kayıt tekrar eklenmez
4. **Hisse Listesi**: 127 BIST hissesi tanımlı (scriptte düzenlenebilir)
