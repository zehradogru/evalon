Plan: Evalon Bölüm 2-6 Yapılabilirlik Raporu
Tüm kod tabanını (backend FastAPI, Oracle tabloları, model_train, frontend) detaylıca inceledim. İşte sonuç:

Kritik Bulgular Özeti
Backend güçlü: Prices, indicators (TA-Lib 30+), backtest engine, AI (Gemini+LangGraph) hazır.
Backend eksik: News endpoint/tablosu, markets summary, screener endpoint, KAP/IPO/şirket bilgisi, WebSocket, Redis, Celery.
Sürpriz: BIST_PRICES tablosunda DIVIDENDS ve STOCK_SPLITS sütunları zaten var → temettü özelliği çok kolay.
Frontend gizli zenginlik: Paper-trade, watchlist, community, screener-presets, alerts, ai-history servisleri Firestore ile zaten aktif.
Model durumu iyi (ama yanıltıcı): BERT v3 → val %90, test %86. Ama manuel audit gerçek doğruluğu %58-61 → sentetik veriden gerçek dağılıma transfer zayıf. Çözüm: aktif öğrenme + 800-1000 yeni manuel etiket.
Bölüm 2 (Eklenebilecek Şeyler) – Karar Tablosu
Özellik	Karar
TradingView SDK / Algo trading	YAPMA (lisans/regülasyon)
Paper Trading, Community	ZATEN VAR
Screener, Korelasyon, Temettü, Heatmap, Risk Profiling, Sentiment Widget	YAP (kolay-orta)
Tam KG-RAG, Bilanço PDF analisti, Global piyasalar	YAPMA (veri/maliyet yok)
Haber duygu analizi entegrasyonu	YAP (en yüksek değer, büyük iş)
Bölüm 3 (Bitirme – Kolay) – Hepsini YAP
Kar/Zarar hesaplayıcı, Top Gainers/Losers, Live Search, Akademi, Dark/Light Mode → backend dokunmaz. Watchlist DB zaten var.

Bölüm 4 (Eksik Standart Özellikler)
Özellik	Karar
2FA (SMS – Firebase native)	YAP
PWA manifest	YAP (1-2 saat)
Cüzdan simülasyonu (paper-trade'e ek)	YAP
Şirket profili (yfinance.info ile mini)	MİNİ YAP
IPO takvimi (statik 5-10 manuel)	MİNİ YAP
KAP feed	YAPMA (kırılgan scrape, gri alan)
Bölüm 5 (Mock → Canlı) – Detay
5-A Markets: Mock değil zaten – tek eksik GET /v1/markets/summary bulk endpoint (140 ticker tek SQL'de). Sonra USE_MOCK_DATA=false. Düşük zorluk.

5-B News (en kapsamlı):

news_oracle_collector.py ile yaratılan tablo şemasını teyit et
/v1/news, /v1/news/score endpoint'leri
Etiketleme stratejisi: Mini Gradio/Streamlit UI ile aktif öğrenme (model güvensiz haberleri öncelikle göster) + LLM-asisted (Gemini önerisi → manuel onay) ile 800 yeni etiket → BERT v4 retrain → hedef gerçek dağılımda %75+
BERT'i ayrı Cloud Run mikroservisi olarak deploy et (ana API hafif kalsın)
Cloud Scheduler ile label_latest_news.py günde 2x
5-C Screener: Backend'de altyapı var (indicators + multi-ticker fetch). Eksik tek şey filter orchestration endpoint'i. Sadece teknik filtreler (RSI/MACD/hacim) – F/K, PD/DD gibi temel analiz YAPILAMAZ (veri yok). Orta zorluk, yapılabilir.

Bölüm 6 (Mühendislik Değeri)
Özellik	Karar
Redis Cache (markets summary, prices, screener)	YAP – before/after latency raporu jüri için altın
WebSocket	DAR SCOPE YAP – sadece backtest progress için. Tüm market WS yapma (intraday tick yok zaten)
Celery + Redis (queue)	YAP – Redis zaten ekleniyor
Microservices	KISMEN VAR – sentiment-service eklenince 3 servis: api / news-collector / sentiment
Observability	YAP – LIGHT (Cloud Monitoring + structured JSON log)
CI/CD GitHub Actions	YAP (1 gün)
Önerilen Sprint Sırası
Sprint 1 (1 hf): Markets summary, gainers/losers, heatmap, dark mode, PWA, kar/zarar, akademi, korelasyon, temettü
Sprint 2 (1 hf): Screener + risk profiling
Sprint 3 (2 hf, en yüksek değer): News pipeline + etiketleme UI + BERT v4 + sentiment microservice + frontend
Sprint 4 (1-2 hf): Redis + CI/CD + monitoring + WS backtest progress + Celery
Sprint 5 (1 hf): Cüzdan, leaderboard, mini şirket profili, SMS 2FA, statik IPO
Tam detaylı plan plan.md dosyasında saklı (riskler, alternatifler, açık sorular dahil).

Soru: Bu plan üzerinde değişiklik ister misin? Mesela:

Bir sprint'i öne çekelim mi?
Yapma dediklerimden birini "yine de yapalım" mı diyorsun?
News etiketleme aracı için Gradio mu Streamlit mi tercih edersin (ya da Excel basit yol mu)?




























Plan Hazır – Kullanıcıya Özet
Önemli düzeltmeler/eklemeler:

Haber Tabloları (kritik!)
İki tablo var:

BIST_NEWS_ARTICLES (news_oracle_collector.py:303) – sentiment kolonsuz
BIST_NEWS (upload_news_to_db.py:34) – SENTIMENT + SENTIMENT_SCORE kolonu zaten var ✓
→ Plan: BIST_NEWS canonical seçildi. Sprint 3 ilk iş: scraper'ı BIST_NEWS'e yazacak şekilde refactor et + eski tabloyu migrate et.

Günlük Otomatik Haber Çekimi (eklendi – Madde 12)
Önerilen yöntem: Cloud Run Job + Cloud Scheduler (0 */3 * * * her 3 saatte bir).

scrapers/news_scraper/scheduled_collect.py (yeni script) – tek entry
Dockerfile ekle, secret manager'a Oracle wallet yükle, deploy et
Yedek plan: GitHub Actions cron (ücretsiz, basit)
Yeni tablo: NEWS_COLLECTION_LOG (her run istatistik)
Tüm "YAP"ların Özeti (28 madde, 5 sprint)
Sprint	İçerik	Süre
1 – Hızlı Kazanım	Markets summary, gainers/losers, heatmap, dark mode, PWA, kar-zarar, akademi, korelasyon, temettü	1 hf
2 – Screener	Screener endpoint + frontend + risk profiling	1 hf
3 – News + Sentiment (en yüksek değer)	Günlük cron, etiketleme UI, BERT v4, sentiment microservice, news endpoint, news sayfası, sentiment widget	2 hf
4 – Mühendislik	Redis, CI/CD, monitoring, WS backtest progress, (opsiyonel) Celery	1-2 hf
5 – Kullanıcı	Cüzdan, leaderboard, şirket profili, SMS 2FA, statik IPO	1 hf
Her madde için planda şunlar var:

Hangi yeni dosyalar yaratılacak (tam yol)
Hangi mevcut dosyalar değişecek
Endpoint signature + örnek SQL
Frontend route + service + component
Deployment yöntemi (Cloud Run/Job/Scheduler)
Zorluk + süre tahmini
Riskler & alternatifler
Tam detay plan.md dosyasında saklı (yaklaşık 600 satır).