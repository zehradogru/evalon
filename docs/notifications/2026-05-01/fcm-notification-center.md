# Özet

FCM tabanlı web push akışı, kullanıcıya özel notification inbox yapısı ve çoklu koşullu ticker alert rule yönetimi eklendi. `/alerts` artık kural yönetim merkezi, `/notifications` ise okunma durumu ve push teslimatı izlenebilen gerçek bildirim sayfası olarak çalışır.

# Değişiklik Listesi

- `frontend/app/alerts/page.tsx` eklendi.
- `frontend/app/notifications/page.tsx` eklendi.
- `frontend/features/notifications/alerts-view.tsx` yeniden yazıldı.
- `frontend/features/notifications/notifications-view.tsx` yeniden yazıldı.
- `frontend/src/components/layout/Sidebar.tsx` güncellendi.
- `frontend/components/providers.tsx` güncellendi.
- `frontend/components/notifications/notification-push-bootstrap.tsx` eklendi.
- `frontend/lib/firebase.ts` güncellendi.
- `frontend/lib/firebase-messaging.ts` eklendi.
- `frontend/lib/notification-rules.ts` eklendi.
- `frontend/lib/notification-firestore.ts` eklendi.
- `frontend/services/alert-rules.service.ts` eklendi.
- `frontend/services/notifications.service.ts` eklendi.
- `frontend/services/notification-devices.service.ts` eklendi.
- `frontend/services/alerts.service.ts` yeni rule modeline yönlendirildi.
- `frontend/hooks/use-alert-rules.ts` eklendi.
- `frontend/hooks/use-notifications.ts` eklendi.
- `frontend/hooks/use-notification-devices.ts` eklendi.
- `frontend/features/settings/settings-view.tsx` güncellendi.
- `frontend/services/profile.service.ts` güncellendi.
- `frontend/types/index.ts` güncellendi.
- `frontend/public/firebase-messaging-sw.js` eklendi.
- `functions/package.json` eklendi.
- `functions/tsconfig.json` eklendi.
- `functions/src/index.ts` eklendi.
- `firebase.json` güncellendi.
- `firestore.rules` güncellendi.
- `firestore.indexes.json` eklendi.
- `.gitignore` güncellendi.
- `docs/notifications/2026-05-01/fcm-notification-center.md` eklendi.

# Teknik Detaylar

- Yeni veri modeli:
  - `users/{uid}/alert_rules/{ruleId}`
  - `users/{uid}/notifications/{notificationId}`
  - `users/{uid}/notification_devices/{deviceId}`
- `NotificationPreferences` alanları genişletildi:
  - `pushEnabled`
  - `priceAlerts`
  - `indicatorAlerts`
  - `newsAlerts`
  - `newsDigest`
- Eski `users/{uid}.alerts` array alanı, ilk rule okumasında `alert_rules` alt koleksiyonuna idempotent migration ile taşınır.
- Alert rule dokümanları tek ticker, timeframe, `AND/OR` logic ve screener filtreleri ile saklanır.
- Kural cadence mantığı:
  - sadece `price` filtresi içeren kurallar: dakikalık
  - diğer filtre tipleri: seçili timeframe close boundary
- Frontend push akışı:
  - `firebase-messaging-sw.js` service worker kaydı
  - foreground `onMessage` toast
  - cihaz anahtarı (`deviceKey`) ile `registerDevice` callable senkronizasyonu
- Firebase Functions v2:
  - `registerDevice`: tarayıcı token ve izin bilgisini kullanıcı alt koleksiyonuna yazar
  - `sendTestNotification`: aktif cihaza test push yollar ve inbox kaydı üretir
  - `evaluateAlertRules`: due rule dokümanlarını collection-group query ile okuyup screener backend’i üzerinden değerlendirir
- Push gönderimi data-only payload ile yapılır; background gösterimi service worker tarafından oluşturulur.
- Invalid token dönen cihazlar otomatik olarak `active: false` ve `token: null` durumuna çekilir.
- Firestore indexleri:
  - `alert_rules` collection-group due query indexi
  - `notifications` unread + createdAt sıralama indexi
- Production frontend env anahtarları:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
  - `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
  - `NEXT_PUBLIC_EVALON_API_URL`
  - `EVALON_SCREENER_API_URL`
- Functions env anahtarları:
  - `EVALON_API_BASE_URL`
  - `EVALON_SCREENER_API_URL`

# Kontrol Listesi (Checklist)

1. Auth ile giriş yap.
2. `/settings` ekranında `Push notifications`, `Price alerts` ve `Indicator alerts` anahtarlarının göründüğünü doğrula.
3. `/alerts` ekranında yeni rule oluştur:
   - ticker seç
   - timeframe seç
   - birden fazla koşul ekle
   - `AND/OR` ile kaydet
4. Oluşturulan rule için edit, pause, resume ve delete akışlarını tek tek doğrula.
5. Eski `alerts` array verisi bulunan bir kullanıcıyla oturum açıp rule migration’ın tek sefer çalıştığını kontrol et.
6. `/notifications` ekranında `Unread` ve `All` sekmeleri arasında geçiş yap.
7. `Mark read` ve `Mark all read` işlemlerinin unread sayısını güncellediğini kontrol et.
8. `Allow browser notifications` aksiyonu ile tarayıcı izin akışını test et.
9. `Send test notification` ile foreground ve background push teslimatını test et.
10. Sidebar üzerinde:
   - Alerts aktif rule sayısı
   - Notifications unread badge
   güncellemelerini kontrol et.
11. Service worker kayıtlıyken push bildirime tıklayıp `/notifications` sayfasına yönlendiğini doğrula.
12. Firebase Functions deploy sonrası `evaluateAlertRules` scheduler loglarını kontrol et.
13. Firestore Rules Playground ile başka kullanıcının `alert_rules`, `notifications`, `notification_devices` verisine erişimin reddedildiğini doğrula.

# Bilinen Sorunlar / Eksikler

- Functions deploy ortamında `EVALON_API_BASE_URL` tanımlanmalıdır. İstemci tarafında `NEXT_PUBLIC_FIREBASE_VAPID_KEY` verilmezse tarayıcı token isteği FCM varsayılan web credentials akışıyla devam eder; proje bazlı public anahtar daha sonra eklenebilir.
- Scheduler UTC boundary kullanır; market-session-aware close hesabı bu fazda eklenmedi.
- `newsAlerts` veri modelinde hazırdır ancak haber tetikleyicisi bu fazda aktif değildir.
- Tarayıcı izni `denied` durumuna alınmışsa kullanıcı tarafında browser site settings üzerinden manuel geri açma gerekir.
