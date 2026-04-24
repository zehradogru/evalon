# Sağ Sidebar İkon Semantiği

## Özet

Sağ sabit sidebar içindeki ikonlar, açtıkları panel veya yönlendirdikleri sayfanın işlevini daha net anlatacak şekilde güncellendi. Tooltip metinleri de bazı araçlarda daha açıklayıcı hale getirildi.

## Değişiklik Listesi

- `frontend/src/components/layout/Sidebar.tsx`: Sağ sidebar araç listesinde kullanılan Lucide ikonları güncellendi.
- `frontend/src/components/layout/Sidebar.tsx`: Bazı araçlara `label` alanı eklenerek tooltip ve `title` metinleri daha açıklayıcı yapıldı.
- `docs/ui-fixes/2026-04-24/right-sidebar-icon-semantics.md`: Değişiklik raporu eklendi.

## Teknik Detaylar

- Watchlist ikonu `List` yerine `Star` yapıldı.
- Paper Trade ikonu `Wallet` yerine `BriefcaseBusiness` yapıldı.
- Tarihsel Simülasyon ikonu `Sparkles` yerine `TimerReset` yapıldı.
- Alerts ikonu `Bell` yerine `BellPlus` yapıldı ve tooltip `Price Alerts` olarak güncellendi.
- Screeners ikonu `Search` yerine `SlidersHorizontal` yapıldı ve tooltip `Market Screener` olarak güncellendi.
- Evalon AI ikonu `Lightbulb` yerine `Bot` yapıldı.
- Calendar ikonu `Calendar` yerine `CalendarDays` yapıldı ve tooltip `Economic Calendar` olarak güncellendi.
- Notifications ikonu `MessageSquare` yerine `Inbox` yapıldı.
- Panel açma mantığında kullanılan `name` değerleri korunarak `DashboardShell` ile mevcut entegrasyon bozulmadı.

## Kontrol Listesi (Checklist)

1. Sağ sidebar ikonlarının görsel olarak doğru sırada göründüğünü kontrol et.
2. Watchlist, Alerts, News, Screeners, Evalon AI, Calendar ve Notifications ikonlarına tıklayınca ilgili widget panelinin açıldığını kontrol et.
3. Paper Trade ve Tarihsel Simülasyon ikonlarına tıklayınca ilgili sayfalara yönlendirme yapıldığını kontrol et.
4. Hover tooltip metinlerinin yeni açıklayıcı etiketlerle göründüğünü kontrol et.
5. Aktif panel ve aktif route göstergelerinin çalışmaya devam ettiğini kontrol et.

## Bilinen Sorunlar / Eksikler

- Değişiklik üretim build'i ile doğrulandı, tarayıcı üzerinde manuel görsel kontrol yapılmadı.
