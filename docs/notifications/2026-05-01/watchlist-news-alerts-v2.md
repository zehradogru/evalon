# Özet
V2 ile mevcut notification merkezi watchlist tabanlı haber bildirimlerini destekleyecek şekilde genişletildi. Kullanıcı artık `/alerts` içinden tek bir watchlist news rule yönetebiliyor; eşleşen haberler 10 dakikalık burst pencerelerinde gruplanıp inbox ve browser push olarak teslim ediliyor.

# Değişiklik Listesi
- `backend/backtest/api/main.py`
- `firestore.rules`
- `firestore.indexes.json`
- `frontend/app/news/page.tsx`
- `frontend/features/news/news-view.tsx`
- `frontend/features/notifications/alerts-view.tsx`
- `frontend/features/notifications/notifications-view.tsx`
- `frontend/features/settings/settings-view.tsx`
- `frontend/hooks/use-news-alert-rules.ts`
- `frontend/hooks/use-notifications.ts`
- `frontend/lib/notification-firestore.ts`
- `frontend/services/news-alert-rules.service.ts`
- `frontend/services/news.service.ts`
- `frontend/services/notifications.service.ts`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/types/index.ts`
- `functions/src/index.ts`

# Teknik Detaylar
- Firestore altında yeni koleksiyon yapısı eklendi:
  - `users/{uid}/news_alert_rules/{ruleId}`
  - `users/{uid}/news_alert_rules/{ruleId}/matches/{articleId}`
- Yeni frontend tipleri eklendi:
  - `WatchlistNewsAlertRule`
  - `WatchlistNewsAlertMatch`
  - `NotificationKindFilter`
  - `NewsAlertSentiment`
- `/alerts` ekranına market rules ile aynı merkezde çalışan `Watchlist News Rule` yönetim alanı eklendi.
- News rule tarafında V2 kapsamı bilinçli olarak tek rule ile sınırlandı; servis katmanı ikinci rule oluşturmayı engelliyor.
- `/notifications` sayfası artık `All`, `Price`, `Indicator`, `News`, `System` filtreleriyle sorgu yapıyor.
- News notification payload’ı şu alanları taşıyor:
  - `articleIds`
  - `tickers`
  - `count`
  - `windowStart`
  - `windowEnd`
- `/settings` içinde `Watchlist News Alerts` toggle görünür hale getirildi ve backend enforcement ile bağlandı.
- Backend `/v1/news` endpoint’i genişletildi:
  - mevcut `symbol` desteği korundu
  - yeni `symbols` CSV parametresi eklendi
  - yeni `published_after` parametresi eklendi
  - sonuç sırası `PUBLISHED_AT DESC NULLS LAST` olarak korundu
- Firebase Functions tarafında yeni scheduler eklendi:
  - `evaluateNewsAlertRules`
  - her dakika çalışır
  - kullanıcı `preferences.notifications.newsAlerts` kapalıysa evaluation yapmaz
  - kullanıcının güncel `watchlist.tickers` listesini okur
  - `/v1/news` endpoint’ini `symbols` ve `published_after` ile çağırır
  - seçili sentiment’lere uyan yeni haberleri `matches` altında `pending` olarak biriktirir
  - `windowEnd <= now` olduğunda pending match’leri gruplayıp tek inbox kaydı ve tek push üretir
- Mevcut market rule scheduler’ı da preference enforcement kazanmıştır:
  - `priceAlerts=false` ise price rule evaluation atlanır
  - `indicatorAlerts=false` ise indicator rule evaluation atlanır
  - `pushEnabled=false` ise inbox kaydı korunur, browser push gönderilmez
- Firestore indexleri şu yeni sorguları kapsayacak şekilde genişletildi:
  - notifications `kind + createdAt`
  - notifications `isRead + kind + createdAt`
  - news matches `status + windowEnd`

# Kontrol Listesi
1. Giriş yaptıktan sonra `/alerts` sayfasına gidip `Watchlist News Rule` alanından sentiment seçip rule oluştur.
2. Watchlist’te en az bir ticker olduğundan emin ol; watchlist boşsa news rule butonunun pasif kaldığını doğrula.
3. `/settings` içinden `Watchlist News Alerts` ve `Push Notifications` toggle’larını açıp kaydet.
4. `/notifications` sayfasında `News` filtresini seç; gönderilen grouped news kayıtlarının yalnız bu filtreden geldiğini doğrula.
5. `/news?symbols=THYAO,GARAN` gibi bir deep link açıp sayfanın sembol filtresini doğru uyguladığını kontrol et.
6. Aynı 10 dakikalık pencereye düşen birden fazla haberde tek notification üretildiğini doğrula.
7. `pushEnabled=false` durumunda inbox kaydının oluştuğunu ama browser push gitmediğini kontrol et.
8. `newsAlerts=false` durumunda scheduler’ın yeni news notification üretmediğini doğrula.
9. `npm run build` komutunun `frontend` ve `functions` içinde geçtiğini doğrula.

# Bilinen Sorunlar / Eksikler
- V2 yalnızca tek bir aktif watchlist news rule destekler; çoklu news rule senaryosu sonraki faza bırakıldı.
- `/news` ekranındaki query tabanlı filtreleme ilk yüklemede uygulanır; aynı sayfa üzerinde URL query’si sonradan değiştirilirse sayfayı yeniden açmak daha güvenlidir.
- `npm run lint` halen repoda önceden var olan 43 warning döndürüyor; V2 tarafında bloklayıcı lint hatası bırakılmadı.
