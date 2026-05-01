# Co-Movement Markets Sayfası Ayrıştırması

## Özet
Co-Movement ekranı klasik correlation sayfasından ayrılarak Markets altında bağımsız bir sayfaya taşındı. `/correlation` artık yalnızca Pearson correlation matrisi akışını gösterir; co-movement dashboard’u `/markets/co-movement` üzerinden açılır.

## Değişiklik Listesi
- `frontend/app/markets/co-movement/page.tsx` eklendi.
- `frontend/features/markets/co-movement/*` altına co-movement bileşenleri taşındı.
- `frontend/features/correlation/correlation-view.tsx` içinden co-movement render’ı kaldırıldı.
- `frontend/components/dashboard/navbar.tsx` Markets menüsüne Co-Movement bağlantısı eklendi.
- `frontend/components/layout/dashboard-footer.tsx` ve `frontend/features/landing/footer.tsx` Markets linklerine Co-Movement bağlantısı eklendi.
- `frontend/features/dashboard/ticker-tape.tsx` hydration uyumluluğu korunarak React Compiler lint kuralına uyumlu hale getirildi.

## Teknik Detaylar
- Yeni sayfa route’u: `GET /markets/co-movement`.
- Co-movement modülü mevcut frontend servislerini ve proxy endpointlerini kullanmaya devam eder: `/api/co-movement/*`.
- Correlation sayfasındaki hisse seçimi uyarısı, büyük piyasa sepetleri için kullanıcıyı Markets altındaki Co-Movement ekranına yönlendirecek şekilde sadeleştirildi.
- Standalone sayfada gereksiz üst ayırıcı çizgi ve correlation sayfasına özel boşluk kaldırıldı.
- Ticker tape için client-only render kontrolü `useSyncExternalStore` ile yapıldı; bu sayede server/client HTML farkı oluşturmadan synchronous effect state güncellemesi kullanılmadı.

## Kontrol Listesi (Checklist)
- `/correlation` açıldığında yalnızca klasik correlation ayarları, heatmap ve strongest correlations tablosu görünmeli.
- `/correlation` içinde co-movement snapshot/custom analiz bölümü görünmemeli.
- Markets menüsünde Co-Movement bağlantısı görünmeli ve `/markets/co-movement` sayfasına gitmeli.
- `/markets/co-movement` açıldığında Piyasa Snapshot ve Özel Analiz sekmeleri çalışmalı.
- Snapshot graph, heatmap, top pairs, communities ve rolling stability alanları önceki davranışını korumalı.
- Özel analiz formu seçilen hisse sayısına yapay frontend limiti koymadan analiz çalıştırmalı.
- Browser kontrolünde `/correlation` üzerinde co-movement sekmeleri görünmemeli ve console error oluşmamalı.
- Browser kontrolünde `/markets/co-movement` üzerinde snapshot/custom sekmeleri, graph kapsam kontrolleri ve snapshot verisi görünmeli.

## Bilinen Sorunlar / Eksikler
- Bu fazda otomatik test eklenmedi; component ve servis testleri ikinci faza bırakıldı.
- Tam repo lint çalıştırması co-movement dışı eski dosyalardaki lint hataları nedeniyle geçmiyor; bu değişiklik kapsamındaki hedef dosyalar için lint geçiyor.
