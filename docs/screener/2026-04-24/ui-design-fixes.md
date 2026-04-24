# Screener UI Tasarım Düzeltmeleri

## Özet
Screener sayfasındaki aşırı border'lar kaldırıldı, yan kenar boşlukları eklendi ve sektor chip'lerinin tıklanamaz olması sorunu giderildi.

## Değişiklik Listesi

| Dosya | İşlem |
|---|---|
| `frontend/features/screener/screener-view.tsx` | Header, tab list, toolbar ve tablo alanlarına `px-8` padding eklendi; gereksiz `border-b` kaldırıldı |
| `frontend/features/screener/scan-controls.tsx` | Sector chip'leri scrollable wrapper içine alındı (`max-h-44 overflow-y-auto`); Timeframe+Bars 2 kolonlu grid'e taşındı; Scan butonu full-width yapıldı |
| `frontend/features/screener/filter-panel/filter-panel.tsx` | `border border-border rounded-lg bg-card` card wrapper kaldırıldı, doğrudan `flex flex-col gap-3` kullanıldı |

## Teknik Detaylar

- **Chip tıklama sorunu:** `scan-controls.tsx` içindeki sector chip'leri `overflow-hidden` bir container içindeydi, pointer event'leri engelleniyordu. Scrollable wrapper (`overflow-y-auto`) ile çözüldü.
- **Aktif chip stili:** `border-primary bg-primary/15 text-primary` — `onClick` toggle çalışıyor.
- **Sidebar yapısı:** Filters ve Scan Settings iki section'a ayrıldı, aralarında `border-t border-border/40` divider var.
- **Sektor isimleri Türkçe kaldı** (backend DB ile eşleşiyor).

## Kontrol Listesi

- [ ] Screener sayfasını aç → sağ ve sol kenarda boşluk var mı?
- [ ] Herhangi bir sektor chip'ine tıkla → rengi değişiyor mu (aktif görünüm)?
- [ ] Birden fazla chip seç, "Clear" butonu beliriyor mu?
- [ ] Filters bölümü ve Scan Settings bölümü arasında ince çizgi görünüyor mu?
- [ ] Scan butonu sidebar'ın tam genişliğini kaplıyor mu?

## Bilinen Sorunlar / Eksikler

- Yok.
