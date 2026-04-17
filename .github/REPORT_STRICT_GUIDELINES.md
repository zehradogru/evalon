# Evalon Documentation & Reporting Guidelines

Bu dosya, projede yapılan her değişikliğin nasıl raporlanması gerektiğini belirleyen kesin kuralları içerir. Tüm geliştiricilerin ve AI asistanlarının bu yapıya uyması zorunludur.

## Raporlama Yapısı

Her önemli değişiklikten veya iş gününden sonra, raporlar şu dizin yapısına göre kaydedilmelidir:

`docs/[konu-ismi]/[tarih-dosyasi]/[rapor-ismi].md`

### Örnek Yapı:
- `docs/api-integration/2026-04-17/cloud-run-migration.md`
- `docs/ui-fixes/2026-04-17/responsive-navbar.md`

## Dosya İsimlendirme Kuralları

1.  **Konu İsmi ([konu-ismi]):** Küçük harf, kelimeler arası tire (kebab-case). Örn: `auth-system`, `backtest-engine`.
2.  **Tarih Dosyası ([tarih-dosyasi]):** `YYYY-MM-DD` formatında olmalı. Örn: `2026-04-17`.
3.  **Rapor İsmi ([rapor-ismi]):** Kısa ve açıklayıcı, kebab-case. Örn: `fix-indicator-crossover`.

## Rapor İçeriği Gereksinimleri

Her `.md` raporu şu bölümleri içermelidir:

1.  **Özet:** Yapılan değişikliğin 1-2 cümlelik özeti.
2.  **Değişiklik Listesi:** Hangi dosyalar eklendi veya değiştirildi.
3.  **Teknik Detaylar:** Kullanılan API endpointleri, yeni eklenen tipler (Types) veya mantıksal değişiklikler.
4.  **Kontrol Listesi (Checklist):** Sitede nelerin test edilmesi gerektiğine dair adım adım kılavuz.
5.  **Bilinen Sorunlar / Eksikler:** Varsa henüz tamamlanmamış kısımlar.

> [!IMPORTANT]
> Bu kurala uyulmaması durumunda dökümantasyon bütünlüğü bozulmuş sayılır. Yapılan her iş mutlaka bu formatta belgelenmelidir.
