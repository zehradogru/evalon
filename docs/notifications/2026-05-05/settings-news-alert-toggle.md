# Özet

Watchlist haber bildirimi için Firestore `preferences.notifications.newsAlerts` alanı ile `news_alert_rules` dokümanını birlikte yöneten idempotent frontend helper tamamlandı. İlk uygulamadaki Settings toggle yüzeyi daha sonra `/notifications` çalışma alanına taşındı; güncel UI `Preferences` ve `Devices` sekmelerinden yönetilir.

# Değişiklik Listesi

- `frontend/services/news-alert-rules.service.ts` güncellendi.
- `frontend/hooks/use-news-alert-rules.ts` güncellendi.
- `frontend/features/notifications/notifications-view.tsx` güncellendi.
- `frontend/features/settings/settings-view.tsx` bildirim çalışma alanına yönlendiren giriş yüzeyine çevrildi.
- `frontend/components/providers.tsx` güncellendi.
- `docs/notifications/2026-05-05/settings-news-alert-toggle.md` eklendi.

# Teknik Detaylar

- `newsAlertRulesService.setDefaultRuleStatus()` eklendi:
  - Rule yoksa `users/{uid}/news_alert_rules/{autoId}` altında default watchlist rule oluşturur.
  - Rule varsa sadece `status` ve `updatedAt` alanlarını günceller.
  - Default rule alanları: `scopeType: "watchlist"`, `sentiments: ["OLUMLU", "OLUMSUZ", "NOTR"]`, `burstWindowMinutes: 10`, tarih alanları ISO string/null.
- `/notifications?tab=preferences` akışı:
  - `newsAlerts=true` için önce default rule oluşturulur/aktiflenir, sonra preference kaydedilir.
  - `newsAlerts=false` için preference kaydedildikten sonra mevcut rule paused yapılır.
- `/notifications?tab=devices` akışı:
  - Push enabled aksiyonu kullanıcı açıkça başlattığında `requestBrowserNotificationPermission()` çağrılır.
  - İzin `granted` olursa FCM token `registerDevice` callable'ına gönderilir ve `pushEnabled` kaydedilir.
- User-scoped query cleanup listesine `news-alert-rules` eklendi.
- `/api/news`, Firebase Functions, Cloud Job, Oracle ve backend haber/Firebase gönderim kodlarına dokunulmadı.

# Kontrol Listesi (Checklist)

1. `/notifications?tab=preferences` ekranında `Watchlist news notifications` toggle'ını aç.
2. Firestore'da `users/{uid}.preferences.notifications.newsAlerts` değerinin `true` olduğunu kontrol et.
3. Firestore'da `users/{uid}/news_alert_rules/{ruleId}` dokümanının `status: "active"` ve `sentiments` içinde `NOTR` ile oluştuğunu kontrol et.
4. Toggle'ı kapat; preference `false`, mevcut rule `paused` olmalı.
5. `/notifications?tab=devices` ekranında `Enable browser push` akışını ilk kez başlatırken browser permission prompt'unun çıktığını doğrula.
6. İzin verilirse `NotificationPushBootstrap` sonrasında `notification_devices/{deviceKey}` dokümanında token ve `active: true` yazıldığını kontrol et.
7. İzin reddedilirse settings kaydının hata verdiğini ve `pushEnabled` preference'ının kaydedilmediğini kontrol et.
8. `/api/news?symbols=THYAO&published_after=2026-05-01T00:00:00Z` isteğinin frontend route tarafından backend'e parametreleriyle iletilmeye devam ettiğini doğrula.

# Bilinen Sorunlar / Eksikler

- Push token'ın `active: true` olabilmesi için tarayıcı izninin yanında geçerli Firebase VAPID/web credentials yapılandırması gerekir.
- Settings ekranı bildirim detayı yönetmez; kullanıcı Preferences, Rules ve Devices sekmelerine yönlendirilir.
