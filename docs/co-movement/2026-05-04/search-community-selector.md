# Co-Movement Search Community Selector

## Özet
Search ile seçilen hisse için açılan detay panelindeki hisse özetine, hissenin bulunduğu co-movement grubu gösteren kompakt bir aksiyon eklendi. Grup seçimi graph'ı ilgili topluluğa geçirirken seçili hisse odağını ve detay panelini korur.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/search-community-selector.md`

## Teknik Detaylar
- `NodeDetailCard`, seçili hissenin topluluklarını `result.communities[].stocks` üzerinden bulur.
- Detay panelindeki hisse özet kartına `Grubu göster` aksiyonu eklendi; grup kimliği ve hisse sayısı kompakt chip içinde gösterilir.
- `NodeDetailCard` içine opsiyonel `onSelectCommunity` callback'i eklendi.
- Snapshot graph'ta grup seçimi `community` focus moduna geçer; seçili node ve search state'i korunur.
- Custom analysis graph'ta grup seçimi ilgili custom community focus state'ini ayarlar; seçili node ve search state'i korunur.
- Backend API, servis katmanı ve graph bileşen API'si değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx` çalıştır.
2. `/markets/co-movement` sayfasında snapshot graph search ile bir hisse seç.
3. Detay panelindeki hisse özetinde `Grubu göster` chip'inin göründüğünü kontrol et.
4. Grup chip'ine tıkla; graph'ın odak modunda ilgili gruba geçtiğini, detay panelinin açık kaldığını ve seçili hissenin highlight kaldığını kontrol et.
5. Özel analiz çalıştırıp aynı davranışı `Analiz Grafiği` tarafında kontrol et.
6. Grup verisi olmayan node durumunda detay panelinin bozulmadığını kontrol et.
7. Mobil genişlikte grup chip'inin hisse özet kartında taşmadığını kontrol et.

## Bilinen Sorunlar / Eksikler
- Proje genelindeki mevcut lint/build hataları bu değişiklik kapsamında çözülmedi.
