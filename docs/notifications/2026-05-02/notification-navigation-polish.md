# Notification Navigation Polish

## Özet

Topbar, sidebar Settings paneli ve notification inbox akışı daha anlaşılır hale getirildi. Notifications sayfası gelen kutusu mantığına indirildi; rule yönetimi için Alerts ayrımı netleştirildi.

## Değişiklik Listesi

- `frontend/components/dashboard/navbar.tsx`: EVALON logosundaki sol ikon kaldırıldı, yazı her ekranda görünür ve tıklanabilir hale getirildi; notification butonu dropdown paneline dönüştürüldü.
- `frontend/components/layout/dashboard-shell.tsx`: Sağ sidebar panellerindeki üst kapatma `X` butonu kaldırıldı.
- `frontend/features/settings/settings-view.tsx`: Sidebar Settings paneline sticky `Kaydet` butonu ve kısa kayıt feedback’i eklendi.
- `frontend/features/notifications/notifications-view.tsx`: Üstteki delivery/preferences enabled blokları kaldırıldı; Alerts ve Notifications farkını anlatan kompakt açıklama alanı eklendi.
- `docs/notifications/2026-05-02/notification-navigation-polish.md`: Bu rapor eklendi.

## Teknik Detaylar

- Topbar notification dropdown `useNotifications('unread', 'all', 15)` ile son okunmamış bildirimleri çeker.
- Tek bildirim temizleme ve `Tümünü Temizle` aksiyonu mevcut okundu state akışını kullanır; böylece badge değeri sıfırlanır.
- Dropdown dış tıklama ile kapanır ve maksimum yüksekliği viewport’un yüzde 70’i ile sınırlandırılır.
- Tek bildirim temizleme sırasında kısa slide/fade çıkış animasyonu uygulanır.
- Settings panelindeki sticky footer `position: sticky; bottom: 0` davranışıyla panel altında sabit kalır.
- Notifications sayfasında Alerts “kural oluşturma/yönetme”, Notifications “oluşan bildirimleri okuma” olarak ayrıştırıldı.
- Mevcut renk tokenları ve tipografi sistemi korundu; yeni marka rengi eklenmedi.

## Kontrol Listesi (Checklist)

1. Topbar’da EVALON yazısının mobil dahil her ekranda göründüğünü ve tıklanınca ana sayfaya gittiğini kontrol et.
2. Topbar notification butonuna tıklayınca dropdown panelinin açıldığını kontrol et.
3. Dropdown dışına tıklayınca panelin kapandığını kontrol et.
4. Dropdown’da tek bildirim temizleyince satırın animasyonla kaybolduğunu ve badge değerinin güncellendiğini kontrol et.
5. `Tümünü Temizle` aksiyonunun listeyi boşalttığını ve badge değerini sıfırladığını kontrol et.
6. Sidebar’daki tüm panel sekmelerinde sağ üst `X` butonunun görünmediğini kontrol et.
7. Sidebar Settings panelinde değişiklik yapılınca `Kaydet` butonunun aktifleştiğini kontrol et.
8. Settings kaydedilince `Kaydedildi ✓` feedback’inin görünüp 1.5 saniye sonra kaybolduğunu kontrol et.
9. `/notifications` sayfasında enabled/preferences bloklarının kaldırıldığını ve Alerts/Notifications açıklamasının göründüğünü kontrol et.

## Bilinen Sorunlar / Eksikler

- Notification dropdown temizleme işlemleri bildirimleri silmez; okundu işaretler ve topbar listesinden çıkarır.
- `npm run lint` 0 hata ile tamamlanır; proje genelinde notification kapsamı dışından gelen 43 uyarı devam eder.
