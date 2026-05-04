# Co-Movement Detailed Commentary Context

## Özet
Co-movement yorum üretimi daha zengin analiz context'iyle beslenecek şekilde genişletildi. Yorum isteği artık seçili kapsam için metrik liderleri, rolling stability, data quality, excluded semboller, topluluk yoğunluğu, tarih aralığı ve config özetini taşıyabilir.

## Değişiklik Listesi
- Değiştirildi: `frontend/types/index.ts`
- Değiştirildi: `frontend/app/api/co-movement/explain/stream/route.ts`
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/detailed-commentary-context.md`

## Teknik Detaylar
- `CoMovementExplainRequest` tipine opsiyonel `insight_context` alanı eklendi.
- Frontend, mevcut analiz sonucundan scope bazlı `insight_context` üretir.
- `/api/co-movement/explain/stream` canlı yorum servisi varsa zengin prompt kullanır; yoksa mevcut backend/local fallback akışını korur.
- Backend Python API, genel sohbet oturumu akışı, Firestore kayıt şeması ve kaydedilmiş analiz davranışı değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx app/api/co-movement/explain/stream/route.ts services/co-movement.service.ts` çalıştır.
2. Mümkünse `frontend` dizininde `npm run build` çalıştır.
3. `/markets/co-movement` sayfasında snapshot için `Detaylı Yorum` üret ve metnin pair, community, rolling stability ve veri kalitesi sinyallerini kullandığını kontrol et.
4. Özel analiz çalıştır; detaylı yorum akışının custom result üzerinde de çalıştığını kontrol et.
5. Canlı yorum servisi kapalıyken summary fallback'in çalıştığını kontrol et.

## Bilinen Sorunlar / Eksikler
- Bu değişiklik chat veya konuşma geçmişi eklemez.
- Canlı yorum servisi yoksa yorum mevcut backend/local fallback ile sınırlı kalır.
