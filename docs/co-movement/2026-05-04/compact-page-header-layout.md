# Co-Movement Compact Page Header Layout

## Özet
Co-movement sayfasının üst düzeni sadeleştirildi. `Co_movement` başlığı bağımsız bırakıldı; mod navigasyonu, aktif görünüm istatistikleri, meta bilgiler ve özel analiz aksiyonları başlığın altında tek kompakt barda birleştirildi.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/markets/co-movement/co-movement-section.tsx`
- Eklendi: `docs/co-movement/2026-05-04/compact-page-header-layout.md`

## Teknik Detaylar
- Hero/container wrapper ve `cmo-hero-glow` kullanımı üst başlıktan kaldırıldı.
- `Piyasa Görünümü / Özel Analiz` mod seçimi aynı `activeMode` state'iyle kompakt header bar içinde çalışır.
- Snapshot ve özel analiz istatistik/meta bilgileri aktif moda göre tek listeden render edilir.
- Snapshot içindeki ayrı summary strip ve meta satırı kaldırıldı.
- Özel analiz sonucundaki ayrı summary strip, meta satırı ve kaydetme aksiyon satırı kaldırıldı; aksiyonlar kompakt header bar'a taşındı.
- Graph, search, detay paneli, seçili node, grup odağı, pair skorları ve kayıtlı analiz davranışları değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/markets/co-movement/co-movement-section.tsx` çalıştır.
2. Repo kökünde `git diff --check` çalıştır.
3. `/markets/co-movement` sayfasında `Co_movement` başlığının bağımsız göründüğünü kontrol et.
4. Mod navigasyonu, istatistikler ve meta bilgilerin başlığın altında tek kompakt barda toplandığını kontrol et.
5. Snapshot tarafında eski ayrı istatistik kartları ve meta satırının tekrar olarak görünmediğini kontrol et.
6. Özel analiz sonucu oluşunca custom istatistik/meta/aksiyonların aynı kompakt barda göründüğünü kontrol et.
7. Mod geçişleri, analiz çalıştırma, kaydetme, kayıtlı analiz açma, graph search ve detay panelinin çalışmaya devam ettiğini kontrol et.
8. Mobil genişlikte kompakt barın satır kırarak yerleştiğini ve metinlerin üst üste binmediğini kontrol et.

## Bilinen Sorunlar / Eksikler
- Bu değişiklik yalnızca görsel düzenleme kapsamındadır; proje genelindeki mevcut bağımsız lint/build hataları ele alınmadı.
