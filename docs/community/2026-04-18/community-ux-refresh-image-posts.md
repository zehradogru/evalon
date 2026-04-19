# Özet

Community deneyimi panel tabanlı bir akışa taşındı ve postlara tek görsel ekleme desteği eklendi. Feed ve detail sayfası daha editorial bir görsel dil ile yeniden tasarlandı; create/edit akışları artık aynı `Sheet` paneli üzerinden çalışıyor.

# Değişiklik Listesi

- `frontend/types/index.ts` güncellendi.
- `frontend/lib/community.ts` güncellendi.
- `frontend/services/community.service.ts` güncellendi.
- `frontend/hooks/use-community.ts` güncellendi.
- `frontend/components/ui/sheet.tsx` eklendi.
- `frontend/features/community/community-view.tsx` güncellendi.
- `frontend/features/community/post-detail-view.tsx` güncellendi.
- `frontend/features/community/components/community-composer.tsx` güncellendi.
- `frontend/features/community/components/community-composer-panel.tsx` eklendi.
- `frontend/features/community/components/community-post-card.tsx` güncellendi.
- `frontend/features/community/components/community-filter-bar.tsx` güncellendi.
- `frontend/features/community/components/community-feed-list.tsx` güncellendi.
- `frontend/features/community/components/community-empty-state.tsx` güncellendi.
- `frontend/features/community/components/community-related-post-groups.tsx` güncellendi.
- `firestore.rules` güncellendi.
- `storage.rules` güncellendi.

# Teknik Detaylar

- Community post modeli şu opsiyonel görsel alanlarıyla genişletildi:
  - `imageUrl`
  - `imagePath`
  - `imageWidth`
  - `imageHeight`
- `CommunityPostDraft` image-aware hale getirildi; draft state artık mevcut görsel, yeni `File` nesnesi ve remove intent taşıyor.
- `frontend/lib/community.ts` içine image upload için ortak yardımcılar eklendi:
  - MIME/type doğrulaması
  - `5MB` dosya limiti
  - storage path üretimi: `community/{uid}/{postId}/hero-{timestamp}.{ext}`
- `frontend/services/community.service.ts` image lifecycle’ı yönetecek şekilde genişletildi:
  - create sırasında image upload + Firestore write
  - edit sırasında keep / replace / remove
  - delete sonrası managed image cleanup
- `frontend/hooks/use-community.ts` içindeki composer hook artık image attach, clipboard paste, preview URL, restore/remove state ve dirty tracking yönetiyor.
- `frontend/components/ui/sheet.tsx` ile reusable Radix tabanlı panel primitive eklendi.
- Community UI yeni akışa taşındı:
  - always-open composer kaldırıldı
  - üstte editorial CTA alanı eklendi
  - mobilde authenticated user için FAB eklendi
  - create ve edit tek bir `CommunityComposerPanel` bileşeninde birleşti
  - post kartları hero image destekli hale geldi
- `firestore.rules` image alanlarını create/update validasyonuna dahil edecek şekilde genişletildi.
- `storage.rules` içine `community/{uid}/{postId}` path’i için:
  - public read
  - owner write
  modeli eklendi.

# Kontrol Listesi (Checklist)

1. `/community` sayfasını aç ve yeni editorial header ile feed’in düzgün yüklendiğini doğrula.
2. Login olmadan üstteki create CTA’nın login akışına yönlendirdiğini doğrula.
3. Login olduktan sonra desktop’ta create CTA’ya bas; sağdan açılan panelin göründüğünü kontrol et.
4. Mobil görünümde FAB’ın göründüğünü ve panel açtığını doğrula.
5. Panel içinde sadece metin ile post oluşturmayı dene.
6. Panel içinde JPEG/PNG/WEBP bir görsel seçerek image’lı post oluşturmayı dene.
7. Clipboard’dan bir screenshot paste ederek preview oluştuğunu doğrula.
8. Var olan görseli remove ve replace akışlarıyla test et.
9. Kendi postunda edit butonuna bas; aynı panelin edit modunda açıldığını doğrula.
10. Feed kartında ve detail sayfasında hero image’ın düzgün oran ve taşma davranışıyla render edildiğini doğrula.
11. `Like`, `Save`, `Share`, `Report` akışlarının bozulmadığını doğrula.
12. `All | Saved | Mine` filtrelerinin yeni tasarım altında çalıştığını doğrula.
13. `/community?ticker=THYAO` gibi ticker query param filtresinin korunup korunmadığını doğrula.
14. Kendi postunu sil ve Firestore dokümanı ile managed image cleanup davranışını doğrula.
15. `frontend/` altında `npm run build` komutunun geçtiğini doğrula.

# Bilinen Sorunlar / Eksikler

- Community image cleanup best-effort çalışır; eski görsel silme sırasında Storage hatası olursa post akışı bozulmaz fakat eski dosya kalabilir.
- Firestore rule seviyesi image path ile gerçek Storage nesnesi arasında birebir bağ kurmaz; path doğrulaması pragmatik olarak prefix kontrolü seviyesindedir.
- Görseller public read olduğu için community post image URL’leri dışarıdan erişilebilir; bu V1 ürün kararı olarak kabul edildi.
- Crop, multi-image, video, lightbox ve caption desteği bu iterasyonda özellikle kapsam dışı bırakıldı.
