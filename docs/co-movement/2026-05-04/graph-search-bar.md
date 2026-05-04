# Co-Movement Graph Search Bar

## Özet
Co-movement sayfasındaki snapshot ve özel analiz graph başlıklarına görünür node'lar üzerinde çalışan hisse arama kontrolü eklendi. Arama sonucu seçilen hisse mevcut node seçim akışını tetikleyerek graph highlight ve detay paneli davranışını kullanır.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/graph-search-bar.md`

## Teknik Detaylar
- `GraphNodeSearch` yerel bileşeni eklendi; `node.id` ve `node.label` üzerinden büyük/küçük harf duyarsız eşleşme yapar.
- Snapshot graph ve özel analiz graph için ayrı search state tutulur.
- Enter tuşu ilk eşleşen node'u seçer; dropdown sonucu tıklamak aynı seçimi yapar.
- Clear butonu arama metnini ve seçili node'u temizler.
- Graph araması yalnızca mevcut `snapshotGraphData.nodes` veya `customGraphData.nodes` içindeki görünür node'lar üzerinde çalışır.
- Backend API, servis katmanı ve co-movement response tiplerinde değişiklik yapılmadı.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npm run lint` çalıştır.
2. Mümkünse `frontend` dizininde `npm run build` çalıştır.
3. `/markets/co-movement` sayfasını aç.
4. Snapshot graph'ta görünen bir hisseyi arayıp seç; sağ detay panelinin açıldığını ve node komşularının vurgulandığını kontrol et.
5. Snapshot graph'ta odak moduna geç; aramanın yalnızca görünür odak node'larında sonuç verdiğini kontrol et.
6. Özel analiz çalıştır; Analiz Grafiği aramasında aynı seçim ve detay paneli davranışını kontrol et.
7. Clear butonunun arama metnini ve seçili node'u temizlediğini kontrol et.
8. Mobil genişlikte search input, scope toggle ve refresh butonlarının üst üste binmediğini kontrol et.

## Bilinen Sorunlar / Eksikler
- Otomatik browser görsel doğrulaması bu değişiklik kapsamında henüz yapılmadı.
