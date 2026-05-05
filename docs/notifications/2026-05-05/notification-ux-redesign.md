# Notification UX Redesign

## Özet

Bildirim yönetimi tek bir `/notifications` çalışma alanında toplandı: Inbox, Rules, Preferences ve Devices sekmeleri eklendi. Backend, Firebase Functions, Cloud Job, `/api/news`, Firestore şeması, `NOTR` sentiment etiketi ve sabit 10 dakikalık burst davranışı değiştirilmedi.

## Değişiklik Listesi

- `frontend/features/notifications/notifications-view.tsx`: Dört sekmeli bildirim çalışma alanı, inbox filtreleri, tercih paneli ve cihaz paneli eklendi.
- `frontend/features/notifications/alerts-view.tsx`: Alert rule içeriği reusable `AlertRulesPanel` yapısına taşındı; watchlist news rule sentiment düzenleme inline draft + Save akışına çevrildi.
- `frontend/lib/notification-categories.ts`: Aktif ve ileride kullanılacak bildirim kategorileri için registry ve deep-link helperları eklendi.
- `frontend/components/dashboard/navbar.tsx`: Bildirim dropdown item gövdesi tıklanabilir hale getirildi; clear/read butonu ayrı tutuldu.
- `frontend/features/settings/settings-view.tsx`: Eski ham bildirim switchleri kaldırıldı; Settings artık kullanıcıyı `/notifications` sekmelerine yönlendiriyor.
- `frontend/services/news-alert-rules.service.ts`: Settings/Preferences için idempotent default watchlist news rule status helperı kullanılıyor.
- `frontend/hooks/use-news-alert-rules.ts`: Default news rule status mutation ve cache invalidation akışı kullanılıyor.
- `frontend/components/providers.tsx`: Kullanıcı scoped cache temizliğine `news-alert-rules` eklendi.

## Teknik Detaylar

- Inbox `users/{uid}/notifications` koleksiyonunu okur, `isRead/readAt` alanlarını `markAsRead` ve `markAllAsRead` ile günceller.
- News notification deep link davranışı `payload.tickers` üzerinden `/news?symbols=...` üretir; haber başlıkları payload’da olmadığı için burst görünümü ticker chip’li tek kart olarak kaldı.
- Rule-backed bildirimler `/alerts#rule-{ruleId}` adresine gider; `/alerts` route’u kaldırılmadı ve aynı `AlertRulesPanel` yüzeyini standalone göstermeye devam eder.
- Rules paneli `users/{uid}/alert_rules` ve `users/{uid}/news_alert_rules` koleksiyonlarını okur/yazar; news rule için `scopeType: "watchlist"`, `sentiments: ["OLUMLU", "OLUMSUZ", "NOTR"]` sözleşmesi ve `burstWindowMinutes: 10` korunur.
- Preferences paneli yalnızca çalışan alanları gösterir ve `preferences.notifications.priceAlerts`, `indicatorAlerts`, `newsAlerts` alanlarını günceller; `newsDigest` UI’dan çıkarıldı.
- Devices paneli `users/{uid}/notification_devices` koleksiyonunu okur, `registerDevice` ve `sendTestNotification` callable function’larını çağırır; push izni kullanıcı açıkça Enable aksiyonu verdikten sonra istenir.
- Generic kategori yapısı registry seviyesinde `community` ve `earnings` için hazırlandı; bu kategorilerin backend veya UI davranışı bu sürümde implemente edilmedi.

## Kontrol Listesi (Checklist)

- `/notifications` sayfasında Inbox, Rules, Preferences ve Devices sekmelerini aç.
- Inbox’ta unread/all filtresini, kategori chiplerini, aramayı, item click ile deep link ve read güncellemesini kontrol et.
- Watchlist news notification kartının ticker chip, count ve `/news?symbols=...` CTA davranışını kontrol et.
- Rules sekmesinde news sentiment chiplerini değiştir, Save ile Firestore yazımını kontrol et ve son sentiment’in kaldırılamadığını doğrula.
- `/alerts#rule-*` deep linklerinin eski route üzerinde aynı Rules yüzeyine kaydığını kontrol et.
- Preferences sekmesinde `priceAlerts`, `indicatorAlerts`, `newsAlerts` switchlerini aç/kapat ve `news_alert_rules` status değişimini kontrol et.
- Devices sekmesinde default, granted, denied ve unsupported push izin durumlarını; token kaydı, last seen ve test push akışını kontrol et.
- Navbar dropdown’da item gövdesine tıklayınca ilgili deep link’e gidildiğini, `X` butonunun sadece read/clear yaptığını kontrol et.
- `frontend` içinde `npm run lint` çalıştır.

## Bilinen Sorunlar / Eksikler

- Quiet hours, snooze, ticker bazlı news mute ve digest bu sürümde yoktur; backend desteklemediği için sahte UI eklenmedi.
- News burst detayında haber başlıkları gösterilmez; backend tek notification kaydı yazdığı için detay listelemek frontend tarafında güvenilir değildir.
- Community ve earnings kategorileri yalnızca metadata zemini olarak eklendi; gerçek bildirim davranışı sonraki backend işiyle gelecektir.
