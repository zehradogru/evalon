# Özet

Co-Movement yorum üretimi artık kullanıcının mevcut odağına göre çalışıyor. Tüm piyasa, seçili community, seçili pair ve seçili hisse odağı için açıklama payload'ı frontend'de daraltılıyor; kullanıcı yorum kartında yorumun hangi kapsam için üretildiğini açıkça görüyor.

# Değişiklik Listesi

- `frontend/features/markets/co-movement/co-movement-section.tsx` güncellendi.
- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` içinde Faz 1 tamamlandı olarak işaretlendi.

# Teknik Detaylar

- Ortak `ExplainScope` modeli eklendi: `market`, `community`, `pair`, `symbols`.
- `buildScopedExplainPayload(...)` helper'ı eklendi. Bu helper, backend endpoint'i değiştirmeden mevcut `/api/co-movement/explain/stream` payload'ını seçili kapsama göre daraltıyor.
- Community seçiliyken sadece o community'nin hisseleri, grup içi top pair'ler ve community bilgisi gönderiliyor.
- Pair seçiliyken sadece seçili iki hisse ve ilgili pair gönderiliyor.
- Node/hisse odağında seçili hissenin en güçlü komşuları üzerinden sembol sepeti oluşturuluyor.
- Scope değiştiğinde eski yorum ekranda kalmıyor; her açıklama kendi scope key'i ile ilişkilendiriliyor.
- `ExplanationCard` üzerinde `Kapsam` etiketi ve final metadata içinde kapsam bilgisi gösteriliyor.

# Kontrol Listesi

1. `http://localhost:3000/markets/co-movement` sayfasını aç.
2. `Piyasa Görünümü` sekmesinde ilk yorum kartında kapsamın `Tüm piyasa` olduğunu doğrula.
3. Bir community seç; yorum kartında kapsamın ilgili grup, örneğin `G9`, olduğunu doğrula.
4. `Yorum Üret` butonuna bas; final yorumun seçili community için üretildiğini doğrula.
5. `Tüm Piyasa` odağına dön; eski community yorumunun görünmediğini doğrula.
6. Matris bölümünde `Top Pair` odağına geç; yorum kapsamının seçili pair'e döndüğünü doğrula.
7. `Özel Analiz` çalıştır; yorum kapsamının önce özel analizin tamamını gösterdiğini doğrula.
8. Özel analizde bir community seç; yorum kapsamının ilgili community'ye döndüğünü doğrula.

# Bilinen Sorunlar / Eksikler

- Backend prompt'u değiştirilmedi; kapsam yönetimi frontend payload daraltma ve ek metrics alanlarıyla yapılıyor.
- Özel analizde pair-level yorum seçimi henüz ayrı bir kontrol olarak yok; mevcut Faz 1 kapsamı tüm analiz, community ve node/hisse odağını kapsıyor.
- Firebase tabanlı kayıtlı analizler ayrı Faz 2 raporunda takip ediliyor.
