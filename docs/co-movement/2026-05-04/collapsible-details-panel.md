# Co-Movement Collapsible Details Panel

## Özet
Co-movement sayfasındaki `Detaylar` paneli açılıp kapanabilir hale getirildi. Panel başlığı, kapsam etiketi ve açıklama görünür kalırken header satırının tamamı `Pairler`, `Heatmap`, `Rolling` ve `Veri Kalitesi` tab içeriklerini açıp kapatır.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/collapsible-details-panel.md`

## Teknik Detaylar
- `DetailsWorkspace` içine lokal `isDetailsOpen` state'i eklendi.
- Panel varsayılan açık gelir.
- Header satırının tamamı tıklanabilir toggle kontrolüne dönüştürüldü; sağdaki alan proje genelindeki aç/kapat örnekleriyle uyumlu şekilde yalnızca dönen `ChevronDown` ikonunu gösterir.
- `aria-expanded` ve `aria-controls` ile buton-panel ilişkisi tanımlandı.
- Panel kapalıyken yalnızca tab içerikleri gizlenir; graph, arama, seçili node ve açıklama kartları etkilenmez.
- Snapshot ve özel analiz akışları aynı `DetailsWorkspace` bileşenini kullandığı için davranış ikisinde de aynıdır.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx` çalıştır.
2. `/markets/co-movement` sayfasında `Detaylar` panelinin varsayılan açık geldiğini kontrol et.
3. `Detaylar` header satırına basınca tab içeriklerinin kapandığını, header'ın görünür kaldığını kontrol et.
4. Header satırına tekrar basınca tab içeriklerinin geri geldiğini kontrol et.
5. Snapshot ve özel analiz sonuçlarında aynı davranışı kontrol et.
6. Graph, search, seçili node, grup odağı ve pair skorlarının aç/kapat işleminden etkilenmediğini kontrol et.

## Bilinen Sorunlar / Eksikler
- Proje genelindeki mevcut bağımsız lint/build hataları bu değişiklik kapsamında çözülmedi.
