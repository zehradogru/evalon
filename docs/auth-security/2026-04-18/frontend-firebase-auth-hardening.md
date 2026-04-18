# Özet

Login, signup ve password reset akışları generic hata dili, normalize girişler ve rollout kontrollü email verification ile sertleştirildi. Buna ek olarak kullanıcıya özel Firestore ve Storage erişimleri owner-based Firebase Rules ile repo içine sürümlendi.

# Değişiklik Listesi

- `frontend/lib/auth-utils.ts` eklendi.
- `frontend/types/index.ts` güncellendi.
- `frontend/services/auth.service.ts` güncellendi.
- `frontend/services/profile.service.ts` güncellendi.
- `frontend/store/use-auth-store.ts` güncellendi.
- `frontend/components/providers.tsx` güncellendi.
- `frontend/components/auth/protected-route.tsx` güncellendi.
- `frontend/app/page.tsx` güncellendi.
- `frontend/app/ai/page.tsx` güncellendi.
- `frontend/app/(auth)/login/page.tsx` güncellendi.
- `frontend/app/(auth)/signup/page.tsx` güncellendi.
- `frontend/app/(auth)/forgot-password/page.tsx` güncellendi.
- `frontend/app/(auth)/verify-email/page.tsx` eklendi.
- `frontend/hooks/use-profile.ts` güncellendi.
- `firebase.json` eklendi.
- `firestore.rules` eklendi.
- `storage.rules` eklendi.

# Teknik Detaylar

- `User` ve `UserProfile` tiplerine `emailVerified` ve `authSecurity` alanları eklendi.
- `authSecurity` alanı şu rollout bilgisini taşır:
  - `verificationRequired`
  - `rolloutVersion`
  - `createdWithProvider`
- Yeni `email/password` signup sonrası:
  - kullanıcı oluşturulur,
  - `authSecurity.verificationRequired = true` olarak `users/{uid}` dokümanına yazılır,
  - verification maili gönderilir,
  - kullanıcı `/verify-email` ekranına alınır.
- Mevcut kullanıcılar için `authSecurity` alanı zorunlu olarak geriye dönük yazılmadı; bu sayede eski hesaplar bloklanmadı.
- Google login için ilk girişte `authSecurity` alanı `verificationRequired = false` olacak şekilde yazılır; mevcut kayıt varsa üzerine zorlayıcı downgrade yapılmaz.
- Login, signup ve reset password tarafında email normalize edilir (`trim + lowercase`), display name normalize edilir (`trim + tek boşluk`).
- Login ve signup public hata mesajları enumeration azaltacak şekilde generic hale getirildi.
- Password reset ekranı artık hesap var/yok bilgisi sızdırmadan aynı başarı diliyle çalışır.
- Signup formu Firebase Console policy ile hizalandı:
  - minimum 10 karakter
  - uppercase zorunlu
  - lowercase zorunlu
  - numeric zorunlu
  - special character zorunlu değil
- Protected route mantığı email verification rollout bilgisiyle genişletildi:
  - auth yoksa `/login`
  - rollout kapsamındaki doğrulanmamış hesap ise `/verify-email`
- Ana sayfa authenticated dashboard render etmeden önce verification durumunu kontrol eder.
- Firebase Rules dosyaları eklendi:
  - Firestore: `users/{userId}` ve alt koleksiyonlar sadece owner erişimine açık
  - Storage: `users/{userId}/profile/**` sadece owner erişimine açık

# Kontrol Listesi (Checklist)

1. Yeni bir email/password hesap oluştur.
2. Signup sonrası doğrudan dashboard yerine `/verify-email` ekranının açıldığını doğrula.
3. Verification mailinin geldiğini ve linkin çalıştığını kontrol et.
4. `/verify-email` ekranında `I've verified my email` butonuna bas ve ana sayfaya döndüğünü doğrula.
5. Verification tamamlanmadan `/ai`, `/watchlist`, `/profile` ve `/settings` sayfalarına erişmeye çalış; `/verify-email` ekranına yönlenmelisin.
6. Mevcut eski bir email/password kullanıcıyla giriş yap; uygulamaya bloklanmadan girebildiğini doğrula.
7. Google ile giriş yap; mevcut akışın bozulmadığını doğrula.
8. Forgot password ekranında kayıtlı ve kayıtsız iki farklı email dene; kullanıcıya görünen başarı metni aynı olmalı.
9. Yanlış şifre ile login dene; generic hata mesajı göründüğünü doğrula.
10. Profil fotoğrafı yükleme, watchlist güncelleme ve alert işlemlerinin mevcut kullanıcı için çalıştığını test et.
11. Firebase Emulator veya Rules Playground ile farklı bir `uid` üzerinden `users/{uid}` verisine erişimin reddedildiğini kontrol et.

# Bilinen Sorunlar / Eksikler

- `frontend/app/api/ai/*` tarafında backend’e giden user context hâlâ server-side Firebase token doğrulaması yapmıyor; bu fazda kapsam dışı bırakıldı.
- App Check enforcement bu faza dahil edilmedi.
- GCP quota / Identity Toolkit tarafında brute-force tuning yapılmadı; sonraki fazda ayrıca değerlendirilmeli.
- Email action link’leri Firebase hosted flow ile devam ediyor; özel action handler bu çalışmada eklenmedi.
