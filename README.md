<div align="center">
  <h1>Evalon</h1>
  <p><strong>BIST piyasaları için yapay zeka destekli, yeni nesil finansal veri analizi ve yatırım danışmanlığı platformu.</strong></p>
  <p>
    <a href="https://evalon.com.tr"><strong>🌐 evalon.com.tr Yayında!</strong></a>
  </p>
</div>

---

Evalon, borsa verilerini (BIST 100) analiz eden, teknik indikatörler sunan, sanal portföy (paper trading) imkanı veren ve yapay zeka destekli yatırım danışmanlığı sağlayan kapsamlı bir platformdur. Kullanıcılarına anlık hisse senedi verileri, duygu analizli şirket haberleri ve finansal takvim sunarak bilinçli yatırım kararları almalarına yardımcı olur.

---

## 📁 Proje Yapısı

```
evalon/
├── frontend/          # Next.js 15 web uygulaması (Vercel)
├── backend/
│   └── backtest/      # FastAPI backtest motoru (Google Cloud Run)
├── cloud_jobs/
│   ├── news_scraper/  # Günlük BIST haber scraper (Cloud Run Job)
│   └── calendar_scraper/ # Finansal takvim scraper (Cloud Run Job)
├── functions/         # Firebase Cloud Functions (bildirimler vb.)
├── model_train/       # Sentiment model eğitimi ve araçları
│   ├── sentiment_v4/  # Üretim modeli — Turkish BERT fine-tune
│   └── sentiment_entity_aware/ # Entity-aware model (AR&GE)
├── mobile/            # Kotlin Multiplatform mobil uygulama (geliştirme)
└── scripts/           # Deploy ve yardımcı scriptler
```

---

## 🖥️ Frontend (`frontend/`)

**Teknoloji:** Next.js 15, React, TypeScript, Tailwind CSS, Zustand, TanStack Query, Recharts, lightweight-charts, Firebase Auth

**Sayfalar ve Özellikler:**

| Sayfa | Açıklama |
|-------|---------|
| `/markets` | BIST 100 piyasa özeti, hisse fiyatları ve günlük değişimler |
| `/markets/[ticker]` | Tekil hisse detay sayfası: grafik, indikatörler, haberler |
| `/news` | Duygu analizli haber akışı (OLUMLU / OLUMSUZ / NÖTR etiketli) |
| `/screener` | Teknik indikatör tabanlı hisse tarama aracı |
| `/backtest` | Strateji geriye dönük test motoru |
| `/calendar` | Finansal ekonomik takvim (KAP, BIST etkinlikleri) |
| `/markets/co-movement` | Hisse ortak hareket (co-movement) korelasyon analizi |
| `/paper-trade` | Sanal portföy (paper trading) ve liderboard |
| `/ai` | AI destekli yatırım danışmanı (chat + backtest entegrasyonu) |
| `/watchlist` | Kişisel takip listesi |
| `/alerts` | Fiyat ve haber uyarıları |
| `/community` | Kullanıcı tartışma forumu |
| `/academy` | Yatırım eğitim içerikleri |

**Haber Görüntüleme Mantığı (`features/news/news-view.tsx`):**
- İçerik `< 150 karakter` ise veya başlıkla aynı metni içeriyorsa "fake content" olarak işaretlenir
- Bu durumda `summary` alanına düşülür; o da yoksa "Haber içeriği mevcut değil" mesajı gösterilir
- Gerçek içerik varsa `border-l-4` bloğunda tam metin gösterilir

---

## ⚙️ Backend (`backend/backtest/`)

**Teknoloji:** Python, FastAPI, TA-Lib, Google Cloud Run (`europe-west1`)

**Servis:** `evalon-backtest-api` — Cloud Run üzerinde çalışır

**Endpoint'ler:**
- `POST /backtests/run` — Strateji kurallarını alır, tarihsel fiyat verisiyle çalıştırır, portföy eğrisi döner
- `GET /indicators/catalog` — Desteklenen teknik indikatörler listesi
- `GET /screener/scan` — Tarama sorgusu çalıştır
- `GET /calendar` — Ekonomik takvim verisi

---

## ☁️ Cloud Jobs (`cloud_jobs/`)

### Haber Scraper (`news_scraper/`)
**Servis:** `evalon-bist-news-scraper` — Cloud Run Job (`europe-west3`), günlük çalışır

- BIST 100 şirketlerine ait haberleri RSS + web scraping ile toplar
- `newspaper3k` ve `BeautifulSoup4` ile haber içeriği çeker
- Haberleri Oracle Autonomous Database `BIST_NEWS` tablosuna yazar
- `sentiment_inference.py` — GCS'den model indirir, her haber için OLUMLU/OLUMSUZ/NÖTR tahmini yapar
- Yeni haberler varsayılan olarak `BEKLIYOR` etiketiyle kaydedilir; Cloud Job içindeki inference modülü etiketleri doldurur

### Takvim Scraper (`calendar_scraper/`)
Finansal etkinlikleri ve KAP duyurularını toplar.

---

## 🤖 Sentiment Model (`model_train/sentiment_v4/`)

**Kullanılan Model:** `final_model_dbmdz`

| | |
|---|---|
| **Temel model** | `dbmdz/bert-base-turkish-cased` (Turkish BERT) |
| **Görev** | 3 sınıflı metin sınıflandırma — NÖTR · OLUMLU · OLUMSUZ |
| **Eğitim verisi** | 6.507 dengeli satır (13.929 ham → 2.169×3 balance) — 4.684 train / 1.172 val / 651 test |
| **Eğitim** | 8 epoch, en iyi checkpoint: step 518 |
| **Başarı** | Macro F1 = **93.1%** (test seti) |
| **Giriş formatı** | `[CLS] TEXT [SEP]` — sadece haber metni |
| **Etiket vektörü** | 0=NÖTR, 1=OLUMLU, 2=OLUMSUZ |

### Eğitim Veri Pipeline'ı

```
Ham haberler (tr_haberler*.csv)
    ↓ triple_label.py   — 3 LLM (qwen3:14b, gemma3:12b, llama3.1) ile oylama
    ↓ prepare_training_data.py / training/prepare_data.py
    ↓ train_split.csv / val_split.csv / test_split.csv
    ↓ training/train_v4.py
    → checkpoints_dbmdz/checkpoint-518  →  final_model_dbmdz/
```

### Çalışma Şekli (Üretim)

1. **Cloud Job** (`cloud_jobs/news_scraper/`) her gün çalışır, yeni haberleri `BEKLIYOR` etiketiyle DB'ye yazar  
2. `sentiment_inference.py` içindeki pipeline GCS'den `final_model_dbmdz` modelini çekerek her haberi etiketler  
3. Eksik kalan `BEKLIYOR` kayıtlar için yerel GPU scripti kullanılır:

```bash
# Önizleme — DB'ye yazmaz
python model_train/sentiment_v4/label_bekliyor_db.py --dry-run

# DB'ye yaz (GPU varsa otomatik kullanılır)
python model_train/sentiment_v4/label_bekliyor_db.py
```

### Klasör Yapısı

```
sentiment_v4/
├── final_model_dbmdz/      ← Üretimde kullanılan model (tokenizer + weights)
├── checkpoints_dbmdz/      ← Eğitim checkpoint'leri (518 = en iyi)
├── data/                   ← train/val/test split CSV'leri
├── training/               ← Eğitim scriptleri (train_v4.py, prepare_data.py)
├── label_bekliyor_db.py    ← BEKLIYOR kayıtları GPU ile etiketleyip DB'ye yazar
├── triple_label.py         ← 3 LLM oylamasıyla ham veri etiketler
└── archive/                ← Eski denemeler (kullanılmıyor)
```

---

## 🔥 Firebase (`functions/`)

**Teknoloji:** Firebase Cloud Functions (Node.js/TypeScript), Firestore

- Push bildirim gönderimi
- Kullanıcı profil yönetimi yardımcı fonksiyonlar

---

## 📱 Mobil (`mobile/`)

**Teknoloji:** Kotlin Multiplatform (Android + iOS)

- Geliştirme aşamasında
- Shared business logic Kotlin'de yazılıyor
- iOS için SwiftUI, Android için Compose kullanılıyor

---

## 🗄️ Veritabanı

**Oracle Autonomous Database** (Always Free tier)

Ana tablo: `BIST_NEWS_ARTICLES`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| ID | NUMBER | Primary key (identity) |
| MARKET | VARCHAR2(30) | Piyasa (örn. BIST) |
| SYMBOL | VARCHAR2(20) | Hisse kodu (örn. THYAO) |
| SOURCE_NAME | VARCHAR2(100) | Kaynak site adı |
| TITLE | VARCHAR2(1000) | Haber başlığı |
| SUMMARY | CLOB | Kısa özet |
| CONTENT | CLOB | Tam haber metni |
| URL | VARCHAR2(2000) | Kaynak URL |
| AUTHOR | VARCHAR2(200) | Yazar |
| PUBLISHED_AT | TIMESTAMP | Yayın tarihi |
| SCRAPED_AT | TIMESTAMP | Çekilme zamanı |
| URL_HASH | VARCHAR2(64) | Duplicate kontrolü için hash |
| SENTIMENT | VARCHAR2(10) | OLUMLU / OLUMSUZ / NÖTR / BEKLIYOR |
| SENTIMENT_SCORE | NUMBER(5,4) | Model confidence skoru |
| SENTIMENT_AT | TIMESTAMP | Etiketlenme zamanı |

---

## 🚀 Geliştirme Ortamı

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### Backend (backtest API)
```bash
cd backend/backtest
pip install -r requirements.txt
uvicorn api.main:app --reload
# http://localhost:8000
```

### DB Etiketleme (yerel GPU ile)
```bash
cd model_train/sentiment_v4
pip install torch transformers oracledb pandas
python label_bekliyor_db.py --dry-run   # önce önizle
python label_bekliyor_db.py             # DB'ye yaz
```

---

## ☁️ Deploy

| Servis | Platform | Bölge | Komut |
|--------|----------|-------|-------|
| Frontend | Vercel | — | `git push` (otomatik) |
| Backtest API | Cloud Run | europe-west1 | `gcloud run deploy evalon-backtest-api --source backend/backtest` |
| Haber Scraper Job | Cloud Run Jobs | europe-west3 | `gcloud run jobs deploy evalon-bist-news-scraper --source cloud_jobs/news_scraper` |
| Takvim Scraper Job | Cloud Run Jobs | europe-west3 | `gcloud run jobs deploy evalon-bist-calendar-scraper --source cloud_jobs/calendar_scraper` |

---

Platformumuzun tüm özelliklerini incelemek ve ücretsiz denemek için: **[https://evalon.com.tr](https://evalon.com.tr)**
