# Özet

Correlation sayfasına mevcut Pearson heatmap bölümünü bozmadan tam kapsamlı co-movement alanı eklendi. Yeni alan snapshot explorer, custom analysis, matrix görselleştirmeleri, network graph, community listeleri ve yorum üretim akışlarını aynı sayfada birleştirir.

# Değişiklik Listesi

- `frontend/app/api/co-movement/symbols/route.ts` eklendi.
- `frontend/app/api/co-movement/snapshots/route.ts` eklendi.
- `frontend/app/api/co-movement/snapshots/latest/route.ts` eklendi.
- `frontend/app/api/co-movement/snapshots/[snapshotId]/route.ts` eklendi.
- `frontend/app/api/co-movement/snapshots/latest/matrices/[matrixName]/route.ts` eklendi.
- `frontend/app/api/co-movement/analyze/route.ts` eklendi.
- `frontend/app/api/co-movement/explain/route.ts` eklendi.
- `frontend/services/co-movement.service.ts` eklendi.
- `frontend/hooks/use-co-movement.ts` eklendi.
- `frontend/features/correlation/co-movement/co-movement-section.tsx` eklendi.
- `frontend/features/correlation/co-movement/co-movement-graph.tsx` eklendi.
- `frontend/features/correlation/co-movement/co-movement-heatmap.tsx` eklendi.
- `frontend/features/correlation/co-movement/co-movement-symbol-picker.tsx` eklendi.
- `frontend/features/correlation/co-movement/co-movement-utils.ts` eklendi.
- `frontend/features/correlation/correlation-view.tsx` güncellendi.
- `frontend/types/index.ts` güncellendi.
- `frontend/package.json` ve `frontend/package-lock.json` güncellendi.
- Derleme uyumu için `frontend/features/calendar/calendar-view.tsx` ve `frontend/features/backtest/backtest-view.tsx` içinde küçük tip uyumu düzenlemeleri yapıldı.

# Teknik Detaylar

- Frontend ile backend arasına `/api/co-movement/*` proxy katmanı eklendi; bu katman `symbols`, `snapshots`, `latest`, `latest matrix slice`, `analyze` ve `explain` endpointlerini tüketiyor.
- `react-force-graph` bağımlılığı eklenerek network graph client-only dynamic import ile render edildi.
- Snapshot explorer tarafında tam evren matrisi doğrudan çizdirilmedi; latest snapshot için community, top pair veya manuel subset odaklı matrix slice çağrıları yapılıyor.
- Custom analysis formu yalnızca `1d` timeframe ile çalışacak şekilde sabitlendi; istek gövdesine `rolling_step=20`, `max_missing_ratio=0.15`, `min_history_rows=60` alanları ekleniyor.
- Frontend tip sistemine snapshot meta, analyze response, matrix response, graph node-edge, community, rolling stability ve explain payload tipleri eklendi.
- Correlation ekranı iki bağımsız katmana ayrıldı:
  - Üstte mevcut client-side Pearson correlation ekranı
  - Altta backend destekli co-movement çalışma alanı

# Kontrol Listesi

1. `/correlation` sayfasını aç ve mevcut correlation matrix bölümünün eskisi gibi çalıştığını doğrula.
2. Sayfanın altındaki co-movement alanında latest snapshot özet kartlarının dolduğunu kontrol et.
3. Snapshot seçiciden geçmiş bir snapshot seç ve summary alanlarının değiştiğini doğrula.
4. Latest snapshot modunda focus mode değiştirerek core matrix sekmelerinin veri güncellediğini kontrol et.
5. Advanced matrices alanını aç ve Spearman ile DTW Distance görünümlerinin yüklenebildiğini doğrula.
6. Graph üzerinde node seçerek sağdaki detay kartının bağlantıları değiştirdiğini kontrol et.
7. Snapshot tarafında yorum üret butonunu kullan ve summary ile warnings alanlarının geldiğini doğrula.
8. Custom analysis sekmesinde varsayılan sepetle analiz çalıştır ve tüm matrix sekmeleri, graph, communities, pair tabloları ve rolling stability alanlarını kontrol et.
9. Custom analysis sonucunda yorum üret butonunu çalıştır ve sonuç kartını doğrula.
10. Mobil genişlikte sayfayı açıp tabloların yatay scroll ile, kartların ise tek kolonla çalıştığını kontrol et.

# Bilinen Sorunlar / Eksikler

- Repo genelinde bağımsız ESLint ihlalleri bulunduğu için tam `npm run lint` şu aşamada temiz değil; yeni eklenen co-movement dosyaları ayrı çalıştırıldığında lint hatası vermiyor.
- Geçmiş snapshot kayıtları için backend yalnızca summary sağlıyor; matrix heatmap detayı yalnızca latest snapshot pointer üzerinden aktif.
- Otomatik testler ve component testleri bu teslimata dahil edilmedi; ikinci fazda ele alınacak.
