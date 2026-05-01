# Özet

Co-movement graph görünümünde seçili node ve detay paneli arasındaki tutarsızlık giderildi. Sayfa yenilendiğinde rastgele görünen seçim davranışı yerine görünür grafikte en çok bağlantısı olan node deterministik olarak seçilecek hale getirildi.

# Değişiklik Listesi

- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-graph.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-section.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-utils.ts`

# Teknik Detaylar

- `react-force-graph-2d`, aldığı link objelerindeki `source` ve `target` alanlarını string yerine node objesine çevirebiliyor.
- Önceden aynı edge objeleri detay paneliyle paylaşıldığı için `edge.source === selectedNodeId` karşılaştırması bazı durumlarda false oluyordu.
- Graph bileşenine verilen node ve edge verileri artık clone'lanıyor; kütüphanenin iç mutasyonu uygulama state'ine sızmıyor.
- Edge karşılaştırmaları `source/target` string ya da node objesi olsa da aynı sembole çözülecek yardımcı fonksiyonlarla yapılıyor.
- Snapshot graph, seçili community/top-pair odağına göre filtrelenmiş edge listesini detail paneline de geçiriyor; graph'ta görünen bağlantılar ile panelde listelenen bağlantılar aynı kaynaktan geliyor.
- İlk seçili node artık array sırasına göre değil, görünür grafikteki degree değerine göre seçiliyor; eşitlikte alfabetik sıra kullanılıyor.
- Graph layout başlangıç pozisyonları deterministik olarak veriliyor; yenilemelerde daha tutarlı görünüm elde ediliyor.

# Kontrol Listesi (Checklist)

1. `/correlation` sayfasını aç.
2. `Piyasa Snapshot` altında `Özet` sekmesinde graph yüklendiğinde `Node Detail` panelinde bağlantı listesi geldiğini kontrol et.
3. Sayfayı birkaç kez yenile ve default seçili node'un aynı kaldığını kontrol et.
4. `Özel Analiz` sekmesinde `Analizi Çalıştır` butonuna bas.
5. `Analiz Grafiği` ve `Node Detail` panelinde aynı graph verisine ait bağlantıların listelendiğini kontrol et.
6. `Matrisler` sekmesinde Pearson/Hybrid matrislerinin hata vermeden açıldığını kontrol et.

# Bilinen Sorunlar / Eksikler

- Graph fizik motoru node'ları render sırasında küçük ölçekte hareket ettirmeye devam eder; ancak başlangıç seçimi ve detail bağlantıları artık deterministiktir.
- Aktif backend deployment co-movement route'larını yayınlamadığı sürece custom analysis local snapshot fallback ile çalışır.
