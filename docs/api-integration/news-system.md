# Haber Sistemi — Tam Dokümantasyon

Haberlerin toplanmasından API'den sunulmasına kadar uçtan uca akış.

---

## İçindekiler

1. [Genel Mimari](#genel-mimari)
2. [Oracle DB Şeması: `BIST_NEWS`](#oracle-db-şeması-bist_news)
3. [Haber Toplama Pipeline'ı](#haber-toplama-pipelineı)
   - [Kaynaklar](#kaynaklar)
   - [Normalizasyon ve Tekilleştirme](#normalizasyon-ve-tekilleştirme)
   - [DB'ye Yazma](#dbye-yazma)
4. [Duygu Analizi (Sentiment Etiketleme)](#duygu-analizi-sentiment-etiketleme)
5. [Backend API Endpoint: `GET /v1/news`](#backend-api-endpoint-get-v1news)
   - [Query Parametreleri](#query-parametreleri)
   - [Response Modeli](#response-modeli)
   - [Filtreleme Mantığı](#filtreleme-mantığı)
   - [Örnekler](#örnekler)
6. [Ortam Değişkenleri](#ortam-değişkenleri)

---

## Genel Mimari

```
[Haber Kaynakları]           [Scraper]                    [Oracle DB]
  Hürriyet       ──┐
  Bloomberg HT   ──┤──► news_oracle_collector.py ──► INSERT BIST_NEWS
  Investing TR   ──┤         (SENTIMENT='BEKLIYOR')
  Google News    ──┘
                                                               │
                                                    label_all_news.py
                                                    (BERT dbmdz modeli)
                                                               │
                                                  SENTIMENT güncellenir
                                                  (OLUMLU / OLUMSUZ / NÖTR)
                                                               │
                                                    [FastAPI Backend]
                                                    GET /v1/news  ──► Frontend
```

---

## Oracle DB Şeması: `BIST_NEWS`

Tek canonical tablo. `BIST_NEWS_ARTICLES` diye bir tablo yoktur.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `ID` | NUMBER | Auto-increment Primary Key |
| `MARKET` | VARCHAR2 | Borsa (`tr`, `us` ...) |
| `SYMBOL` | VARCHAR2 | Hisse kodu (örn. `THYAO`, `BIMAS`) |
| `NEWS_SOURCE` | VARCHAR2 | Kaynak adı (örn. `bloomberght`, `bigpara`) |
| `TITLE` | VARCHAR2(1000) | Haber başlığı |
| `SUMMARY` | VARCHAR2(4000) | Özet metin |
| `CONTENT` | CLOB | Tam haber içeriği |
| `SENTIMENT` | VARCHAR2 | `OLUMLU` / `OLUMSUZ` / `NÖTR` / `BEKLIYOR` |
| `SENTIMENT_SCORE` | NUMBER(5,4) | Modelin güven skoru (0.0 – 1.0) |
| `NEWS_URL` | VARCHAR2(2000) | Kaynak URL |
| `AUTHOR` | VARCHAR2(200) | Yazar adı |
| `PUBLISHED_AT` | TIMESTAMP | Haberin yayın zamanı |
| `SCRAPED_AT` | TIMESTAMP | Çekilme zamanı (UTC) |
| `URL_HASH` | VARCHAR2 | SHA-256(url) — UNIQUE INDEX (duplicate engeli) |

> `URL_HASH` üzerinde UNIQUE constraint var. Aynı URL ikinci kez gönderilirse Oracle `ORA-00001` fırlatır ve scraper bu satırı sessizce atlar.

---

## Haber Toplama Pipeline'ı

**Konum:** `scrapers/news_scraper/`

### Kaynaklar

`news_oracle_collector.py` her çalıştırıldığında şu kaynaklara sırayla gider:

| Kaynak | Kapsam | Scraper Tipi |
|--------|--------|-------------|
| **Hürriyet** | Genel ekonomi haberleri (tüm BIST) | TR RSS/HTML |
| **Bloomberg HT** | Sembol bazlı haberler | TR HTML |
| **Investing TR** | Sembol bazlı haberler | TR HTML |
| **Google News** | Sembol bazlı, Türkçe | `gnews` kütüphanesi |

`bist_tickers.json` dosyasındaki tüm semboller döngüyle taranır:

```python
# bist_tickers.json örneği
{
  "tr": ["THYAO", "GARAN", "AKBNK", "ASELS", "BIMAS", ...]
}
```

Her sembol için semboller arası varsayılan `0.5 sn` bekleme uygulanır (rate-limit aşımını önlemek için).

**Çalıştırma:**

```bash
cd scrapers/news_scraper
python news_oracle_collector.py
# Opsiyonlar:
python news_oracle_collector.py --limit 50           # kaynak başına maks haber
python news_oracle_collector.py --max-symbols 10     # test için sembol sınırla
python news_oracle_collector.py --sleep 1.0          # semboller arası bekleme
python news_oracle_collector.py --skip-db            # sadece JSON/CSV üret, DB yazma
python news_oracle_collector.py --test-db            # sadece DB bağlantısını test et
```

---

### Normalizasyon ve Tekilleştirme

Scraper'dan gelen her ham makale `article_to_row()` fonksiyonuyla normalize edilir:

```
ham makale ──► article_to_row() ──► dict (DB satırı)
```

Uygulanan dönüşümler:

| Alan | İşlem |
|------|-------|
| `market` | Küçük harf (`tr`) |
| `symbol` | Büyük harf (`THYAO`) |
| `source_name` | Küçük harf (`bloomberght`) |
| `title` | Max 1000 karakter truncate |
| `url` | Max 2000 karakter truncate |
| `author` | Max 200 karakter truncate |
| `published_at` | ISO / RSS / email formatlarından `datetime`'a parse |
| `scraped_at` | UTC şimdiki zaman |
| `url_hash` | `SHA-256(url)` — URL yoksa `SHA-256(article_id + title)` |

Sonrasında `dedupe_rows()` aynı çalışma içindeki tekrarlı `url_hash`'leri eler (DB'ye gitmeden önce):

```python
def dedupe_rows(rows: List[Dict]) -> List[Dict]:
    seen = set()
    ...  # url_hash'e göre ilk gördüğünü saklar
```

---

### DB'ye Yazma

`insert_news_rows()` her satırı tek tek `INSERT` eder:

```sql
INSERT INTO BIST_NEWS (
    MARKET, SYMBOL, NEWS_SOURCE, TITLE, SUMMARY, CONTENT,
    SENTIMENT, NEWS_URL, AUTHOR, PUBLISHED_AT, SCRAPED_AT, URL_HASH
) VALUES (
    :market, :symbol, :source_name, :title, :summary, :content,
    'BEKLIYOR', :url, :author, :published_at, :scraped_at, :url_hash
)
```

- Yeni haberler `SENTIMENT = 'BEKLIYOR'` ile girilir.
- Duplicate `URL_HASH` → `ORA-00001` → satır atlanır, hata fırlatılmaz.
- Tüm batch başarılıysa `COMMIT`, herhangi bir kritik hata varsa `ROLLBACK`.

Aynı zamanda `scraper-data/` altında JSON ve CSV önizleme dosyaları üretilir:
```
scraper-data/tr/oracle_preview/bist_news_preview_20260504_143022.json
scraper-data/tr/oracle_preview/bist_news_preview_20260504_143022.csv
```

---

## Duygu Analizi (Sentiment Etiketleme)

**Konum:** `scrapers/news_scraper/label_all_news.py`  
**Model:** `model_train/sentiment_v4/final_model_dbmdz/` (dbmdz/bert-base-turkish-cased fine-tune)

### Model Özellikleri

| Özellik | Değer |
|---------|-------|
| Base model | `dbmdz/bert-base-turkish-cased` |
| Etiketler | `OLUMLU`, `OLUMSUZ`, `NÖTR` |
| Test Macro-F1 | **0.9307** |
| Eğitim verisi | 6.507 haber (train/val/test: 4684/1172/651) |
| Çıktı kolonu | `SENTIMENT` + `SENTIMENT_SCORE` (0.0–1.0) |

### Etiketleme Akışı

```
BIST_NEWS (SENTIMENT='BEKLIYOR')
        │
        ▼ DB_FETCH_SIZE=500 satır batch
  [TITLE] + " " + [SUMMARY]
        │
        ▼ Tokenize (max 512 token)
  BERT forward pass (GPU/CPU)
        │
        ▼ softmax → argmax
  ID2LABEL: {0: 'NÖTR', 1: 'OLUMLU', 2: 'OLUMSUZ'}
        │
        ▼
  UPDATE BIST_NEWS
     SET SENTIMENT = :label,
         SENTIMENT_SCORE = :score
   WHERE ID = :id
```

### Kullanım

```bash
cd scrapers/news_scraper
python label_all_news.py                   # varsayılan: batch=64, BEKLIYOR olanlar
python label_all_news.py --batch-size 128  # daha hızlı (GPU varsa)
python label_all_news.py --dry-run         # DB'ye yazmadan tahmin göster
python label_all_news.py --all             # BEKLIYOR + mevcut tüm etiketleri yeniden yaz
```

Çalışırken terminalde ilerleme gösterilir:
```
[*] Oracle'a bağlanılıyor... (user=ADMIN, dsn=evalondb_high)
[OK] Bağlantı başarılı!
[*] Model yükleniyor: .../final_model_dbmdz
[*] Device: cuda (NVIDIA GeForce RTX 4060 Laptop GPU)
Batch 1/102: 64 satır işlendi (OLUMLU:28, OLUMSUZ:19, NÖTR:17) ...
```

---

## Backend API Endpoint: `GET /v1/news`

**Dosya:** `backend/backtest/api/main.py`  
**Tablo:** `BIST_NEWS` (Oracle Autonomous DB)

### Query Parametreleri

| Parametre | Tip | Varsayılan | Açıklama |
|-----------|-----|-----------|----------|
| `symbol` | string | — | Tek hisse kodu filtresi (örn. `THYAO`) |
| `symbols` | string | — | Virgülle ayrılmış çoklu hisse (örn. `THYAO,GARAN`) |
| `sentiment` | string | — | `OLUMLU`, `OLUMSUZ`, `NÖTR` veya `NOTR` (Türkçe karakter sorununa karşı `NOTR` da kabul edilir) |
| `q` | string | — | Başlık/özet metin araması (LIKE, max 200 karakter) |
| `published_after` | datetime (ISO) | — | Bu tarihten sonraki haberler (örn. `2026-01-01T00:00:00`) |
| `limit` | int | `20` | Sayfa başına sonuç (1–100) |
| `page` | int | `1` | Sayfa numarası (1-tabanlı) |

> `symbol` ve `symbols` birlikte kullanılabilir, ikisi de OR mantığıyla birleştirilir.

### Response Modeli

```json
{
  "items": [
    {
      "id": 4821,
      "symbol": "THYAO",
      "news_source": "bloomberght",
      "title": "Türk Hava Yolları rekor yolcu sayısına ulaştı",
      "summary": "THY, Nisan 2026'da 7.2 milyon yolcu taşıdı...",
      "content": "...(tam metin)...",
      "sentiment": "OLUMLU",
      "sentiment_score": 0.9341,
      "news_url": "https://www.bloomberght.com/...",
      "author": "Mehmet Yılmaz",
      "published_at": "2026-05-03T09:15:00"
    }
  ],
  "total": 143,
  "page": 1,
  "limit": 20
}
```

| Alan | Açıklama |
|------|----------|
| `sentiment` | `OLUMLU` / `OLUMSUZ` / `NÖTR` / `null` (henüz etiketlenmemiş) |
| `sentiment_score` | 0.0–1.0 arası modelin güven skoru (yüksek = daha emin) |
| `total` | Filtreye uyan toplam kayıt sayısı (tüm sayfalar) |

---

### Filtreleme Mantığı

API, Oracle'dan aldığı satırlara Python tarafında ek bir `_should_include_news_item()` filtresi uygular. Bu filtre iki kriteri kontrol eder:

**1. İçerik kalitesi kontrolü (`_content_has_enough_extra_words`):**

Content alanı sadece başlığın tekrarıysa haber atılır (minimum 6 fazladan kelime şartı):

```
content = "THY rekor yolcu sayısına ulaştı"      ← başlıkla aynı → ATLA
content = "THY rekor yolcu sayısına ulaştı. ..."  ← fazladan içerik var → KABUL
```

**2. Çoklu sembol çakışma kontrolü:**

Haber metni (title + summary + content) içinde birden fazla BIST sembolü tespit edilirse ve haber o sembol için sorgulanıyorsa atılır. Bu sayede "THYAO ile PEGASUS arasında rekabet..." tarzı genel analizler her iki sembolün akışına da karışmaz.

```
symbol = "THYAO"
metin  = "THYAO ve PEGASUS yolcu rekabetinde..."
→ 2 sembol tespit edildi, THYAO'ya özgü değil → ATLA

symbol = "THYAO"
metin  = "THYAO Nisan'da rekor kırdı..."
→ 1 sembol (THYAO), sembole özgü → KABUL
```

> Bu filtreleme nedeniyle API'nin döndüğü `total` değeri DB'deki gerçek satır sayısından az olabilir.

**Sayfalama:**

Filtre Python tarafında uygulandığından, API her sayfada Oracle'dan `batch_size = max(limit × 5, 100)` satır çeker ve hedef sayıya ulaşana kadar devam eder:

```
limit=20  →  batch_size=100  (5×20)
limit=100 →  batch_size=500  (5×100)
```

---

### Örnekler

```bash
# THYAO son 20 haberi
GET /v1/news?symbol=THYAO

# THYAO ve GARAN haberleri, 2. sayfa
GET /v1/news?symbols=THYAO,GARAN&page=2

# Sadece olumlu haberler
GET /v1/news?sentiment=OLUMLU&limit=50

# "rekor" kelimesi geçen ASELS haberleri
GET /v1/news?symbol=ASELS&q=rekor

# 2026 başından itibaren tüm olumsuz haberler
GET /v1/news?sentiment=OLUMSUZ&published_after=2026-01-01T00:00:00&limit=100
```

---

## Ortam Değişkenleri

### Scraper (`scrapers/news_scraper/.env`)

```env
ORACLE_DB_USER=ADMIN
ORACLE_DB_PASSWORD=...
ORACLE_DB_DSN=evalondb_high
ORACLE_WALLET_DIR=oracle_wallet
GEMINI_API_KEY=...        # artık kullanılmıyor (etiketleme BERT ile yapılıyor)
```

### Backend API (`backend/backtest` — Cloud Run / local)

```env
ORACLE_DB_USER=ADMIN
ORACLE_DB_PASSWORD=...
ORACLE_DB_DSN=evalondb_high
ORACLE_WALLET_DIR=/path/to/wallet
# VEYA:
ORACLE_WALLET_ZIP_B64=<base64_of_wallet.zip>   # Cloud Run için önerilen
```

> Backend API, wallet'ı şu sırayla arar:
> 1. `ORACLE_WALLET_DIR` env var
> 2. `ORACLE_WALLET_ZIP_B64` env var (geçici dizine unzip eder)
> 3. Varsayılan `./wallet` dizini

---

*Son güncelleme: 4 Mayıs 2026*
