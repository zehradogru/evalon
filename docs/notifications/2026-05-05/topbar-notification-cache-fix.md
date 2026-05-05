# Topbar Notification Cache Fix

## Özet

Topbar bildirim dropdown'unda `X` ile temizlenen unread bildirimin badge sayısından düşmesine rağmen listede kalması düzeltildi. Sorun, unread query cache'inde bildirimin sadece `isRead: true` yapılması ama unread listesinden çıkarılmamasıydı.

## Değişiklik Listesi

- `frontend/hooks/use-notifications.ts` güncellendi.

## Teknik Detaylar

- `useMarkNotificationAsRead()` artık `notifications` query cache'lerini filtre türüne göre ayırır.
- `filter === "unread"` olan query cache'lerinde read yapılan item listeden çıkarılır.
- `filter !== "unread"` olan query cache'lerinde item listede kalır ama `isRead/readAt` alanları güncellenir.
- `useMarkAllNotificationsAsRead()` için aynı ayrım uygulandı; unread query'leri boşalır, all query'leri read state'e çekilir.
- Firestore şeması, backend callable'ları, Firebase Functions ve bildirim doküman alanları değiştirilmedi.

## Kontrol Listesi (Checklist)

1. Unread test bildirimi oluştur.
2. Topbar bildirim dropdown'unu aç.
3. Tek bir bildirimin `X` butonuna bas; kart listeden kaybolmalı ve badge sayısı azalmalı.
4. Son bildirimin `X` butonuna bas; dropdown boş state göstermeli ve topbar badge kaybolmalı.
5. İki unread bildirim varken `Tümünü Temizle` butonuna bas; dropdown boş state göstermeli ve unread sayısı `0` olmalı.
6. `/notifications` Inbox içinde `Unread` ve `All` filtrelerinin ayrıştığını kontrol et.

## Bilinen Sorunlar / Eksikler

- Test sırasında kullanılan geçici kullanıcı ve seed bildirimler test bitiminde temizlenmelidir.
