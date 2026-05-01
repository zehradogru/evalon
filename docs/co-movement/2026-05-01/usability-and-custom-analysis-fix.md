# Özet

Correlation sayfasındaki co-movement bölümü daha okunabilir bir sekmeli akışa dönüştürüldü. Custom analysis endpoint'i backend ortamında bulunamadığında local snapshot matrislerinden seçili hisse sepeti için çalışabilir analiz cevabı üretecek şekilde düzeltildi.

# Değişiklik Listesi

- Değiştirildi: `frontend/app/api/co-movement/analyze/route.ts`
- Değiştirildi: `frontend/lib/server/co-movement-fallback.ts`
- Değiştirildi: `frontend/features/correlation/correlation-view.tsx`
- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-section.tsx`

# Teknik Detaylar

- `/api/co-movement/analyze` upstream backend'den `404` aldığında artık `503` ile durmak yerine local snapshot fallback'i dener.
- Local fallback seçilen semboller için `pearson`, `spearman`, `dtw_distance`, `dtw_similarity` ve `hybrid_similarity` matrislerini `matrices.npz` üzerinden okur.
- Fallback analiz cevabı top pair listesi, pair rankings, graph edges, connected-component tabanlı communities, rolling stability ve data quality alanlarını frontend contract'ına uygun şekilde üretir.
- Co-movement UI ana sekmelere ayrıldı: `Özet`, `Matrisler`, `Detaylar`.
- Snapshot graph artık tüm BIST evrenini aynı anda çizmek yerine seçili community veya top pair odağına göre sınırlı graph gösterir.
- Correlation matrix tarafında seçili hisse sayısı 24 ile sınırlandı; böylece heatmap yüzlerce kolonla kullanılamaz hale gelmez.

# Kontrol Listesi (Checklist)

1. `/correlation` sayfasında üst correlation alanında `Görünenlerden Ekle` butonunun 24 hisse limitini aşmadığını kontrol et.
2. Co-movement bölümünde `Piyasa Snapshot` sekmesinin açıldığını ve graph'ın sınırlı/okunabilir node setiyle geldiğini kontrol et.
3. `Özel Analiz` sekmesinde varsayılan sepetle `Analizi Çalıştır` butonuna bas.
4. Sonuçta `Analiz Grafiği`, `En Güçlü Eşleşmeler` ve `Matrisler` sekmesinde Pearson/Hybrid matrislerinin göründüğünü kontrol et.
5. Console'da runtime error olmadığını kontrol et.

# Bilinen Sorunlar / Eksikler

- Aktif backend deployment'ı co-movement route'larını yayınlamadığı için fallback snapshot tabanlı çalışır.
- Fallback custom analysis yeni tarih aralığı üzerinden yeniden hesaplama yapmaz; local snapshot içindeki hazır evren matrislerinden seçili sembol subset'i üretir.
- Turbopack NFT trace uyarısı devam ediyor; build'i kırmıyor.
