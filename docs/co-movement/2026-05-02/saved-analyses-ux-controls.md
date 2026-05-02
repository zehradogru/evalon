# Özet

Kayıtlı Analizler deneyimi ürün kullanımı için güçlendirildi. Kullanıcı artık son kayıtları kompakt listede görebilir, tüm kayıtları sağ panelde açabilir, kayıt adını değiştirebilir ve silmeden önce özel onay ekranı görür.

# Değişiklik Listesi

- `frontend/features/markets/co-movement/co-movement-section.tsx` güncellendi.
- `frontend/hooks/use-co-movement-saved-analyses.ts` güncellendi.
- `frontend/services/co-movement-saved-analyses.service.ts` güncellendi.
- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` güncellendi.
- `docs/co-movement/2026-05-02/saved-analyses-ux-controls.md` eklendi.

# Teknik Detaylar

- `useSavedCoMovementAnalyses` hook'u liste limitini parametre alacak şekilde genişletildi ve Co-Movement sayfasında 50 kayıt çekilecek hale getirildi.
- `useRenameSavedCoMovementAnalysis` hook'u eklendi; başarılı işlemden sonra kayıtlı analiz query cache'i invalidate ediliyor.
- Firebase servisindeki `rename` akışına boş başlık koruması eklendi.
- `SavedAnalysesPanel` içinde son 5 kayıt kompakt gösteriliyor; daha fazla kayıt varsa `Tüm kayıtları gör` sheet'i açılıyor.
- Kayıt satırlarına `Aç`, yeniden adlandır ve sil aksiyonları eklendi.
- `window.confirm` kaldırıldı; silme işlemi için ürün arayüzüne uygun özel dialog kullanılıyor.
- Açık kayıt durumunda sonuç satırı `Kayıtlı analiz · [başlık]` ve kayıt tarihiyle gösteriliyor.
- Açma, yeniden adlandırma ve silme aksiyonlarında async hata durumları yakalanıyor; işlem başarısız olursa dialog/sheet erken kapanmıyor ve parent mutation hata state'i korunuyor.

# Kontrol Listesi (Checklist)

- [x] `npm run lint -- features/markets/co-movement/co-movement-section.tsx services/co-movement-saved-analyses.service.ts hooks/use-co-movement-saved-analyses.ts services/co-movement.service.ts app/api/co-movement/explain/route.ts app/api/co-movement/explain/stream/route.ts`
- [x] `npx tsc --noEmit`
- [x] Browser'da `/markets/co-movement` sayfası reload edildi.
- [x] Giriş yapılmamış durumda `Kayıtlı Analizler` boş/giriş çağrısı kontrol edildi.
- [x] `Gelişmiş Ayarlar` ve özel analiz formu görünümü yeniden kontrol edildi.
- [x] Async action kopukluğu riski için açma/rename/delete promise akışları sağlamlaştırıldı.
- [x] Gerçek kullanıcı kaydını değiştirmemek için browser QA sırasında rename/delete submit edilmedi.

# Bilinen Sorunlar / Eksikler

- Girişli kullanıcıyla Firebase üzerinde gerçek rename/delete e2e testi kullanıcı verisini değiştireceği için çalıştırılmadı.
- Mobilde sağ sheet'in scroll ve aksiyon ergonomisi ayrıca kontrol edilmeli.
- Çok büyük kayıt geçmişi için ileride sayfalama veya arama eklenebilir.
