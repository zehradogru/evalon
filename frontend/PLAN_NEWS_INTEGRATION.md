# EVALON AI-Powered Terminal: Gerçek Haber Entegrasyon Planı

Amacımız: `http://localhost:3000/news` sayfasını, `$1000/ay` değerindeki profesyonel bir terminal hissiyatına uygun (hızlı, kripto/borsa odaklı ve yapay zeka destekli duyarlılık [sentiment] analizi içeren) gerçek haberlerle doldurmak.

---

## 1. Veri Kaynakları (Haber Nereden Çekilir?)
Gerçek zamanlı, kaliteli ve çok varlıklı (BIST, NASDAQ, Crypto, Forex) haberler için en uygun API sağlayıcıları:

### A. Tüm Piyasalar (Global Hisse, FX, Kripto)
*   **Finnhub.io (Önerilen):** Ücretsiz paketi gerçek zamanlı haber sunar. Hisse spesifik ve genel piyasa haberleri. Kategorileri (forex, crypto, general) destekler.
*   **Alpha Vantage / FMP (Financial Modeling Prep):** Ücretsiz katmanı bulunan, finansal haberler ve duyarlılık (sentiment) skorlarını entegre verebilen API'ler.

### B. Türkiye Piyasası (BIST)
BIST odaklı haberler (KAP vb.) sağlayan tamamen ücretsiz ve açık bir dev API yok. En iyi yöntem:
*   **Investing.com / TradingView RSS Filter/Scraping**, KAP RSS bildirimleri ya da yerel finans gazetelerinin RSS akışları (Örn: Bloomberg HT, Dünya) ile haber toplama aracı (scrapper) yazmak.

---

## 2. Mimari ve İşleyiş (Nasıl Veritabanına Çekilir?)
Haberleri her sayfa yüklendiğinde kullanıcının tarayıcısından API'ye istek atarak çekmek hız ve API limitleri açısından kötüdür.
EVALON terminalinde her şey 0 gecikmeli olmalı, bu nedenle arka planda haberleri toplayıp **kendi veritabanımıza (örneğin projedeki Firebase'e)** yazmalıyız.

*   **Veritabanı:** Firestore (Projede `lib/firebase.ts` var).
*   **Veri Çekme Mekanizması:** **Cron Jobs** (Örn: Vercel Cron Jobs veya GitHub Actions kullanılarak arka planda çalışan bir `fetch` fonksiyonu).
*   **İş Akışı:**
    1.  Her 15 veya 30 dakikada bir Cron Job tetiklenir (`/api/cron/fetch-news`).
    2.  Sunucu API'ye (Örn: Finnhub) gider, en son haberleri çeker.
    3.  Sunucu bu haberleri filtreler (kopya var mı kontrolü vs.).
    4.  **AI Devrede:** OpenAI veya Gemini ile bu haber başlıklarından anında *Sentiment Analysis* (Olumlu, Olumsuz, Nötr) ve en fazla etkilenecek *Ticker'lar* çıkarılır. (EVALON'un ana vadini perçinler).
    5.  İşlenmiş, zenginleştirilmiş veri Firestore `news` koleksiyonuna kaydedilir.
    6.  Kullanıcı `http://localhost:3000/news` sayfasına girdiğinde Firestore'daki hazır veriyi (sayfalama - pagination ile) ultra hızlı okur.

---

## 3. Veritabanı Yapısı (Firestore: 'news' koleksiyonu)
Koleksiyona yazılacak örnek doküman (document) yapısı:
```json
{
  "id": "unique-news-id", // Kaynak site id'si veya hash
  "title": "NVIDIA Q4 kazançları beklentileri aştı, hisseler fırladı",
  "summary": "Grafik işlemci devinin gelirleri yapay zeka talebi ile %265 arttı.",
  "content": "Haberin tam veya kesilmiş metni...",
  "source": "Bloomberg",
  "url": "https://bloomberg.com/...",
  "imageUrl": "https://...",
  "publishedAt": "2026-04-05T14:00:00Z", // Timestamp
  "topics": ["earnings", "ai", "technology"], // Finnhub veya AI'nin kategorisi
  "tickers": ["NVDA", "AMD", "NASDAQ"], // Terminal bu haberin hangi varlıkları etkilediğini vurgulasın
  "aiSentiment": {
    "score": 0.85,  // -1 ile +1 arası yapay zeka skoru
    "label": "Bullish", // Bullish, Bearish, Neutral
    "summaryKeyPoint": "Yapay zeka çipleri talebi son derece yüksek."
  }
}
```

---

## 4. Uygulama Planı (Aşama Aşama)

### Aşama 1: Veritabanı ve Modelin Hazırlanması
1. `types/news.ts` oluşturularak TypeScript modelleri (yukarıdaki şema bazında) yazılacak.
2. `lib/firebase.ts` üzerinden Firestore'a yazma/okuma servis fonksiyonları (`services/news.service.ts`) ayarlanacak.

### Aşama 2: Arka Plan İşleyici (Cron Job / Worker)
1. Finnhub (veya seçilen API) anahtarları `.env.local`'a eklenecek.
2. `app/api/cron/fetch-news/route.ts` oluşturulacak. Bu API endpoint'i:
   - Haber kaynaklarına istek atacak.
   - Yapay zeka'dan (OpenAI API / Gemini) geçirecek (Bu aşama daha sonra da ilave edilebilir).
   - Yeni haberleri Firestore'a kaydedecek.

### Aşama 3: Frontend (Kullanıcı Arayüzü)
1. `app/news/page.tsx` ve `features/news/news-view.tsx` mock verilerden, `news.service.ts` ile Firestore'dan veri çeken yapıya geçirilecek.
2. Terminal UI kurallarına göre (shadcn, karanlık tema, yüksek data yoğunluklu tablolar, AI Score etiketleri - Bullish/Bearish tagları) tasarım iyileştirilecek.
3. Kripto, Hisse, BIST olarak haberlerin filtrelenebileceği bir toolbar konulacak.

---

## 5. Başlamak için ne yapmalıyız?
1. **Bir API Sağlayıcısı Seçin:** (En kolayı ve zengini Finnhub veya FMP'dir. Ücretsiz API key alabilirsiniz).
2. API Anahtarını bana verin veya mock bir API adresi ile sistemi kurmamı isteyin.
3. Arka plan Firestore yazma işlemlerini yazarak başlayalım.
