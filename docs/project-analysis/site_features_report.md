# Evalon Platformu - Mevcut Durum ve Gelecek Vizyonu Raporu

Bu rapor, Evalon platformunun şu anki sahip olduğu mimari ve özellikleri inceleyerek, platforma değer katabilecek potansiyel yeni eklentilerin çok detaylı ve geniş açılı bir analizini sunmaktadır.

---

## 1. ŞU ANDA VAR OLAN ÖZELLİKLER (Mevcut Sistem Altyapısı)

Mevcut proje yapısı modern, yüksek performanslı web teknolojileriyle ve veri odaklı bir backend altyapısıyla kurgulanmıştır.

### A. Frontend (Kullanıcı Arayüzü & Deneyimi)
*Teknoloji: Next.js 16.1.6, React 19, TailwindCSS 4, Zustand, Firebase*
*   **Modern ve Premium Tasarım Dili:** Dark-theme odaklı (uzay temalı arka planlar), "glassmorphism" (buzlu cam efekti) içeren, akıcı (300ms transition) ve yatırımcı ciddiyetine uyan bir UI sistemi.
*   **Kimlik Doğrulama (Auth) Sistemi:** Firebase entegre edilmiş Login (Giriş), Sign up (Kayıt) ve Forgot Password (Şifre yenileme) sayfaları. Korumalı sayfalar (Protected routes) oluşturulmuş durumda.
*   **Dashboard (Ana Panel):** 
    *   Üst navigasyon çubuğu (Top navbar).
    *   Özet istatistikleri ve genel durumu gösteren modern kartlar.
    *   **Piyasa Görünümü Chart:** `recharts` ile hazırlanmış, borsa fiyat değişimlerini gösteren interaktif alan.
    *   **Watchlist (İzleme Listesi) Widget'ı:** THYAO, GARAN, ASELS gibi belirli hisselerin güncel mini grafikleriyle listelendiği modül.
    *   **Piyasa Haberleri Widget'ı:** Kullanıcının piyasayla ilgili gelişmeleri yakalaması için carousel (kayan bant) yapısında haber akışı.
*   **Hazır/Taslak Sayfalar:** Yardım (Help), Gizlilik (Privacy) ve Kullanım Koşulları (Terms) sayfaları yayında. Ek olarak `ai`, `screener`, `backtest`, `correlation`, `calendar`, `community` gibi URL yapılarının çatısı hazır.

### B. Backend & Veri Yönetimi
*Teknoloji: Python, FastAPI, Oracle Database, Cloud Run*
*   **BIST Fiyat Veri API'si:** Oracle veritabanı (BIST_PRICES) üzerinden 124 adet BIST hissesine ait OHLCV (Açılış, Yüksek, Düşük, Kapanış, Hacim) verisi sağlanıyor.
*   **Zamana Bağlı Veri Çekimi (Timeframes):** 1 dakika, 5 dakika, 1 saat, günlük, haftalık gibi farklı zaman periyotlarında grafik veya analiz için veri sağlanabiliyor.
*   **Teknik İndikatör Motoru:** TA-Lib destekli. RSI vs. gibi teknik test indikatörleri için `/v1/indicators` üzerinden algoritmik hesaplamalar yaptırılabiliyor.
*   **Strateji ve Backtest Merkezi:** Geçmiş fiyat hareketleri üzerinden hisselerin strateji testlerini sağlamaya yönelik çekirdek modüller oluşturulmuş durumda.

### C. Yapay Zeka, Model ve Veri Toplama
*   **BIST BERT Model Eğitimi & Haber Etiketleme Sorunu:** Türkçe finansal haberler üzerinden duygu analizi yapmak için BERT tabanlı özel NLP modelleri (`bist_bert_model_v2`, `v3`) eğitiliyor. **Ancak şu anda eğitilen haberlerin etiketleme kalitesi yeterince iyi düzeyde değildir** (data labeling sürecinde veya model başarımında iyileştirmeye ihtiyaç vardır). Ek olarak, **bu model henüz ana web platformuna (siteye) entegre edilmemiştir**, şu an bağımsız bir araştırma/eğitim yapısı olarak durmaktadır.
*   **Web Scraping (Veri Kazıma):** Özellikle finans haberlerini vb. anlık olarak çekebilmek için `news_scraper` python botları ayarlanmış. Milyonlarca satırlık eğitim verisi ile çalışılmış (CSV dosyaları).

---

## 2. BU SİTEYE EKLENEBİLECEK ŞEYLER (Fikirler & Geliştirmeler)

Evalon'u standart bir borsa uygulamasından ayırıp, sınıfının en iyisi yapacak (premium investment platform seviyesine taşıyacak) detaylı özellik önerileri:

### A. İleri Düzey Finansal Araçlar
1.  **Gelişmiş Grafik Aracı (TradingView SDK):** Mevcut Recharts yerine TradingView Advanced Charts kütüphanesine geçiş yapılması. Kullanıcıların grafik üzerine kendi çizgilerini çekebilmesi, Fibonacci gibi araçları atabilmesi ve analizlerini profillerinde kaydedebilmesi.
2.  **Sanal Portföy & Paper Trading:** Önceden planlandığı gibi, kullanıcıya 100.000 TL sanal para tanımlanıp, canlı piyasa fiyatlarıyla hisse al-sat işlemi yapabilmesini sağlayacak sistem. Riski sıfır olan bu özellik site trafiğini muazzam artırır.
3.  **Hisse Tarayıcı (Screener) & Filtreler:** Temel analize (F/K, PD/DD, Favök) veya teknik analize (RSI < 30, MACD kesişimi) göre 500+ BIST hissesi içinden anlık filtreleme yapılabilmesi.
4.  **Algoritmik Trading (Auto-Trade & Botlar):** "Hareketli ortalamalar kestiğinde Aracı Kurum (Midas/Info) API'sine al emri gönder" gibi kullanıcıların kendi otonom trade botlarını kurabileceği sürükle-bırak strateji oluşturucular.

### B. Yapay Zeka (AI) ve Analitik Zeka
1.  **Haber Duygu Analizinin (NLP) Modeli ve Siteye Entegrasyonu:** Şu an veri seti etiketleme sorunları yaşayan BIST BERT duygu analizi modelinin düzeltilmesi ve doğrudan site backend'ine bağlanarak (API olarak) canlı sisteme entegre edilmesi. Böylece haberler sisteme düştüğünde otomatik olarak pozitif (+) veya negatif (-) etiketleriyle kullanıcılara yansıması.
2.  **Sohbet Tabanlı Yatırım Danışmanı (KG-RAG Altyapılı):** Sadece "Hisse şu kadar arttı" demek yerine, hisse senedinin PDF raporlarını, son açıklamalarını okuyup "Aselsan'ın son aldığı ihale haberlerinin etkisi ne olur?" sorusuna net bir analiz çıkaran bir LLM yapay zeka sekmesi.
3.  **Bilanço Analisti:** Şirketler bilanço açıkladığında (KAP bildirimleri), bu yüzlerce sayfalık PDF dosyalarını okuyup 1 dakika içinde kullanıcıya "Şirketin net karı şu kadar arttı ama döviz borçluluğu riskli" formatında özet çıkaracak araç.
4.  **Risk Profiling (Robo-Advisor):** Kullanıcı siteye kaydolduğunda yaş, gelir ve hedeflerini girdiği kısa bir algoritma ile; ona özel defansif, agresif veya dengeli "Sepet" fonları/hisseleri sunan özellik.
5.  **Sentiment Skoru Widget'ı:** Sitedeki özel veri toplama (scraper) modülleriyle internette (Twitter, haber sitelerinde vb.) X hissesi hakkında konuşulanların yüzdesel tablosu ("Bugün THYAO hakkında piyasa hissiyatı %78 Pozitif").

### C. Kullanıcı Etkileşimi (Community & Gamification)
1.  **Liderlik Tabloları (Leaderboard):** Paper Trading kullanan yatırımcılardan yüksek kârlar edenlerin platform içerisinde sıralamalarının olması, amatörlerin bu portföyleri (Social/Copy Trade mantığıyla) kopyalayabilmesi.
2.  **Fiyat ve İndikatör Alarmları:** Kullanıcı "THYAO 290 TL'yi aşarsa" ya da "RSI 70'in üzerine çıkarsa (aşırı alım)" şeklinde alarm kurduğunda bildirim, SMS veya E-Posta atılması.
3.  **Kullanıcı Analiz Paylaşım Forumu (Community):** Kullanıcıların, çizdikleri TradingView grafiklerini diğer üyelerle bir sosyal medya "Feed" yapısında paylaşıp tartışabileceği bir platform köşesi.

### D. Çok Yönlülük & Kapsam
1.  **Global Piyasalar (Nasdaq/Kripto Entegrasyonu):** Yalnızca BIST odaklanmak yerine ABD hisse senetleri (S&P 500, Nasdaq), altın, gümüş ve majör kripto paraların canlı verilerinin sisteme taşınması.
2.  **Kapsamlı Ekonomi Takvimi (Macro Events):** Fed faiz karar günleri, Türkiye enflasyon verisi açıklanma saatleri gibi piyasayı çok etkileyecek takvim modülünün saat sayacı ile eklenmesi.
3.  **Korelasyon Analizi Aracı:** İki ayrı varlığı (örn. Dolar ve X hissesi) aynı grafikte kıyaslayıp ters mi, doğru mu orantılı ilerlediğini gösteren istatistik modülü.
4.  **Temettü (Kar Payı) ve Sermaye Artırımları Takibi:** Kullanıcıların takvim üzerinden hangi hisselerin yakında hisse başı ne kadar temettü vereceğini kolayca görebileceği finansal bir ajanda.
5.  **Isı Haritası (Heatmap):** Endeksin (BIST 100) anlık durumunu renklendirilmiş (Yeşil ve Kırmızı) şirket kutuları büyüklüğüyle (Piyasa değerine göre) anında genel piyasa bakışını verecek bir dashboard eklentisi.

---

## 3. OKUL BİTİRME PROJESİ İÇİN UYGUN, KOLAY EKLENEBİLİR ÖZELLİKLER

Yukarıdaki özellikler (Gelişmiş LLM RAG, Portföy Yönetimi, TradingView SDK vb.) oldukça profesyonel, vakit alan ve ticari seviyede yeteneklerdir. Projenin bir **üniversite bitirme ödevi** olduğu bağlamında; kodlaması çok kısa süren (birkaç saat/gün) ancak jüriye gösterişli ve işlevsel görünen pratik eklentiler şunlardır:

1. **Kar-Zarar Hesaplayıcı (Profit/Loss Calculator):** Kullanıcının "Alış Fiyatı", "Satış/Hedef Fiyat" ve "Lot Sayısı" girdiği alanlardan hesaplama yapıp, komisyonu da (örn. Binde 2) düşüp sonucu şık animasyonlarla ekrana veren basit bir araç.
2. **Dinamik İzleme Listesi (Watchlist DB Bağlantısı):** Watchlist tasarımınız zaten var, ancak bunu kullanıcının Firebase/Hesap profiline bağlayarak, sadece "Yıldızladığı" hisseleri bu listede tutmasına olanak veren basit CRUD işlemi.
3. **Günün En Çok Düşenleri / Yükselenleri (Top Gainers/Losers):** Çok karmaşık backtest'lere gerek kalmadan, sadece elinizdeki gün sonu fiyat datasını `sort()` metoduyla sıralayıp; en iyi 5 ve en kötü 5 hisseyi anasayfaya yeşil ve kırmızı yüzdelerle yerleştirmek. (Çok havalı durur, çok basittir).
4. **Haberler İçin Canlı Arama (Live Search):** Elinizdeki çektiğiniz haberlerin olduğu ekrana basit bir arama çubuğu ekleyerek frontend'de JavaScript `.filter()` ile sadece kullanıcının girdiği harfleri içeren başlıkların kalmasını sağlayan hızlı arama mekanizması.
5. **Finansal Sözlük / Eğitim Sekmesi (Academy):** Hiçbir şekilde veritabanı veya API istemeyen, sadece Frontend üzerinden güzel kart (card) ve ikon tasarımlarıyla borsa terimlerinin (RSI, MACD, Ayı Piyasası, Direnç vs.) anlatıldığı "Borsa Akademisi" gibi statik bir sayfa. Eğitim projeleri hocaların en çok sevdiği eklentilerdir.
6. **Dark/Light Mode (Açık/Koyu Tema Geçişi):** Menüye konulacak bir Ay/Güneş ikonuyla Next.js ve Tailwind'in hazır `next-themes` kütüphanesi kullanılarak bir tıkla sayfaların renk skalasının değiştirilmesi. Jüri gözünde direkt "Uygulama tamamlanmış ve cilalanmış" hissi yaratır.

---

## 4. SİTEDE HİÇ OLMAYAN ANCAK BİR BORSA/FİNANS PLATFORMUNDA OLMASI BEKLENEN EKSİKLİKLER (Brainstorming)

Şu anki kod tabanına veya planlara dahil edilmemiş, ancak sektördeki benzer uygulamalarda (TradingView, Midas, investing.com vb.) standart haline gelmiş temel özellikler şunlardır:

1. **Şirket Temel Analiz Profili:** Sadece hisse grafiği değil; şirketin CEO'su kim? Ne iş yapar? Kaç çalışanı var? Merkezi nerede? Halka açıklık oranı nedir? gibi şirketin "kimliğini" anlatan detay (About) sayfası.
2. **Kullanıcı Finansal Geçmişi (Cüzdan Simülasyonu):** Kullanıcı profilinde "Para Yatır", "Para Çek", "Geçmiş İşlemlerim (Hesap Özeti)" gibi, bankacılık sitelerinde olan bir cüzdan (Wallet) panelinin eksikliği.
3. **Güvenlik Çemberi (2FA - İki Faktörlü Doğrulama):** Finans sitelerinin olmazsa olmazı olan SMS veya Authenticator (Örn: Google Auth) ile giriş yapma seçeneği (Şu an Firebase var ancak 2FA arayüze konfigüre edilmeli).
4. **Halka Arz (IPO) Takvimi:** Türkiye piyasasında (BIST) çok popüler olan "Yaklaşan Halka Arzlar" listesi. Şirket adı, lot fiyatı, talep toplama tarihleri gibi bilgileri veren basit bir statik sayfa.
5. **KAP (Kamuyu Aydınlatma Platformu) Anlık Akışı:** Sadece haber siteleri değil, doğrudan borsa şirketlerinin resmi KAP açıklamalarının (Bilanço, yeni ihale, iş ilişkisi belgeleri) düştüğü özel bir ticker (kayan bant) veya akış sayfası.
6. **PWA (Telefona İndirilebilir Web App):** Sitenin kök dizinine bir `manifest.json` eklenerek masaüstü ve mobilde "Uygulama Gibi Yükle" diyerek telefona gerçek bir uygulama olarak inebilir duruma (Progressive Web App) çevrilmesi.

---

## 5. MEVCUT MOCK (SAHTE) SAYFALARIN CANLIYA ALINMA REHBERİ (How to Production)

Projenin `app/` dizini altında yer alan ancak henüz "Mock" (sahte/yer tutucu) verilerle dönen veya tamamen boş olan sayfaları gerçek dünya verisine (Production) geçirmek için yapılması gereken teknik adımlar:

### A. Markets (Piyasalar) Sayfası
*   **Şu Anki Durum:** Frontend klasöründeki `markets.mock.ts` verileri üzerinden sahte rakamlar dönüyor.
*   **Canlıya Alma Planı:**
    *   Backend tarafında tüm BIST hisselerinin **"Günün son kapanış fiyatı"** ve **"% Değişimi"** bir kere hesaplanıp topluca `/v1/markets/summary` adlı tek bir endpoint vasıtasıyla dışarı açılmalı.
    *   Frontend (React Query vs. üzerinden) bu endpoint'e istek atıp dönen JSON'u ana tablo (Data Table) bileşenine bağlamalıdır.

### B. News (Haberler) Sayfası
*   **Şu Anki Durum:** Sadece dashboard'da carousel gibi dönen mock haberler var.
*   **Canlıya Alma Planı:**
    *   Sistemde halihazırda var olan `news_scraper` botlarınızın Oracle/Veritabanına yazdığı haberler backend API'sinde `/v1/news?page=1&limit=20` tarzı bir pagination (sayfalama) endpointine çevrilmeli.
    *   Frontend'de bu veriler şık bir "Haber Kartı" tasarımına gömülüp sayfa sonuna inildikçe yüklenen (Infinite Scroll) bir yapıya dönüştürülmeli.

### C. Screener (Hisse Tarama) Sayfası
*   **Şu Anki Durum:** URL yapısı var, işlevsiz.
*   **Canlıya Alma Planı:**
    *   Frontend arayüzüne "RSI Seviyesi", "MACD Kesişimi", "Günün Hacmi" gibi çubuk (Slider) tarzı filtre form elemanları yerleştirilmeli.
    *   Kullanıcı filtrele butonuna basınca backend'e `GET /v1/screener?min_rsi=50&min_vol=1M` şekilde parametre gönderilmeli. Backend TA-Lib kütüphanesini kullanarak bu şarta uyan hisse kodlarını saniyeler içinde hesaplayıp (Array şeklinde) geri döndürmelidir.

---

## 6. MÜHENDİSLİK (SOFTWARE ENGINEERING) AÇISINDAN PROJEYE DEĞER KATACAK GELİŞTİRMELER

Akademik bitirme projelerinde jürinin (hocaların) asıl odaklandığı nokta borsa özelliklerinin ne kadar renkli olduğu değil, **"Karmaşık bilgisayar mühendisliği problemlerinin nasıl çözüldüğü ve mimarinin ne kadar güçlü olduğu"** prensibidir. Projenin akademik ve endüstriyel mühendislik değerini (Engineering Value) zirveye taşıyacak teknik eklentiler şunlardır:

1. **Memcached / Redis ile Caching (Önbellekleme) Altyapısı:** Borsa geçmiş verileri sabittir (Örn: 2 ay önceki THYAO fiyatı değişmez). Frontend her açıldığında Oracle DB veritabanına sorgu atmak yerine araya bir **Redis** bellek katmanı eklenerek; API yanıt süresinin (latency) grafiğiyle birlikte 600ms'den 25ms'ye düşürüldüğünün raporda jüriye kanıtlanması.
2. **WebSocket Mimarisi (Gerçek Zamanlı Veri Kanalları):** Klasik web projeleri API'lere sürekli `setInterval` (polling) ile istek atar. Bunun yerine sisteme **WebSocket (FastAPI WebSockets / Socket.io)** entegre ederek, backend'in hisse fiyatı değiştikçe Frontend'i "Push" metoduyla doğrudan güncellemesini sağlayan (High Frequency Data Streaming) bir mimari kurmak. Sistem yükünü dramatik olarak azaltır.
3. **Event-Driven (Olay Güdümlü) Görev Kuyrukları (RabbitMQ / Celery):** Modelinizin bir haberin duygu analizini yapması veya ağır bir backtest işlemini çalıştırması uzun sürebilir. Kullanıcının web ekranını kilitlememek (Non-blocking I/O) için bu analiz isteklerini arka planda bir Mesaj Kuyruğuna (Message Broker) atıp işlem bitince Frontend'e geri bildirim yollayacak gerçek bir asenkron kuyruk mimarisi yaratmak.
4. **Dağıtık Sistem Mimarisi (Microservices):** "Haber Toplayıcı (Scraper)", "Ana API (FastAPI)" ve "Yapay Zeka RAG Motoru" gibi modülleri tek bir büyük "Monolith" yapı olarak değil, izole edilmiş bağımsız mikroservisler (Docker Container'ları) olarak konuşturmak.
5. **System Observability (Sistem Gözlemleme & Telemetri):** Sisteminize Prometheus veya Datadog gibi bir izleme aracı bağlayarak; "Günde modele kaç prompt atıldı", "En yavaş çalışan API endpointi hangisi", "Sistem RAM kullanımı ne durumda" gibi verilerin görselleştirildiği bir **Developer (Geliştirici) Dashboard'u** eklemek. (Hocaların en etkilendiği, profesyonellik göstergesi noktalardan biridir).
6. **Güçlü Bir DevOps (CI/CD) Zinciri (GitHub Actions):** Bir geliştirici "Push" attığında sırasıyla; kodun format otomatik düzeltmesinden (Linter) geçmesi, yazdığınız Unit Testlerin (Pytest/Jest) backend'i test etmesi ve testler başarıyla geçerse Docker imajının paketlenip Cloud Run'da otomatik ayağa kalkması. Projeyi sıradan bir ödev olmaktan çıkarıp "kurumsal çapta standart bir ürün" seviyesine yükseltir.
