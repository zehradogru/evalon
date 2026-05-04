# Co-Movement Search Community Selector

## Özet
Search ile seçilen hisse için açılan detay panelindeki hisse özetine, hissenin bulunduğu co-movement grubu gösteren kompakt bir aksiyon eklendi. Grup seçimi mevcut odaklı graph davranışını kullanarak graph'ı ilgili topluluğa geçirir.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/search-community-selector.md`

## Teknik Detaylar
- `NodeDetailCard`, seçili hissenin topluluklarını `result.communities[].stocks` üzerinden bulur.
- Detay panelindeki hisse özet kartına `Grubu göster` aksiyonu eklendi; grup kimliği ve hisse sayısı kompakt chip içinde gösterilir.
- `NodeDetailCard` içine opsiyonel `onSelectCommunity` callback'i eklendi.
- Snapshot graph'ta grup seçimi `community` focus moduna geçer ve seçili node/search state'ini temizler.
- Custom analysis graph'ta grup seçimi ilgili custom community focus state'ini ayarlar ve seçili node/search state'ini temizler.
- Backend API, servis katmanı ve graph bileşen API'si değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx` çalıştır.
2. `/markets/co-movement` sayfasında snapshot graph search ile bir hisse seç.
3. Detay panelindeki hisse özetinde `Grubu göster` chip'inin göründüğünü kontrol et.
4. Grup chip'ine tıkla; graph'ın odak modunda ilgili gruba geçtiğini kontrol et.
5. Özel analiz çalıştırıp aynı davranışı `Analiz Grafiği` tarafında kontrol et.
6. Grup verisi olmayan node durumunda detay panelinin bozulmadığını kontrol et.
7. Mobil genişlikte grup chip'inin hisse özet kartında taşmadığını kontrol et.

## Bilinen Sorunlar / Eksikler
- Proje genelindeki mevcut lint/build hataları bu değişiklik kapsamında çözülmedi.
