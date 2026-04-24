# Özet

Community post detay sayfasına ve community feed içine gerçek yorum sistemi eklendi. Feed üzerindeki `Discuss` aksiyonu artık sayfa değiştirmeden inline yorum panelini açıyor; detay sayfasındaki yorum alanı da aynı bileşenle çalışıyor. Inline tartışma paneli görsel olarak post kartına bağlı, daha kompakt ve okunabilir bir thread drawer yapısına taşındı.

# Değişiklik Listesi

- `frontend/types/index.ts` güncellendi.
- `frontend/lib/community.ts` güncellendi.
- `frontend/lib/community-firestore.ts` güncellendi.
- `frontend/services/community.service.ts` güncellendi.
- `frontend/hooks/use-community.ts` güncellendi.
- `frontend/features/community/components/community-post-card.tsx` güncellendi.
- `frontend/features/community/post-detail-view.tsx` güncellendi.
- `frontend/features/community/components/community-comment-composer.tsx` eklendi.
- `frontend/features/community/components/community-comments-list.tsx` eklendi.
- `frontend/features/community/components/community-discussion-panel.tsx` eklendi.
- `frontend/features/community/components/community-avatar.tsx` eklendi.
- `frontend/features/community/components/community-image-lightbox.tsx` eklendi.
- `frontend/features/community/components/community-composer.tsx` güncellendi.
- `firestore.rules` güncellendi ve Firebase projesine deploy edildi.

# Teknik Detaylar

- Yorumlar Firestore üzerinde `/posts/{postId}/comments/{commentId}` subcollection path'i altında tutulur.
- Yeni tipler eklendi: `CommunityCommentRecord`, `CommunityCommentDraft`, `CommunityComment`.
- `CommunityPostRecord` için geriye dönük uyumlu `commentCount` alanı eklendi; eski postlar UI'da `0` fallback'iyle okunur.
- `communityService` içine `getComments`, `createComment`, `updateComment`, `deleteComment` metotları eklendi.
- Comment create/delete işlemleri transaction ile post üzerindeki `commentCount` değerini günceller.
- `CommunityDiscussionPanel`, yorum listeleme/yazma/edit/sil akışını ortaklaştırır ve hem `/community` feed içinde hem de `/community/[postId]` detay sayfasında kullanılır.
- `CommunityPostCard` içindeki `Discuss` aksiyonu opsiyonel `onDiscuss` callback'i alır; feed context'inde route değiştirmeden inline panel açar, fallback olarak detay URL hash'i korunur.
- Inline discussion panel post kartının altına bağlı drawer gibi render edilir; açık durumdaki `Discuss` butonu aktif renkle vurgulanır.
- Login olmayan kullanıcılar için composer textarea yerine kompakt `Sign in` çağrısı gösterilir; mevcut yorumlar okunabilir kalır.
- Detay sayfasındaki büyük açıklama bandı kaldırıldı ve post/diskusyon akışı daha doğrudan hale getirildi.
- Resimli community postlarda görsel tıklanınca lightbox açılır; kullanıcı modal içinde zoom in, zoom out ve reset kontrollerini kullanabilir.
- Community post, yorum ve composer avatarları ortak `CommunityAvatar` bileşeninden render edilir.
- Community composer ticker alanı `/api/markets/list` aramasını kullanan seçilebilir picker'a taşındı; manuel Enter/virgül ile ticker ekleme davranışı korunur.
- `firestore.rules` içine public comment read, authenticated create, owner-only update/delete ve `commentCount` delta guard kontrolleri eklendi.
- Firebase rules `evalon-auths` projesine `firebase deploy --only firestore:rules --project evalon-auths` komutuyla deploy edildi.

# Kontrol Listesi (Checklist)

1. `/community` sayfasını aç ve post kartlarında `Discuss` yanında yorum sayısının göründüğünü kontrol et.
2. `/community` feed üzerinde `Discuss` butonuna basınca sayfa değişmeden ilgili postun altında yorum panelinin açıldığını doğrula.
3. Aynı `Discuss` butonuna tekrar basınca inline yorum panelinin kapandığını kontrol et.
4. `/community/[postId]` detay sayfasında yorum panelinin ana post altında görünür olduğunu doğrula.
5. Login olmadan yorumları okuyabildiğini, yorum yazmaya çalışınca sign-in uyarısı aldığını kontrol et.
6. Login olduktan sonra feed içinden yorum ekle; yorum listesine düştüğünü ve sayaç arttığını doğrula.
7. Login olduktan sonra detay sayfasından yorum ekle; aynı yorum akışının çalıştığını doğrula.
8. Kendi yorumunu edit et; içerik güncellensin ve `edited` göstergesi görünsün.
9. Kendi yorumunu sil; yorum listeden kalksın ve sayaç azalsın.
10. Başka kullanıcıya ait yorumlarda edit/delete kontrollerinin görünmediğini doğrula.
11. Resimli bir posta tıkla; lightbox'ın açıldığını, zoom in/out ve reset kontrollerinin çalıştığını doğrula.
12. Yeni post oluştururken ticker alanında şirket/ticker ara, önerilerden birini seç ve chip olarak eklendiğini doğrula.
13. Ticker alanına manuel sembol yazıp Enter/virgül ile ekleme davranışının devam ettiğini kontrol et.
14. `npm run build` komutunun frontend altında başarılı tamamlandığını kontrol et.

# Bilinen Sorunlar / Eksikler

- Comment threading/reply desteği yok; yorumlar tek seviyeli liste olarak çalışır.
- Moderation dashboard veya yorum report sistemi eklenmedi.
- Eski postların Firestore dokümanlarında `commentCount` alanı bulunmayabilir; ilk yorum işleminde sayaç transaction ile eklenir.
