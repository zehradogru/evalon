# Co-Movement Pair Analysis Redesign

## Özet
`Pairler` tabı backend'in gerçek `top_pairs` ve `pair_rankings` veri modeline göre yeniden düzenlendi. Graph eşleşmeleri hybrid-konsensüs liste olarak, metrik liderleri ise Hybrid/Pearson/DTW özelinde ayrı skor mantığıyla kompakt şekilde gösterilir.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/pair-analysis-redesign.md`

## Teknik Detaylar
- `PairsTable` aktif metriğe göre ana skor seçer: `hybrid_similarity`, `pearson` veya `dtw_similarity`.
- Pearson ve DTW ranking satırlarında olmayan yardımcı skorlar artık boş/çizgi olarak gösterilmez.
- `Graph Eşleşmeleri` bölümü `top_pairs` listesini hybrid-konsensüs graph ilişkileri olarak sunar.
- `Metrik Liderleri` bölümü `pair_rankings` listesini seçili metriğe göre gösterir.
- Tekrar yaratan üst seviye Hybrid/Pearson/DTW açıklama kartları kaldırıldı; metrik açıklaması yalnızca aktif tab içinde gösterilir.
- Backend API, response tipi, snapshot JSON yapısı ve servis katmanı değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx` çalıştır.
2. `/markets/co-movement` sayfasında `Pairler` tabını aç.
3. Üstte ayrı Hybrid/Pearson/DTW açıklama kartlarının görünmediğini kontrol et.
4. `Graph Eşleşmeleri` bölümünde hybrid skorların dolu göründüğünü kontrol et.
5. `Metrik Liderleri` içinde Hybrid, Pearson ve DTW tablarını sırayla aç.
6. Pearson tabında ana değerin Pearson skoru, DTW tabında ana değerin DTW similarity skoru olduğunu kontrol et.
7. Yardımcı skor olmayan satırlarda boş değer kalabalığı oluşmadığını kontrol et.
8. Snapshot, grup odağı, seçili hisse odağı ve özel analiz sonuçlarında aynı görünümün korunduğunu kontrol et.

## Bilinen Sorunlar / Eksikler
- Proje genelindeki mevcut bağımsız lint/build hataları bu değişiklik kapsamında çözülmedi.
