# Market Surfaces Prod Readiness

## Özet
Dashboard, market detail, market list/screener ve watchlist yüzeyleri için veri akışı `stale-first` olacak şekilde güçlendirildi. Backend warming, timeout, kısmi veri ve geçici kesinti durumlarında ekranların boş veya sert hata durumuna düşmesi yerine son kullanılabilir veri korunup kompakt durum bilgisi gösterilir hale getirildi.

## Değişiklik Listesi
- `frontend/app/api/prices/route.ts`
- `frontend/app/api/prices/batch/route.ts`
- `frontend/lib/server/bist-market-list.ts`
- `frontend/hooks/use-prices.ts`
- `frontend/hooks/use-dashboard-data.ts`
- `frontend/hooks/use-market-list.ts`
- `frontend/lib/market-data.ts`
- `frontend/components/market-data-status-chip.tsx`
- `frontend/features/dashboard/main-chart.tsx`
- `frontend/features/dashboard/top-movers.tsx`
- `frontend/features/dashboard/market-summary.tsx`
- `frontend/features/dashboard/live-watchlist.tsx`
- `frontend/features/watchlist/watchlist-view.tsx`
- `frontend/features/markets/ticker-view.tsx`
- `frontend/features/markets/markets-view.tsx`
- `frontend/features/screener/screener-view.tsx`
- `frontend/components/dashboard/watchlist-widget.tsx`
- Build temizliği için küçük tip düzeltmeleri:
  `frontend/features/analysis/analysis-view.tsx`,
  `frontend/features/backtest/backtest-view.tsx`,
  `frontend/features/llm/llm-view.tsx`,
  `frontend/lib/server/evalon-proxy.ts`,
  `frontend/types/index.ts`,
  `frontend/services/price.service.ts`

## Teknik Detaylar
- `/api/prices`, `/api/prices/batch` ve `/api/markets/list` cevaplarına opsiyonel `meta` alanı eklendi.
- `meta` içinde şu alanlar standartlaştırıldı:
  `stale`, `warming`, `partial`, `hasUsableData`, `source`, `snapshotAgeMs`, `failedTickers`, `message`, `emptyReason`.
- Tekil fiyat proxy’sine in-memory cache, in-flight dedupe, timeout ve stale cache fallback eklendi.
- Batch fiyat proxy’si artık tam canlı veri, kısmi veri ve stale-cache karışımını ayırt ediyor.
- Market snapshot tarafı warming ile gerçek hata durumunu ayrıştırıyor; artık boş liste ile backend sorunu aynı şekilde dönmüyor.
- Hook katmanında ortak status shape üretildi:
  `hasUsableData`, `isInitialLoading`, `isBackgroundRefreshing`, `isDegraded`, `isPartial`, `isWarming`, `retryNow`.
- `usePrices` ve `useMarketList` için `keepPreviousData` davranışı eklendi; ticker/timeframe/sort değişimlerinde önceki veri ekranda kalıyor.
- Dashboard ve market yüzeylerine reusable `MarketDataStatusChip` eklendi.
- Watchlist ekranı fiyat göstergesi için daha dayanıklı batch quote akışına taşındı; geçici başarısızlıklarda `0.00` gibi yanlış değerlerin görünmesi engellendi.

## Kontrol Listesi (Checklist)
1. `/` dashboard açılışında backend yavaş olsa bile chart ve movers alanlarının yanlışlıkla “No data available” göstermediğini doğrulayın.
2. Dashboard chart’ta timeframe değiştirirken eski serinin kaybolmadan kaldığını ve sağ üstte kısa süreli yenilenme durumu göründüğünü kontrol edin.
3. `/markets/THYAO` sayfasında chart verisi varsa indicator panel hatasının tüm ekranı düşürmediğini kontrol edin.
4. `/markets/THYAO` üzerinde geçersiz/verisiz timeframe kombinasyonlarında generic backend hatası yerine domain-specific boş durum mesajı göründüğünü kontrol edin.
5. `/markets` ve `/screener` sayfalarında sort veya refresh sırasında önceki listenin korunup kompakt durum etiketi gösterildiğini doğrulayın.
6. `/watchlist` ekranında batch quote verisi gecikse bile yanlış `0.00` fiyatlar yerine loading, retry veya stale durumlarının gösterildiğini kontrol edin.
7. Market backend erişimi yavaşlatıldığında stale veri varsa “gecikmeli / yenileniyor” etiketi, veri yoksa retry CTA çıktığını manuel olarak teyit edin.
8. `frontend` dizininde `npm run build` komutunun geçtiğini doğrulayın.
9. `frontend` dizininde `npm run lint` komutunu çalıştırın; mevcut repoda bu komut plan dışı eski lint borçları nedeniyle halen kırmızı döner.

## Bilinen Sorunlar / Eksikler
- `npm run lint` bu çalışma özelinde değil, repoda mevcut olan çok sayıda eski lint ihlali nedeniyle halen başarısız.
- Next.js build sırasında workspace root için çoklu `package-lock.json` uyarısı veriliyor; build’i engellemiyor ama ileride `turbopack.root` ile netleştirilmesi iyi olur.
- Stale cache fallback in-memory olduğu için server process restart sonrasında son başarılı veri korunmaz.
- Bu çalışma backend davranışını değiştirmez; backend’in gerçekten hiç veri üretmediği durumlarda kullanıcıya daha iyi durum gösterimi sağlanır ama veri uydurulmaz.
