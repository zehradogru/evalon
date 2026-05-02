# Özet

Co-movement yorum üretiminde görülen iki ana sorun giderildi: kullanıcıya ilk yanıtın geç görünmesi ve bazı LLM çıktılarının cümle ortasında yarıda kalması. Frontend akışı stream tabanlı hale getirildi; eksik veya kesik özet geldiğinde final içerik deterministik local fallback ile tamamlanacak şekilde koruma eklendi.

# Değişiklik Listesi

- `frontend/features/markets/co-movement/co-movement-section.tsx` güncellendi.
- `frontend/services/co-movement.service.ts` güncellendi.
- `frontend/app/api/co-movement/explain/route.ts` güncellendi.
- `frontend/app/api/co-movement/explain/stream/route.ts` eklendi ve güncellendi.

# Teknik Detaylar

- `co-movement-section` içindeki yorum üretme akışı, tek seferlik `/api/co-movement/explain` çağrısından SSE tabanlı `/api/co-movement/explain/stream` akışına geçirildi.
- `streamCoMovementExplanation` istemci fonksiyonu eklendi. SSE parser tarafında kapanış anında buffer flush edilerek son event'in kaybolması engellendi.
- `frontend/app/api/co-movement/explain/stream/route.ts` içinde:
  - Gemini SSE satırları kapanışta buffer flush edilerek eksik son parça problemi azaltıldı.
  - `isCompleteSummary(...)` kontrolü eklendi.
  - LLM veya upstream proxy özeti noktalama / markdown dengesi açısından eksikse final yanıt local heuristic fallback ile değiştiriliyor.
  - Fallback akışı hem stream route hem normal explain route için tutarlı hale getirildi.
- `frontend/app/api/co-movement/explain/route.ts` içinde upstream `/v1/co-movement/explain` cevabı eksik özet döndürdüğünde local fallback kullanılıyor.
- Çalışan frontend ortamı remote backend proxy kullandığı için asıl kırılma yalnızca local backend kodundan değil, upstream LLM çıktısının bazen incomplete dönmesinden kaynaklanıyordu. Bu nedenle koruma katmanı frontend API route tarafında uygulandı.

# Kontrol Listesi

1. `http://localhost:3000/markets/co-movement` sayfasını aç.
2. `Piyasa Görünümü` sekmesinde `Yorum Üret` butonuna tıkla.
3. Yüklenme sırasında `Hazırlanıyor` ve canlı akış mesajının göründüğünü doğrula.
4. Final metnin tam cümle ile bittiğini ve `Kaynak:` bilgisinin göründüğünü doğrula.
5. `Özel Analiz` sekmesine geç, varsayılan hisselerle `Analizi Çalıştır` butonuna bas.
6. Analiz tamamlandıktan sonra `Yorum Üret` butonuna tıkla.
7. Final metnin yarıda kesilmediğini ve eksik LLM çıktısında fallback içeriğin temiz şekilde gösterildiğini doğrula.

# Bilinen Sorunlar / Eksikler

- Local heuristic fallback metni şu anda ASCII ağırlıklı çıktı üretiyor; Türkçe karakter kalitesi ayrıca iyileştirilebilir.
- Upstream LLM bazen incomplete çıktı üretmeye devam edebilir; mevcut çözüm bunu kullanıcıya yansıtmamak için fallback ile maskeliyor, ancak kök neden remote servis tarafında ayrıca incelenmeli.
