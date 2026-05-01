# Özet

`/correlation` sayfasındaki co-movement graph bileşeninde oluşan `AFRAME is not defined` hatası giderildi. Ayrıca repo içindeki backend co-movement route kayıtları ile aktif Cloud Run deployment'ı karşılaştırıldı; sorun kod eksikliği değil, çalışan ortamın bu route'ları henüz yayınlamıyor olması olarak doğrulandı.

# Değişiklik Listesi

- Değiştirildi: `frontend/features/correlation/co-movement/co-movement-graph.tsx`
- Değiştirildi: `frontend/package.json`
- Değiştirildi: `frontend/package-lock.json`

# Teknik Detaylar

- `react-force-graph` paketi tek importta bile 2D, 3D, VR ve AR export zincirini beraber çözümlüyor.
- Bu nedenle `aframe-extras` ve `AFRAME` bağımlılıkları istemeden client bundle'a taşınıyor ve runtime'da `AFRAME is not defined` hatası oluşuyor.
- Graph import'u `react-force-graph` yerine yalnızca 2D implementasyonu içeren `react-force-graph-2d` paketine geçirildi.
- Local snapshot matrix fallback'i `.npz` okuduğu için `numpy` gerektiriyor; sistem `python3`'te `numpy` yoksa matrix route 404'e düşüyordu.
- Matrix fallback, bundled runtime içindeki Python executable'ı öncelikli kullanacak şekilde güncellendi.
- Backend kodu statik olarak incelendi:
  - `backend/backtest/api/main.py` içinde `create_co_movement_router(...)` çağrısı `app.include_router(...)` ile kayıtlı.
  - `backend/backtest/api/modules/co_movement/presentation/router.py` içinde `/v1/co-movement` altında `symbols`, `snapshots`, `snapshots/latest`, `snapshots/{snapshot_id}`, `snapshots/latest/matrices/{matrix_name}`, `analyze` ve `explain` route'ları tanımlı.
- Aktif deployment ayrıca dışarıdan doğrulandı:
  - `GET https://evalon-backtest-api-474112640179.europe-west1.run.app/v1/co-movement/snapshots` -> `404 Not Found`
  - `GET https://evalon-backtest-api-474112640179.europe-west1.run.app/v1/co-movement/snapshots/latest` -> `404 Not Found`
  - `https://evalon-backtest-api-474112640179.europe-west1.run.app/openapi.json` içinde `co-movement` path'i bulunmuyor.
- Sonuç: repo backend kodu co-movement desteği içeriyor, fakat yayınlanan backend sürümü bu route'ları henüz taşımıyor. Frontend'deki local snapshot fallback bu nedenle gerekli durumda.

# Kontrol Listesi

1. `frontend` dizininde `npm run build` çalıştır ve build'in başarıyla bittiğini doğrula.
2. `/correlation` sayfasını aç ve console'da `AFRAME is not defined` hatasının kalktığını kontrol et.
3. `Snapshot Explorer` bölümünün local snapshot fallback ile veri yüklediğini doğrula.
4. `GET /api/co-movement/snapshots/latest/matrices/hybrid_similarity?symbols=AKBNK,GARAN,ISCTR` benzeri isteklerin `200` dönüp subset matrix verdiğini doğrula.
5. `Custom Analysis` akışında backend ortamında route yoksa kullanıcıya açık hata mesajı gösterildiğini kontrol et.
6. Network graph görünümünde node seçim, hover ve edge kalınlık davranışlarının çalıştığını doğrula.

# Bilinen Sorunlar / Eksikler

- Aktif Cloud Run deployment'ı repo ile senkron değil; co-movement backend route'ları yayın ortamında eksik.
- `Custom Analysis` gerçek `/v1/co-movement/analyze` endpoint'ine bağlı kalmaya devam ediyor; deployment güncellenmeden bu akış tam çalışmaz.
- `frontend/lib/server/co-movement-fallback.ts` için Turbopack NFT trace uyarısı sürüyor; build'i kırmıyor, sadece uyarı üretiyor.
