# BIST Finansal Takvim Kazıyıcısı (Calendar Scraper)

Borsa İstanbul hisse senetlerine özel finansal takvim etkinliklerini (bilanço tarihleri, temettü ödemeleri, genel kurul toplantıları ve TR makroekonomik veriler) otomatik olarak toplayan mikro servis.

## Klasör Yapısı

```
calendar_scraper/
├── __init__.py          # Paket tanımı
├── config.py            # Merkezi yapılandırma (env, ticker, ayarlar)
├── models.py            # CalendarEvent veri modeli
├── db.py                # Oracle DB bağlantı ve CRUD
├── collector.py         # Ana orkestratör (tüm kaynakları birleştirir)
├── main.py              # CLI giriş noktası
├── requirements.txt     # Python bağımlılıkları
├── .env                 # Oracle DB bilgileri (git'e eklenmez)
├── .gitignore
├── README.md
├── scrapers/            # Kaynak bazında kazıyıcılar
│   ├── __init__.py
│   ├── base.py          # Soyut temel sınıf (BaseScraper)
│   ├── isyatirim_scraper.py  # İş Yatırım bilanço takvimi
│   ├── kap_scraper.py        # KAP temettü/genel kurul
│   └── macro_scraper.py      # ForexFactory TR makro
└── data/                # Yerel JSON/CSV çıktıları (git'e eklenmez)
```

## Kurulum

```bash
cd scrapers/calendar_scraper
pip install -r requirements.txt
```

## Kullanım

```bash
# Tüm kaynakları tara, dosyaya ve Oracle'a yaz
python main.py

# Sadece dosyaya kaydet (DB'ye yazma)
python main.py --skip-db

# Sadece İş Yatırım bilanço verilerini çek
python main.py --sources isyatirim

# Sadece TR makroekonomik takvim
python main.py --sources macro_tr

# Sadece belirli hisseler için
python main.py --tickers THYAO AKBNK GARAN

# İlk 5 hisseyle test et
python main.py --max-tickers 5 --skip-db

# Oracle bağlantı testi
python main.py --test-db

# DB'deki etkinlikleri listele
python main.py --list
```

## Veri Kaynakları

| Kaynak | Veri Tipi | Yöntem |
|--------|-----------|--------|
| İş Yatırım | Bilanço tarihleri | XHR API + HTML Parse |
| KAP | Temettü, Genel Kurul | Bildirim API + HTML |
| ForexFactory | TR Makro (TCMB, TÜİK) | JSON Feed |

## Veritabanı

Oracle Autonomous DB'de `BIST_CALENDAR` tablosu oluşturulur.
Mevcut `news_scraper` ile aynı wallet ve kimlik bilgilerini kullanır.

## Etkinlik Tipleri

- `BILANCO` — Çeyreklik/yıllık bilanço açıklama tarihi
- `TEMETTU` — Temettü dağıtım tarihi
- `GENEL_KURUL` — Olağan/Olağanüstü genel kurul
- `BEDELSIZ` — Bedelsiz sermaye artırımı
- `MAKRO` — TR makroekonomik veri (enflasyon, faiz vb.)
