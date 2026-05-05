# Özet

Sağ sidebar'daki Alert Rules widget'ı pasif bir önizleme olmaktan çıkarılıp hızlı durum izleme ve yönetim paneline dönüştürüldü. Panel artık gerçek Firestore rule alanları üzerinden arama, filtreleme, pause/resume, bulk status değişikliği, delete confirm ve deep link aksiyonları sunuyor.

# Değişiklik Listesi

- `frontend/features/notifications/alerts-view.tsx` değiştirildi.
- `docs/notifications/2026-05-05/alert-rules-sidebar-panel.md` eklendi.

# Teknik Detaylar

- Market rules için mevcut `useAlertRules`, `useSetAlertRuleStatus` ve `useDeleteAlertRule` hook'ları kullanıldı; `users/{uid}/alert_rules` şeması değiştirilmedi.
- Watchlist news rule için mevcut `useNewsAlertRules`, `useSetNewsAlertRuleStatus` ve `useDeleteNewsAlertRule` hook'ları kullanıldı; `users/{uid}/news_alert_rules` alanları, `NOTR` sentiment değeri ve fixed `burstWindowMinutes: 10` korunuyor.
- Sidebar rolü hızlı yönetim/durum monitörü olarak sınırlandı: detaylı market rule edit akışı `/alerts#rule-{id}`, news rule yönetimi `/notifications?tab=rules` üzerinden devam ediyor.
- `Active`, `Paused` ve `Triggered 24h` filtreleri tamamen mevcut `status` ve `lastTriggeredAt` alanlarından türetiliyor; backend'in desteklemediği quiet hours, snooze, ticker mute veya burst süresi değiştirme kontrolü eklenmedi.
- Delete aksiyonu mevcut dialog component'iyle onay gerektiriyor; durum değişiklikleri mevcut toast altyapısıyla kullanıcıya bildiriliyor.

# Kontrol Listesi (Checklist)

1. Sağ sidebar'dan Alerts panelini aç.
2. Header'da active, paused ve 24h sayılarının rule durumlarıyla uyumlu olduğunu kontrol et.
3. Search alanında ticker, condition veya sentiment arayarak listenin client-side filtrelendiğini doğrula.
4. `Active`, `Paused`, `Triggered 24h` chip'lerini kullanarak görünümün değiştiğini kontrol et.
5. Market rule kartında `Pause` ve `Resume` aksiyonlarını çalıştır; Firestore `status` alanının değiştiğini doğrula.
6. Watchlist News kartında `Pause` ve `Resume` aksiyonlarını çalıştır; `sentiments` içindeki `NOTR` değerinin bozulmadığını doğrula.
7. Kebab menüden market rule için `Open/Edit` seç; `/alerts#rule-{id}` deep link'inin açıldığını kontrol et.
8. Kebab menüden news rule için `Manage` seç; `/notifications?tab=rules` görünümünün açıldığını kontrol et.
9. Delete aksiyonunda önce cancel, sonra confirm akışını test et.
10. Rule yokken empty state'in `/alerts` CTA'sını gösterdiğini kontrol et.

# Bilinen Sorunlar / Eksikler

- Sidebar market rule oluşturma veya detaylı sentiment edit yapmaz; bu akışlar bilerek tam sayfa rule yönetiminde tutuldu.
- Browser üzerinde authenticated veriyle manuel doğrulama gerekir; statik doğrulamada `npm run lint` 0 error / 39 mevcut warning ile geçti.
