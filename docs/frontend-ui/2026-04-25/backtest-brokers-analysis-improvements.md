# Backtest Timestamp Düzeltmesi, Brokers & Analysis Güncellemesi

**Commit:** `c9ec793`  
**Branch:** `feature/improvements`  
**Tarih:** 2026-04-25

---

## Özet

Backtest view'da timestamp dönüşüm sorunları giderildi, portfolio curve veri yapısı yeniden tanımlandı. Brokers sayfası sıfırdan yeniden yazılarak detaylı broker karşılaştırma özelliği eklendi. Analysis view refactor edildi. Market movers bileşenine skeleton loading ve localStorage caching eklendi.

---

## Değişiklik Listesi

### Yeni Eklenen Dosyalar
| Dosya | Açıklama |
|---|---|
| `frontend/components/ui/skeleton.tsx` | Loading placeholder için yeni Skeleton UI bileşeni |
| `frontend/hooks/use-dashboard-data.ts` | Dashboard verileri için yeni custom hook (+54 satır) |

### Güncellenen Dosyalar
| Dosya | Değişiklik |
|---|---|
| `frontend/features/backtest/backtest-view.tsx` | Timestamp dönüşümü fix, portfolio curve veri yapısı güncellendi |
| `frontend/features/brokers/brokers-view.tsx` | Sıfırdan yeniden yazıldı: broker detay bilgileri, karşılaştırma (+522 satır) |
| `frontend/features/analysis/analysis-view.tsx` | Büyük refactor (375 satır yeniden düzenlendi) |
| `frontend/features/markets/movers-view.tsx` | Skeleton loading, localStorage caching (+62 satır) |
| `frontend/features/correlation/correlation-view.tsx` | Yakın fiyat veri yapısı uyumu için küçük düzeltme |
| `frontend/app/api/prices/route.ts` | Yeni fiyat endpoint'leri eklendi (+36 satır) |
| `frontend/services/indicators.service.ts` | Indicator response normalizasyonu (+10 satır) |
| `frontend/types/index.ts` | `PortfolioCurveData` yeni tip tanımlandı (+12 satır) |
| `frontend/components/dashboard/navbar.tsx` | Küçük güncelleme |

---

## Teknik Detaylar

### Yeni Tip: PortfolioCurveData (`frontend/types/index.ts`)
```ts
interface PortfolioCurveData {
  timestamp: number   // Unix ms
  value: number       // Portföy değeri ($)
  drawdown?: number   // Opsiyonel drawdown yüzdesi
}
```
Backtest'ten gelen portfolio curve yanıtını daha güvenli tiplendirmek için eklendi.

### Backtest View Timestamp Düzeltmesi
- Backend bazen `timestamp` saniye cinsinden, bazen ms cinsinden dönüyordu
- `timestamp < 1e10` ise `* 1000` yapılıyor (saniye → ms güvenlik kontrolü)
- Portfolio curve grafiği artık doğru tarih gösteriyor

### Brokers View Yeniden Yazma
- Her broker için: komisyon oranı, min yatırım, platform tipi, özellikler tablosu
- Karşılaştırma modu: yan yana broker görünümü
- Filtre: komisyon tipi, platform türü
- Responsive grid layout

### Movers View: Skeleton + Cache
- Veri yüklenirken `Skeleton` bileşenleri gösteriliyor (flickering önlendi)
- `localStorage` cache: `market-movers` key, 5 dakika TTL
- Cache varsa anında yükle, arka planda refresh

### Indicator Service Normalizasyon
- API yanıtı bazen `{ data: [...] }`, bazen direkt `[...]` dönüyordu
- Her iki format normalize edilerek `{ series: [], meta: {} }` yapısına getirildi

### use-dashboard-data Hook
- Dashboard'da kullanılan market verileri (top gainers, losers, volume leaders) tek hook'ta toplandı
- `staleTime: 5 * 60 * 1000` ile agresif cache

---

## Kontrol Listesi

- [ ] `/backtest` → Portfolio curve grafiği doğru tarihler gösteriyor
- [ ] `/backtest` → Sonuçları çalıştır, grafik düzgün render oluyor
- [ ] `/brokers` → Broker listesi açılıyor, detaylar görünüyor
- [ ] `/brokers` → Karşılaştırma butonu çalışıyor
- [ ] `/analysis` → Analiz sayfası hatasız yükleniyor
- [ ] `/markets` → Movers yüklenirken skeleton görünüyor
- [ ] `/markets` → Sayfa ikinci girişte anlık yükleniyor (cache)
- [ ] Dashboard → Widget verileri yükleniyor

---

## Bilinen Sorunlar / Eksikler

- Brokers sayfasında gerçek broker verisi statik; API entegrasyonu planlanmıyor (marketing page)
- Timestamp normalizasyonu sadece backtest için; AI session grafikleri ayrıca kontrol edilmeli
