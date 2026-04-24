# Yahoo Finance Crumb/Cookie Auth — XU100 & XU030 Chart Fix

## Özet

XU100 ve XU030 endeks grafiklerinde Yahoo Finance API'nin döndürdüğü `429 Too Many Requests` / `"Unavailable"` hatası, Yahoo'nun crumb+cookie kimlik doğrulama zorunluluğuna geçmesiyle oluşuyordu. Sunucu tarafında `fc.yahoo.com`'dan cookie alıp ardından crumb token çekerek tüm Yahoo isteklerine bu kimlik bilgisi eklendi.

---

## Değişiklik Listesi

| Dosya | İşlem |
|---|---|
| `frontend/app/api/prices/route.ts` | Değiştirildi — Yahoo crumb/cookie auth eklendi, Twelve Data entegrasyonu eklendi, Stooq CSV fallback eklendi, benchmark fallback zinciri oluşturuldu |
| `frontend/app/api/market-overview/route.ts` | Değiştirildi — Yahoo crumb/cookie auth eklendi, `fetchYahooChart()` helper fonksiyonu oluşturuldu |
| `frontend/services/price.service.ts` | Değiştirildi — Client-side Yahoo kodu (`YAHOO_BENCHMARK_SYMBOLS`, `isYahooBenchmark`, `fetchYahooBenchmarkDirect` vb.) temizlendi, 110 satıra indirildi |
| `frontend/hooks/use-prices.ts` | Revert edildi — `isYahooBenchmark` ternary kaldırıldı, `queryFn` basit forma döndürüldü |
| `frontend/.env.local` | Değiştirildi — `TWELVE_DATA_API_KEY` eklendi |

---

## Teknik Detaylar

### Sorunun Kökü

Yahoo Finance, 2024 sonu itibarıyla anonim API isteklerini agresif biçimde blokluyor. Sunucu ortamında tarayıcı benzeri cookie bulunmadığı için `/v8/finance/chart/XU100.IS` çağrısı doğrudan `429` ile dönüyordu.

### Crumb + Cookie Akışı (`getYahooCrumb()`)

```
1. GET https://fc.yahoo.com
   → HTTP 200/302 + set-cookie başlıkları (A1, A1AN, A3 vb. cookie'ler)

2. GET https://query1.finance.yahoo.com/v1/test/getcrumb
   Headers:
     - Cookie: <adım 1'den toplanan cookie'ler>
     - User-Agent: Chrome/123 benzeri gerçekçi UA
   → 200 + düz metin crumb token (örn: "GyXzvzkUXgC")

3. GET https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS
        ?interval=1d&range=1y&crumb=GyXzvzkUXgC
   Headers:
     - Cookie: <aynı cookie'ler>
     - User-Agent: <aynı UA>
   → 200 + OHLCV JSON
```

### In-Memory Crumb Cache (Module-Level)

Her iki route dosyasında da aynı pattern:

```typescript
let yahooCrumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null
// TTL: 50 dakika
// 401/403 yanıtı gelirse cache null'a sıfırlanır (crumb yenileme tetiklenir)
```

> **Not:** Bu cache Next.js hot reload sonrasında sıfırlanır (module-level). Production'da serverless instance başına bir kez alınır.

### Benchmark Fallback Zinciri (`fetchYahooBenchmarkBars`)

`prices/route.ts`'te XU100/XU030 için 3 kademeli fallback:

```
1. Twelve Data API  → XU100:BIST sembolü (API key: TWELVE_DATA_API_KEY)
   ⚠️  SORUN: Twelve Data bu sembolü desteklemiyor → 404 → fall through

2. Stooq CSV        → xu100.is, xu030.is semboller
   ⚠️  SORUN: Stooq artık API key gerektiriyor → HTML döndürüyor → fall through

3. Yahoo Finance    → XU100.IS, XU030.IS (crumb+cookie ile)
   ✅  ÇALIŞIYOR — crumb başarılı ise veri geliyor
```

Üç kaynak da `unstable_cache` ile sarılmış (1 saatlik `revalidate`).

### API Endpointleri

| Endpoint | Kullanım |
|---|---|
| `https://fc.yahoo.com` | Yahoo cookie alma |
| `https://query1.finance.yahoo.com/v1/test/getcrumb` | Yahoo crumb token alma |
| `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` | OHLCV fiyat barları |
| `https://api.twelvedata.com/time_series` | Twelve Data zaman serisi (opsiyonel) |
| `https://stooq.com/q/d/l/` | Stooq CSV (opsiyonel) |

### Timeframe → Yahoo interval/range Mapping

| Timeframe | interval | range |
|---|---|---|
| 1m | 1m | 5d |
| 5m | 5m | 1mo |
| 15m | 15m | 1mo |
| 30m | 30m | 1mo |
| 1h | 1h | 3mo |
| 1d / 1g | 1d | 1y |
| 1w | 1wk | 2y |
| 1M / 1mo | 1mo | 10y |

---

## Kontrol Listesi

- [ ] Sayfayı aç: `http://localhost:3000`
- [ ] Ana grafik bileşenini bul (büyük fiyat grafiği)
- [ ] Ticker olarak **XU100** seç
- [ ] Grafik "Unavailable" veya "Yahoo rate limited" göstermiyor, veri yüklüyor → ✅
- [ ] **XU030** için aynı testi yap → ✅
- [ ] Farklı timeframe'ler dene: 1g, 1h, 1w, 1M → tümü veri göstermeli
- [ ] Network sekmesinde `/api/prices?ticker=XU100&timeframe=1d` isteğine bak
  - Yanıt `meta.source` değeri `"live"` veya `"cache"` olmalı
  - `meta.hasUsableData: true` olmalı
- [ ] Dev server'ı yeniden başlatıp (hot reload), 2-3 dakika bekle
  - Crumb cache sıfırlanır, ilk istekte yeniden alınır → grafik yine çalışmalı

---

## Bilinen Sorunlar / Eksikler

| Sorun | Açıklama |
|---|---|
| **Crumb hot reload'da sıfırlanır** | Module-level cache Next.js hot reload'da kaybolur. Production'da sorun yok ama dev'de her restart'ta 1 kez yeniden crumb alınır (~2sn gecikme) |
| **Twelve Data XU100 desteklemiyor** | `XU100:BIST` sembolü Twelve Data'da yok. API key hazır (`TWELVE_DATA_API_KEY`), Twelve Data'nın sembol listesinde BIST 100 endeksi bulunursa aktive edilebilir |
| **Stooq API key gerektiriyor** | `stooq.com` artık captcha-tabanlı API key istiyor. Stooq fallback kodu mevcut ama çalışmıyor |
| **Yahoo ToS riski** | Crumb/cookie yöntemi resmi olmayan bir yaklaşım. Yahoo herhangi bir anda kimlik doğrulama mekanizmasını değiştirebilir |
