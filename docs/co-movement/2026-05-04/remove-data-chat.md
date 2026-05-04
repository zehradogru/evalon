# Co-Movement Data Chat Rollback

## Özet
Co-movement sayfasına eklenen veriler üzerinden sohbet alanı geri alındı. Sayfa artık yalnızca mevcut yorum üretme modülünü gösterir; chat input'u, mesaj listesi ve chat-mode istekleri kaldırıldı.

## Değişiklik Listesi
- Değiştirildi: `frontend/types/index.ts`
- Değiştirildi: `frontend/app/api/co-movement/explain/stream/route.ts`
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/remove-data-chat.md`
- Kaldırıldı: `docs/co-movement/2026-05-04/detailed-commentary-chat.md`

## Teknik Detaylar
- `CoMovementExplainRequest` içindeki `mode`, `question` ve `history` alanları kaldırıldı.
- Stream route içindeki chat prompt'u ve chat fallback davranışı kaldırıldı.
- `ExplanationCard` içindeki `Veriler Üzerinden Sor` alanı, chat state'leri ve chat submit handler'ları kaldırıldı.
- Detaylı yorum için kullanılan `insight_context` korunur.

## Kontrol Listesi (Checklist)
1. `/markets/co-movement` sayfasında yorum kartında chat input'u görünmediğini kontrol et.
2. Snapshot tarafında `Detaylı Yorum` üretiminin çalışmaya devam ettiğini kontrol et.
3. Özel analiz tarafında `Detaylı Sonuç Yorumu` üretiminin çalışmaya devam ettiğini kontrol et.
4. Network isteklerinde `/api/co-movement/explain/stream` payload'ının chat `mode`, `question` veya `history` taşımadığını doğrula.
5. Mobil genişlikte yorum kartının chat alanı olmadan düzgün yerleştiğini kontrol et.

## Bilinen Sorunlar / Eksikler
- Backend'de co-movement'a özel chat servisi olmadığı için sohbet özelliği bilinçli olarak kapalı tutulur.
