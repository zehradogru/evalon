# Özet

Community sayfası statik mock yapıdan çıkarılıp Firestore tabanlı gerçek bir feed deneyimine dönüştürüldü. V1 kapsamında feed, post composer, detay sayfası, like/save/share/report etkileşimleri ve kendi postlarını edit/delete etme akışı eklendi.

# Değişiklik Listesi

- `firestore.rules` güncellendi.
- `firestore.indexes.json` eklendi.
- `frontend/types/index.ts` güncellendi.
- `frontend/components/providers.tsx` güncellendi.
- `frontend/components/ui/textarea.tsx` eklendi.
- `frontend/components/ui/toaster.tsx` eklendi.
- `frontend/hooks/use-toast.ts` eklendi.
- `frontend/lib/community.ts` eklendi.
- `frontend/lib/community-firestore.ts` eklendi.
- `frontend/services/community.service.ts` eklendi.
- `frontend/hooks/use-community.ts` eklendi.
- `frontend/features/community/community-view.tsx` tamamen yenilendi.
- `frontend/features/community/post-detail-view.tsx` eklendi.
- `frontend/features/community/components/community-composer.tsx` eklendi.
- `frontend/features/community/components/community-filter-bar.tsx` eklendi.
- `frontend/features/community/components/community-feed-list.tsx` eklendi.
- `frontend/features/community/components/community-post-card.tsx` eklendi.
- `frontend/features/community/components/community-empty-state.tsx` eklendi.
- `frontend/features/community/components/community-related-post-groups.tsx` eklendi.
- `frontend/app/community/page.tsx` güncellendi.
- `frontend/app/community/[postId]/page.tsx` eklendi.

# Teknik Detaylar

- Community veri modeli Firestore üzerinde şu koleksiyonlarla çalışacak şekilde kurgulandı:
  - `/posts/{postId}`
  - `/posts/{postId}/reports/{reporterUid}`
  - `/users/{uid}/likes/{postId}`
  - `/users/{uid}/saves/{postId}`
  - `/users/{uid}.lastPostAt`
- `frontend/types/index.ts` içine `CommunityPostRecord`, `CommunityReportRecord`, `CommunityMarkerRecord`, `CommunityPost`, `CommunityPostDraft`, `CommunityFeedPage`, `CommunityRelatedGroup` ve ilgili filter/report tipleri eklendi.
- `frontend/lib/community-firestore.ts` içinde typed converter ve path helper katmanı eklendi:
  - `postsCollection()`
  - `postDoc(postId)`
  - `postReportDoc(postId, uid)`
  - `userLikeDoc(uid, postId)`
  - `userSaveDoc(uid, postId)`
  - `userDoc(uid)`
- `frontend/services/community.service.ts` ile tüm Firestore işlemleri merkezileştirildi:
  - latest feed query
  - mine feed query
  - saved feed hydration
  - single post load
  - create/edit/delete
  - like/save transaction akışları
  - report transaction akışı
  - related posts query
- Feed pagination cursor-based olacak şekilde `useInfiniteQuery` ile bağlandı. `Saved` filtresi, save marker sırasını koruyacak şekilde hydrate edilir.
- `Mine` filtresi, `authorId + createdAt` composite indexine bağımlı kalmamak için latest public post akışını tarayıp client-side author/ticker filtrelemesiyle hydrate edilir. Bu, kişisel feed’in index build gecikmelerinde veya index eksikliği durumlarında da çalışmasını sağlar.
- Like ve save aksiyonları React Query cache üzerinde optimistic update ile çalışır. Create/edit/delete/report aksiyonları success sonrası cache patch + invalidate yaklaşımı kullanır.
- Share aksiyonu `navigator.share` destekleniyorsa native share çağırır; destek yoksa clipboard fallback + toast kullanır.
- `frontend/components/providers.tsx` içine global `Toaster` eklendi ve auth değişiminde community query cache’leri de user-scoped temizlenecek şekilde genişletildi.
- `firestore.rules` içine community için yeni güvenlik blokları eklendi:
  - `/posts` için public read
  - authenticated create/update/delete
  - `content <= 500`
  - `tickers` ve `tags` için array boyut limiti
  - `authorId == request.auth.uid`
  - `lastPostAt` bazlı 30 saniye rate limit
  - edit sırasında immutable alan koruması
  - like/report counter için delta guard
  - `/posts/{id}/reports/{uid}` için tekil report create koruması
- `firestore.indexes.json` içinde community sorguları için şu composite index tanımları eklendi:
  - `tickers array-contains + createdAt desc`
  - `authorId + createdAt desc`
  - `authorId + tickers array-contains + createdAt desc`
- UI dili tamamen English bırakıldı. User-generated content üzerinde dil validasyonu eklenmedi.

# Kontrol Listesi (Checklist)

1. `/community` sayfasını aç ve feed ekranının yüklenmesini doğrula.
2. Login olmadan `All` filtresinde postları okuyabildiğini doğrula.
3. Login olmadan `Saved` ve `Mine` filtrelerine geç; auth-required state göründüğünü kontrol et.
4. Login ol ve yeni bir post oluştur:
   - içerik gir
   - opsiyonel ticker/tag ekle
   - publish sonrası detail sayfasına yönlendiğini doğrula.
5. Aynı kullanıcı ile kendi postunda edit akışını dene; `edited` bilgisinin görünür olduğunu kontrol et.
6. Kendi postunda delete akışını dene; feed/detail davranışının doğru olduğunu doğrula.
7. Başka bir post üzerinde like ve save aksiyonlarını dene; sayaç ve saved state’in UI’da güncellendiğini kontrol et.
8. Share butonuna bas; desteklenen ortamda native share, aksi halde clipboard toast davranışını doğrula.
9. Report menüsünden bir reason seç; success toast geldiğini ve ikinci raporda duplicate hatasının gösterildiğini doğrula.
10. `/community?ticker=THYAO` benzeri bir query param ile ticker filtrelemesinin çalıştığını kontrol et.
11. Feed’de scroll ederek pagination’ın devam ettiğini doğrula.
12. `/community/[postId]` detail sayfasında related posts bloklarının yüklendiğini kontrol et.
13. 30 saniye dolmadan arka arkaya ikinci post göndermeyi dene; Firestore rule kaynaklı blok davranışını doğrula.
14. `npm run build` komutunu `frontend/` altında çalıştır; production build’in geçtiğini doğrula.

# Bilinen Sorunlar / Eksikler

- `authorName` post dokümanına denormalize yazıldığı için kullanıcı sonradan display name değiştirirse eski postlar otomatik güncellenmez.
- `Saved` filtresinde ticker filtrelemesi save marker üzerinden değil hydrate edilen postlar üzerinde uygulanır; çok seyrek eşleşmelerde kullanıcı daha fazla sayfa yüklemek zorunda kalabilir.
- `Mine` filtresi artık index bağımlılığını azaltmak için latest feed üzerinden tarama yapar; çok büyük veri kümelerinde kullanıcının eski postlarına ulaşmak için ek sayfa taraması gerekebilir.
- Firestore tarafında index oluşturma işlemi deploy sonrası arka planda tamamlanır; büyük veri hacminde ilk dakikalarda sorgular geçici olarak index-build bekleyebilir.
- Report sistemi yalnızca signal toplar; moderation dashboard, review queue veya automatic hiding bu V1 kapsamına alınmadı.
- Public profile, comments, notifications, image upload ve extra ranking/sorting modları özellikle kapsam dışında bırakıldı.
