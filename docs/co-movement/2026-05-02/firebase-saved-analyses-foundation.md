# Özet

Özel analiz sonuçlarının backend application koduna dokunmadan Firebase/Firestore üzerinde kullanıcı hesabına kaydedilebilmesi için frontend temeli eklendi ve Firestore security rules deploy edildi. Kullanıcı özel analiz sonucunu kaydedebilir, kayıtlı analizleri listeleyebilir, açabilir ve silebilir; giriş yapılmamış durumda kaydetme akışı kapalı ve açıklayıcıdır.

# Değişiklik Listesi

- `frontend/services/co-movement-saved-analyses.service.ts` eklendi.
- `frontend/hooks/use-co-movement-saved-analyses.ts` eklendi.
- `frontend/features/markets/co-movement/co-movement-section.tsx` güncellendi.
- `firestore.rules` güncellendi ve `evalon-auths` projesine deploy edildi.
- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` içinde Faz 2 durumu güncellendi.

# Teknik Detaylar

- Firestore veri modeli frontend servisinde şu şekilde kuruldu:

```txt
users/{uid}/coMovementAnalyses/{analysisId}
users/{uid}/coMovementAnalyses/{analysisId}/matrices/{matrixName}
```

- Ana analiz dokümanı; başlık, tarih, semboller, metrik özeti, request, capped analiz sonucu, varsa yorum ve yorum scope bilgisini saklıyor.
- Matrisler ana dokümanı şişirmemek için `matrices` subcollection altında ayrı dokümanlara yazılıyor.
- `top_pairs`, `pair_rankings` ve `rolling_stability` kayıt sırasında limitleniyor. Bu, Firestore doküman boyutu riskini azaltmak için backend snapshot store mantığına benzer bir kompaktlaştırma katmanı sağlar.
- React Query hook'ları eklendi:
  - `useSavedCoMovementAnalyses`
  - `useSaveCoMovementAnalysis`
  - `useOpenSavedCoMovementAnalysis`
  - `useDeleteSavedCoMovementAnalysis`
- Özel analiz sekmesine kompakt `Kayıtlı Analizler` paneli eklendi.
- Özel analiz sonucu geldikten sonra `Analizi Kaydet` aksiyonu gösteriliyor.
- Kayıtlı analiz açıldığında backend'e tekrar analyze isteği atmadan Firestore'daki sonuç ekrana basılıyor.
- Firestore rules içinde `users/{uid}/coMovementAnalyses/{analysisId}` ve `matrices/{matrixName}` sadece `request.auth.uid == uid` koşuluyla okunup yazılabilir hale getirildi.

# Kontrol Listesi

1. `Özel Analiz` sekmesini aç.
2. Giriş yapılmamış durumda `Kayıtlı Analizler` panelinde giriş bilgilendirmesinin göründüğünü doğrula.
3. Özel analiz çalıştır.
4. Giriş yapılmamış durumda `Analizi Kaydet` butonunun disabled olduğunu doğrula.
5. Giriş yapılmış kullanıcıyla özel analiz çalıştır.
6. `Analizi Kaydet` butonuna bas ve analiz listesinin güncellendiğini doğrula.
7. Kayıtlı analizi `Aç` aksiyonu ile yükle.
8. Yüklenen analizde graph, pair listesi, matrisler ve yorum kapsamının çalıştığını doğrula.
9. Kayıtlı analizi sil ve listeden kalktığını doğrula.

# Bilinen Sorunlar / Eksikler

- Firestore security rules dry-run ve gerçek deploy ile doğrulandı.
- Çok büyük özel analizlerde matris dokümanları da Firestore belge limitine yaklaşabilir; gerekirse Faz 7'de matrix chunking veya maksimum kaydedilebilir sembol sayısı kuralı eklenmeli.
- Giriş yapılmış kullanıcıyla gerçek Firestore yazma/okuma QA'sı bu ortamda yapılmadı; girişsiz state ve UI davranışı tarayıcıda doğrulandı.
