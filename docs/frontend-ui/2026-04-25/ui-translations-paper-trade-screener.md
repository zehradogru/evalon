# UI Çeviri Güncellemeleri, Paper Trade & Screener İyileştirmeleri

**Commit:** `3fad12a`  
**Branch:** `feature/improvements`  
**Tarih:** 2026-04-25

---

## Özet

48 frontend bileşeninde Türkçe metinler İngilizce'ye çevrildi. Paper Trade modülüne yeni `PaperTradeWidget` bileşeni eklendi, loading state ve hata yönetimi güçlendirildi. Screener ve Watchlist bileşenlerinde küçük UI düzeltmeleri yapıldı.

---

## Değişiklik Listesi

### Yeni Eklenen Dosyalar
| Dosya | Açıklama |
|---|---|
| `frontend/features/paper-trade/paper-trade-widget.tsx` | Portfolio ve simülasyon sekmelerini gösteren yeni widget (203 satır) |

### Güncellenen Dosyalar
| Dosya | Değişiklik |
|---|---|
| `frontend/features/paper-trade/trade-history-table.tsx` | Tablo başlıkları ve buton metinleri İngilizce'ye çevrildi |
| `frontend/features/paper-trade/order-entry-panel.tsx` | Form alanları ve hata mesajları İngilizce'ye çevrildi |
| `frontend/features/paper-trade/paper-trade-dashboard.tsx` | Sekme ve label çevirileri |
| `frontend/features/paper-trade/leaderboard-table.tsx` | Tablo sütun başlıkları İngilizce |
| `frontend/features/paper-trade/time-machine-panel.tsx` | UI metinleri yeniden düzenlendi |
| `frontend/features/paper-trade/portfolio-summary-card.tsx` | Özet kart metinleri İngilizce |
| `frontend/features/paper-trade/performance-metrics.tsx` | Metrik etiketleri İngilizce |
| `frontend/features/paper-trade/positions-table.tsx` | Pozisyon tablosu sütunları İngilizce |
| `frontend/features/paper-trade/portfolio-chart.tsx` | Grafik etiketleri |
| `frontend/features/paper-trade/reset-portfolio-dialog.tsx` | Dialog metinleri İngilizce |
| `frontend/features/paper-trade/asset-allocation-chart.tsx` | Pasta dilimi etiketleri |
| `frontend/features/paper-trade/order-book-widget.tsx` | Order book UI metinleri |
| `frontend/features/paper-trade/time-machine-back-link.tsx` | Geri butonu metni |
| `frontend/features/screener/scan-controls.tsx` | Tarama kontrolü metinleri İngilizce |
| `frontend/features/screener/filter-panel/filter-row.tsx` | Filtre satırı etiketleri İngilizce |
| `frontend/features/watchlist/watchlist-view.tsx` | Watchlist görünümü metinleri |
| `frontend/features/tools/profit-loss-calculator.tsx` | Komisyon hesaplamaları refactor edildi, metinler İngilizce |
| `frontend/features/stocks/stock-detail-view.tsx` | Loading state ve hata yönetimi eklendi |
| `frontend/features/markets/ticker-view.tsx` | Ticker detay görünümü iyileştirildi (+334 satır) |
| `frontend/features/markets/markets-view.tsx` | Markets görünümü güncellendi |
| `frontend/features/markets/movers-view.tsx` | Movers görünümü güncellendi |
| `frontend/features/markets/fullscreen-chart-view.tsx` | Tam ekran grafik görünümü |
| `frontend/features/news/news-view.tsx` | Haber görünümü iyileştirmeleri |
| `frontend/features/correlation/correlation-view.tsx` | Korelasyon matrisi büyük refactor (+471 satır) |
| `frontend/features/backtest/backtest-view.tsx` | Backtest görünümü büyük güncelleme (+773 satır) |
| `frontend/features/analysis/analysis-view.tsx` | Analiz görünümü |
| `frontend/features/ai-assistant/ai-assistant-view.tsx` | AI asistan görünümü |
| `frontend/features/academy/academy-view.tsx` | Akademi görünümü |
| `frontend/features/landing/market-overview-section.tsx` | Landing sayfası market özeti |
| `frontend/features/dashboard/market-news.tsx` | Dashboard haber bileşeni |
| `frontend/features/dashboard/main-chart.tsx` | Ana grafik bileşeni |
| `frontend/features/dashboard/live-watchlist.tsx` | Canlı watchlist |
| `frontend/features/dashboard/ticker-tape.tsx` | Ticker bant bileşeni |
| `frontend/features/dashboard/top-movers.tsx` | En çok hareket edenler |
| `frontend/features/dashboard/behavioral-checkin.tsx` | Davranışsal kontrol |
| `frontend/components/dashboard/news-carousel.tsx` | Haber carousel bileşeni (+85 satır) |
| `frontend/components/dashboard/portfolio-chart.tsx` | Portfolio grafik bileşeni |
| `frontend/components/dashboard/watchlist-widget.tsx` | Watchlist widget |
| `frontend/components/dashboard/navbar.tsx` | Navbar güncelleme |
| `frontend/components/layout/dashboard-shell.tsx` | Layout shell |
| `frontend/components/ui/select-native.tsx` | Native select bileşeni |
| `frontend/data/academy.ts` | Akademi verisi İngilizce'ye çevrildi |
| `frontend/src/components/layout/Sidebar.tsx` | Sidebar linkleri güncellendi |
| `frontend/app/layout.tsx` | Root layout güncelleme |
| `frontend/app/paper-trade/page.tsx` | Paper trade ana sayfa |
| `frontend/app/paper-trade/leaderboard/page.tsx` | Leaderboard sayfası |
| `frontend/app/paper-trade/time-machine/page.tsx` | Time machine sayfası |

---

## Teknik Detaylar

### Yeni PaperTradeWidget Bileşeni
- `Portfolio` ve `Simulation` sekmeli yapı
- Portföy özet verilerini görüntüler
- Loading skeleton ve hata state'leri içerir
- `frontend/features/paper-trade/paper-trade-widget.tsx` (203 satır, sıfırdan yazıldı)

### Komisyon Hesaplama Refactor (ProfitLossCalculator)
- Brüt kâr/zarar ayrı hesaplanıyor
- Komisyon: `(entry + exit) * commissionPct / 100` formülü netleştirildi
- Net kâr/zarar ekranda ayrı gösteriliyor

### Backtest View Büyük Güncelleme
- Timestamp dönüşüm sorunları giderildi
- Veri yapısı iyileştirildi
- +773 satır net ekleme

### Correlation View Refactor
- `fetchMultipleTickers` Map döndürdüğü için `data[ticker]` → `data.get(ticker)` düzeltmesi
- `getCloses` fonksiyonu `number[][]` → `{ c: number }[]` (PriceBar objesi) desteğine güncellendi
- Heatmap artık doğru çalışıyor

---

## Kontrol Listesi

- [ ] `/paper-trade` → Portföy ve Simülasyon sekmeleri doğru görünüyor
- [ ] `/paper-trade/leaderboard` → Tablo başlıkları İngilizce
- [ ] `/paper-trade/time-machine` → Zaman makinesi UI çalışıyor
- [ ] `/screener` → Filtre satırı ve tarama kontrolleri İngilizce
- [ ] `/watchlist` → Tüm metinler İngilizce
- [ ] `/correlation` → Heatmap veri gösteriyor (PriceBar fix)
- [ ] `/markets` → Ticker detay sayfası açılıyor
- [ ] `/tools/profit-loss-calculator` → Komisyon hesabı doğru

---

## Bilinen Sorunlar / Eksikler

- Screener B7 (URL state sync, preset drawer, export bar) henüz tamamlanmadı
- Academy içerikleri çevirisi kısmen tamamlandı, bazı detay sayfaları beklemede
