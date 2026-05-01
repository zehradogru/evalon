# Özet

Co-movement ekranı production kullanımı için daha anlaşılır hale getirildi. Piyasa snapshot'ında tüm hisselerin analizi görünür yapıldı, custom analizde hisse seçim limiti kaldırıldı ve graph detay panelindeki gereksiz uzun community listesi kompakt hale getirildi.

# Değişiklik Listesi

- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-section.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-graph.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-symbol-picker.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-utils.ts`
- Değiştirildi: `frontend/lib/server/co-movement-fallback.ts`
- Değiştirildi: `backend/backtest/api/modules/co_movement/presentation/router.py`

# Teknik Detaylar

- Snapshot `Özet` görünümüne graph kapsamı kontrolü eklendi:
  - `Tüm Piyasa`: snapshot içindeki tüm node ve edge verisini gösterir.
  - `Odaklı Graph`: seçili community veya pair çevresine daraltır.
- Full-market graph'ta yüzlerce label ekranı kaplamasın diye node label'ları otomatik sadeleştirildi; büyük graph'ta label sadece seçili node ve komşularında görünür.
- `Node Detail` panelinde community'deki tüm hisseler tek tek yazılmıyor; ilk birkaç hisse chip olarak gösteriliyor ve kalan sayı `+N diğer` formatında özetleniyor.
- Custom analysis symbol picker'da maksimum seçim limiti kaldırıldı.
- Frontend custom analysis submit kontrolünden `customSymbols.length > 12` şartı kaldırıldı.
- Local custom analysis fallback artık seçilen sembolleri 60 ile sınırlamıyor.
- Backend request modelindeki sembol üst limiti 60'tan 700'e çıkarıldı.
- Custom matrix heatmap, büyük sepetlerde tüm sembolleri basmak yerine en güçlü ilişki çevresinden 12 hisselik okunabilir bir matrix odağı gösteriyor.
- Kullanıcıya görünen teknik bilgilendirme kutusu kaldırıldı.

# Kontrol Listesi (Checklist)

1. `/correlation` sayfasını aç.
2. `Piyasa Snapshot` sekmesinde `Tüm Piyasa` graph kapsamının seçili olduğunu ve tüm piyasa node/edge bilgisinin göründüğünü kontrol et.
3. Graph üzerinde hisse seçildiğinde `Hisse Detayı` panelinde community listesinin kompakt göründüğünü kontrol et.
4. `Odaklı Graph` seçeneğiyle graph'ın seçili community/pair çevresine daraldığını kontrol et.
5. `Özel Analiz` sekmesinde teknik bilgilendirme kutusunun görünmediğini kontrol et.
6. Custom analizde 12'den fazla hisseyle request atılabildiğini kontrol et.
7. Custom analiz sonucu graph, top pairs ve matrix sekmelerinin hata vermeden açıldığını kontrol et.

# Bilinen Sorunlar / Eksikler

- Aktif deployment co-movement backend route'larını yayınlamadığı sürece custom analysis local snapshot fallback ile çalışır.
- Full-market graph fizik motoruyla çizildiği için node pozisyonları küçük ölçekte hareket edebilir; seçim, edge ve detay verisi deterministik ve tutarlıdır.
- Turbopack NFT trace uyarısı devam ediyor; build'i kırmıyor.
