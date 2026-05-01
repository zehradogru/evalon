# Özet
Watchlist news alerts V2 sonrasında görülen iki ana runtime hata giderildi: market rule create akışında Firestore'a `undefined` alan yazılması engellendi ve news alert koleksiyonları için eksik kalan canlı Firestore kuralları yayınlandı. Ayrıca Firebase Functions ve backend Cloud Run servisi güncellenerek watchlist news scheduler'ın kullandığı `symbols` ve `published_after` query contract'ı production ortamına taşındı.

# Değişiklik Listesi
- `frontend/services/alert-rules.service.ts`
- `docs/notifications/2026-05-02/watchlist-news-alerts-runtime-fixes.md`
- canlı deploy:
  - Firestore rules
  - Firestore indexes
  - Firebase Functions
  - Cloud Run backend (`evalon-backtest-api`)

# Teknik Detaylar
- `frontend/services/alert-rules.service.ts` içinde Firestore'a yazılmadan önce filter nesneleri recursive olarak sanitize edildi.
- Bu sayede `price` filtrelerinde üretilen `value2: undefined` gibi alanlar artık `setDoc()` içine düşmüyor.
- Firestore tarafında `news_alert_rules` ve `matches` kuralları `evalon-auths` projesine deploy edildi.
- Firebase Functions deploy ile şu canlı fonksiyonlar güncellendi:
  - `registerDevice`
  - `sendTestNotification`
  - `evaluateAlertRules`
  - `evaluateNewsAlertRules`
- Canlı haber datasında baskın olan `BEKLIYOR` sentiment değeri, scheduler içinde `Neutral` (`NOTR`) bucket'ına eşlendi.
- Varsayılan watchlist news rule sentiment seçimi `Positive + Negative + Neutral` olacak şekilde genişletildi.
- Cloud Run backend yeni revision ile deploy edildi:
  - servis: `evalon-backtest-api`
  - revision: `evalon-backtest-api-00016-qr9`
- Production `/v1/news` endpoint'i deploy sonrası yeniden doğrulandı:
  - `symbols=THYAO` artık yalnız ilgili sembolü döndürüyor
  - `symbols=THYAO,GARAN` çoklu sembol sorgusu çalışıyor
  - `published_after=2026-04-30T00:00:00Z` filtresi boş sonuç döndürerek zaman filtresinin aktif olduğunu doğruluyor

# Kontrol Listesi
1. `/alerts` sayfasında bir market rule oluştur ve kırmızı `Unsupported field value: undefined` hatasının artık çıkmadığını doğrula.
2. Aynı sayfada `Watchlist News Rule` bölümünün `Missing or insufficient permissions` göstermediğini doğrula.
3. Watchlist'te ticker varken news rule oluştur, kaydet ve tekrar yükle.
4. `/notifications` sayfasında `News` filtresinin açıldığını ve sayfanın yüklenmeye devam ettiğini doğrula.
5. Browser push açıkken `Send test notification` akışının çalıştığını kontrol et.
6. Production backend smoke test olarak `/v1/news?symbols=THYAO&limit=3` çağrısının yalnız `THYAO` haberleri döndürdüğünü doğrula.
7. Production backend smoke test olarak `/v1/news?symbols=THYAO&published_after=2026-04-30T00:00:00Z&limit=3` çağrısının zaman filtresini uyguladığını doğrula.
8. News rule varsayılan seçiminde `Neutral` kartının seçili geldiğini doğrula.

# Bilinen Sorunlar / Eksikler
- Frontend lint çıktısında repo genelinden gelen 43 warning devam ediyor; bu oturumda yeni bloklayıcı lint hatası bırakılmadı.
- Frontend kod değişiklikleri yerelde hazır; merkezi branch'e push kullanıcı isteğiyle bu oturumda yapılmadı.
