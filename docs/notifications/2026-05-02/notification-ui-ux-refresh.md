# Notification UI/UX Refresh

## Özet

Bildirim kapsamındaki topbar, sidebar, tam sayfa notification merkezi, alert rule yönetimi ve toast bileşenleri sadeleştirildi. Yeni düzen; okunabilirlik, durum ayrımı, dokunma alanı, klavye erişimi ve live region davranışlarını iyileştirir.

## Değişiklik Listesi

- `frontend/components/dashboard/navbar.tsx`: Topbar notification butonu gerçek unread count ile `/notifications` sayfasına bağlandı.
- `frontend/src/components/layout/Sidebar.tsx`: Notification ve alert girişlerine dinamik ARIA etiketleri, focus görünümü ve 44px dokunma alanı eklendi.
- `frontend/features/notifications/notifications-view.tsx`: Notification merkezi sadeleştirildi; tip ikonları, token tabanlı renk ayrımı, erişilebilir liste semantiği ve kompakt push durum alanı eklendi.
- `frontend/features/notifications/alerts-view.tsx`: Alert yönetimi daha temiz hale getirildi; açıklama metinleri azaltıldı, hata/uyarı feedbackleri alert kutularına taşındı ve delete aksiyonları tehlike stiliyle ayrıldı.
- `frontend/components/ui/toaster.tsx`: Toast görsel sistemi yenilendi; tip ikonları, slide/fade animasyonları, Escape kapatma ve ARIA live davranışı eklendi.
- `frontend/hooks/use-toast.ts`: Toast tipleri genişletildi ve 200ms çıkış/collapse state yönetimi eklendi.
- `docs/notifications/2026-05-02/notification-ui-ux-refresh.md`: Bu rapor eklendi.

## Teknik Detaylar

- Keşif sonucu notification kapsamı şu yüzeylerde toplandı: topbar zili, sağ sidebar `Alerts` ve `Notifications` ikonları, `/notifications`, `/alerts`, toast sistemi, push bootstrap akışı, notification servisleri ve ilgili hooklar.
- Mevcut tasarım sorunları: topbar zili statikti; notification listesinde tipler text-only badge ile ayrılıyordu; toast bileşeninde success/warning/info ayrımı yoktu; feedback metinleri plain kırmızı yazıydı; bazı icon-only girişlerde focus tooltip ve ARIA etiketi eksikti.
- Kullanılan tokenlar korundu: `primary`, `chart-2`, `chart-4`, `destructive`, `muted`, `border`, `card`, `background`, `foreground`.
- Yeni marka rengi veya tipografi eklenmedi.
- Toast varyantları `default | success | destructive | warning | info` olarak genişletildi.
- Toast giriş animasyonu 300ms slide/fade, çıkış animasyonu 200ms fade/collapse olarak ayarlandı.
- Kritik toastlar `aria-live="assertive"`, diğerleri `aria-live="polite"` ile duyurulur.
- `/notifications` liste öğeleri `role="list"` ve `role="listitem"` semantiğiyle düzenlendi.
- Topbar notification butonu artık unread count yoksa sadece giriş noktası, unread count varsa gerçek sayı rozeti gösterir.

## Kontrol Listesi (Checklist)

1. `/notifications` sayfasında `Unread` ve `All` sekmelerinin doğru veri getirdiğini kontrol et.
2. `/notifications` içinde `All`, `Price`, `Indicator`, `News`, `System` filtrelerini tek tek kontrol et.
3. Unread bildirimi `Mark read` ile okundu yap ve badge değerinin azaldığını doğrula.
4. `Mark all read` aksiyonunun tüm unread kayıtları okunduya çektiğini doğrula.
5. Topbar notification butonuna tıklandığında `/notifications` sayfasına gidildiğini kontrol et.
6. Sağ sidebar notification ve alert ikonlarında badge değerlerinin doğru göründüğünü kontrol et.
7. Toast başarı, hata, uyarı ve bilgi durumlarında ikon, renk, animasyon ve Escape kapatma davranışını kontrol et.
8. `/alerts` sayfasında news rule sentiment seçimleri, create/update/pause/resume/delete aksiyonlarını kontrol et.
9. `/alerts` market rule create/update/pause/resume/delete akışlarını kontrol et.
10. Klavye ile topbar, sidebar, notification filtreleri ve toast close butonu arasında gezilebildiğini kontrol et.

## Bilinen Sorunlar / Eksikler

- `npm run lint` 0 hata ile tamamlanıyor; proje genelinde notification kapsamı dışından gelen 43 uyarı devam ediyor.
- Görsel snapshot testi bulunmadığı için bu değişiklikler build, lint ve manuel checklist ile doğrulanmalıdır.
