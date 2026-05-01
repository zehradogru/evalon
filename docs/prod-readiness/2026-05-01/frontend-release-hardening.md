# Frontend Production Readiness Hardening

## Özet
Frontend production kontrolü sırasında lint ve build gate'lerini bloklayan hatalar giderildi. Co-Movement proxy uçları production bundle içinde local dosya fallback'ini trace etmeyecek şekilde düzenlendi ve yeni Markets sayfası tarayıcı/API üzerinden doğrulandı.

## Değişiklik Listesi
- `frontend/app/contact/page.tsx` içindeki escapelenmemiş apostrophe karakterleri düzeltildi.
- `frontend/features/ai-assistant/backtest-tool-result.tsx` içindeki React Compiler memoization hatası giderildi.
- `frontend/features/ai-assistant/preset-catalog-tool-result.tsx` içindeki escapelenmemiş apostrophe düzeltildi.
- `frontend/features/ai-assistant/rule-catalog-tool-result.tsx` içindeki synchronous effect state güncellemesi kaldırıldı.
- `frontend/features/calendar/calendar-view.tsx` render sırasında `Date.now()` çağırmayacak şekilde düzenlendi.
- `frontend/features/markets/markets-view.tsx` crypto market fetch akışı `useQuery` tabanlı hale getirildi ve TypeScript tipi netleştirildi.
- `frontend/features/news/news-view.tsx` ilk sayfa haber fetch akışı `useQuery` ile yönetilecek şekilde düzenlendi.
- `frontend/features/stocks/stock-detail-view.tsx` fiyat fetch akışı `useQuery` tabanlı hale getirildi.
- `frontend/lib/server/evalon-proxy.ts` içindeki `readProxyPayload` route'lar tarafından paylaşılabilir hale getirildi.
- `frontend/lib/server/co-movement-local-loader.ts` eklendi.
- `frontend/lib/server/npz-reader.ts` eklendi.
- `frontend/app/api/co-movement/**/route.ts` dosyaları snapshot fallback'ini lazy-load edecek şekilde düzenlendi.
- `frontend/data/co_movement` altına production bundle'a dahil edilecek snapshot verisi eklendi.
- `frontend/lib/server/co-movement-fallback.ts` Python/Numpy bağımlılığı olmadan `.npz` matrix slice okuyacak şekilde düzenlendi.
- `frontend/next.config.ts` içine runtime için gereksiz `next.config.ts` trace kaydını dışarıda bırakacak `outputFileTracingExcludes` ayarı eklendi.

## Teknik Detaylar
- `npm run lint` artık exit code `0` döndürüyor; repoda hâlâ bloklamayan lint warning'leri mevcut.
- `npm run build` exit code `0` döndürüyor ve Turbopack NFT trace uyarısı kaldırıldı.
- Cloud Run backend hedefinde `/v1/co-movement/snapshots` endpoint'i mevcut olsa da snapshot listesi boş ve `/v1/co-movement/snapshots/latest` `404` döndürüyor. Bu nedenle frontend proxy production ortamında da statik snapshot fallback'i kullanabilecek şekilde hazırlandı.
- Co-movement fallback'i `frontend/data/co_movement` altındaki `summary.json`, `metadata.json`, `latest.json` ve `matrices.npz` dosyalarını okur.
- Matrix fallback'i Node tarafında `.npz` / `.npy` parser ile çalışır; Python runtime veya Numpy gerektirmez.
- Co-Movement API smoke kontrollerinde `latest`, `symbols`, `matrix slice` ve `analyze` uçları `200` döndü.
- Standalone output içinde `data/co_movement` dosyalarının yer aldığı kontrol edildi ve `node .next/standalone/server.js` ile production-mode smoke test yapıldı.

## Kontrol Listesi (Checklist)
- `npm run lint` çalıştırılmalı ve exit code `0` görülmeli.
- `npm run build` çalıştırılmalı ve route listesinde `/markets/co-movement` görünmeli.
- `/api/co-movement/snapshots/latest` `200` dönmeli ve graph node/edge bilgisi içermeli.
- `/api/co-movement/snapshots/latest/matrices/hybrid_similarity?symbols=AKBNK,GARAN,ISCTR,YKBNK` `200` dönmeli.
- `/api/co-movement/analyze` örnek banka/havayolu sepetiyle `200` dönmeli.
- Standalone server üzerinde `/api/co-movement/snapshots/latest` ve matrix slice endpointleri `200` dönmeli.
- Browser'da `/markets/co-movement` açıldığında snapshot/custom sekmeleri görünmeli ve console error olmamalı.
- Browser'da `/correlation` açıldığında co-movement bölümü görünmemeli.

## Bilinen Sorunlar / Eksikler
- Full lint çıktısında bloklamayan warning'ler devam ediyor; bunlar build/lint exit code'unu kırmıyor.
- Otomatik testler bu fazda eklenmedi; component ve servis testleri ikinci faz kapsamındadır.
- Backend production snapshot store boş olduğu için gerçek kalıcı çözüm backend snapshot verisinin Cloud Run ortamına deploy edilmesidir; frontend statik fallback bu release için kullanıcı tarafındaki kırılmayı engeller.
