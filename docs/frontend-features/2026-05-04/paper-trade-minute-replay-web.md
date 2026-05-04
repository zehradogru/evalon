# Özet

Bu rapor, web tarafındaki `paper-trade` simulatorunun günlük replay mantığından dakika bazlı historical replay mantığına nasıl geçirildiğini ve bu akışın bugün nasıl çalıştığını açıklar. Özellikle önceki sürümde görülen "hisse seçince grafik gelmemesi" ve `+1 dk` sonrası `28 Nisan 2026` gibi ileri bir tarihe sıçrama problemi, state yönetimi ile chart besleme modelinin ayrıştırılmasıyla çözülmüştür.

# Değişiklik Listesi

Değiştirilen dosyalar:

- `frontend/types/simulator.ts`
- `frontend/store/use-simulator-store.ts`
- `frontend/features/paper-trade/simulator-setup-panel.tsx`
- `frontend/features/paper-trade/simulator-game-panel.tsx`
- `frontend/features/paper-trade/simulator-chart.tsx`
- `frontend/features/paper-trade/simulator-order-panel.tsx`
- `frontend/features/paper-trade/simulator-results.tsx`
- `frontend/services/price.service.ts`

Referans alınan mevcut mobil implementasyon:

- `mobile/androidApp/src/main/java/com/evalon/android/chart/StockChartScreen.kt`
- `mobile/androidApp/src/main/java/com/evalon/android/chart/StockChartWebView.kt`
- `mobile/androidApp/src/main/assets/chart.html`

Kullanılan mevcut web chart bileşeni:

- `frontend/components/candlestick-chart.tsx`

# Teknik Detaylar

## 1. Önceki problem neydi?

Eski web simulator mantığında ilerleme (`advanceDay` veya önceki dakika denemelerinde timeline bazlı ilerleme) cache içindeki mevcut mum zamanlarına göre yapılıyordu. Bunun iki kötü sonucu vardı:

- Simulator saati kendi başına deterministik ilerlemiyordu.
- Cache içine preload edilen veya sonradan gelen başka hisselerin mum zamanları global zaman çizelgesini etkileyebiliyordu.

Bu yüzden kullanıcı örneğin `23 Ocak 2026` üzerinde iken:

- seçili hissede henüz o ana ait görünür mum olmayabiliyordu,
- ama cache’te başka hisseden veya range’in geç kısmından gelen daha ileri timestamp’ler bulunabiliyordu,
- `+1 dk` aksiyonu da "gerçekten 1 dakika ilerle" yerine "cache’teki bir sonraki uygun timestamp’e git" gibi davranabiliyordu.

Sonuç olarak simulator saati `28 Nisan 2026 09:55` gibi alakasız bir tarihe sıçrayabiliyordu.

## 2. Yeni state modeli

`frontend/types/simulator.ts` içinde simulator state artık gün bazlı değil zaman bazlı tanımlanır:

- `config.startAt`
- `config.endAt`
- `currentTime`
- `currentStepIndex`
- `totalSteps`
- `advanceTime(minutes)`

Bu değişiklikle simulatorun iç saati artık veri cache’inden türetilmez. Saat, `startAt` ile `endAt` arasındaki gerçek dakika farkına göre ilerler.

## 3. Store mantığı

`frontend/store/use-simulator-store.ts` içindeki temel yardımcılar:

- `getTimeMs(value)`: tarih stringini milisaniyeye çevirir.
- `formatLocalDateTime(date)`: simulator state için `YYYY-MM-DDTHH:mm` formatı üretir.
- `getSimulationStepCount(startAt, endAt)`: toplam dakika sayısını hesaplar.
- `getSimulationStepIndex(startAt, currentTime, endAt)`: mevcut dakikanın indexini üretir.
- `advanceSimulationClock(currentTime, endAt, minutes)`: saati maksimum `endAt` olacak şekilde ileri taşır.
- `findBarForTime(bars, targetTime)`: seçili hisse için `targetTime` anına kadar oluşmuş son mumu bulur.

Yeni yaklaşım:

1. Simulator başlatılınca `currentTime = startAt` olur.
2. `advanceTime(1)` çağrısı her zaman `currentTime + 1 dakika` mantığıyla çalışır.
3. Pozisyonların güncel fiyatı, sadece seçili an için o ticker’ın son uygun mumu ile güncellenir.
4. `portfolioSnapshots` artık gün değil dakika bazlı tutulur.

Bu sayede preload edilen veya sonradan fetch edilen başka ticker verileri, simulatorun saatini artık bozamaz.

## 4. Setup ekranı

`frontend/features/paper-trade/simulator-setup-panel.tsx` artık:

- `date` yerine `datetime-local` kullanır,
- minimum 1 dakikalık veri başlangıcını `2026-01-21T09:55` ile sınırlar,
- kullanıcıya hazır preset aralıklar sunar,
- simulatoru `startAt/endAt` ile başlatır.

Bu limitin sebebi, Oracle coverage kontrolünde 127 ticker için 1 dakikalık veri başlangıcının `2026-01-21 09:55:00` olduğunun doğrulanmış olmasıdır.

## 5. Veri fetch akışı

`frontend/services/price.service.ts` artık `end` parametresini de `/api/prices` isteğine taşır.

İstek akışı:

1. `simulator-game-panel.tsx` içinden `fetchPrices(...)` çağrılır.
2. İstek `frontend/app/api/prices/route.ts` üstünden geçer.
3. Bu proxy, backend `GET /v1/prices` endpoint’ine yönlenir.
4. `ticker`, `timeframe=1m`, `start`, `end`, `limit` birlikte gönderilir.

Kullanılan kritik yardımcılar:

- `getSimulationFetchLimit(startAt, endAt)`
  Amaç:
  seçilen range’in dakika genişliğine göre yeterli ama kontrollü bir `limit` üretmek.

- `normalizeSimulationBars(bars, startAt, endAt)`
  Amaç:
  gelen veriyi sadece simulator aralığında tutmak, duplicate timestamp’leri temizlemek ve ascending sıraya koymak.

Bu adım mobildeki "hazır candle datasını chart’a ver" mantığının web karşılığıdır. Mobilde `ChartDataMapper -> WebView -> updateChartData(...)` zinciri varken, webde `fetchPrices -> normalizeSimulationBars -> CandlestickChart` zinciri kullanılır.

## 6. Chart render mantığı

`frontend/features/paper-trade/simulator-chart.tsx` artık `recharts` tabanlı alan grafiği yerine mevcut `frontend/components/candlestick-chart.tsx` bileşenini kullanır.

Bu değişiklik özellikle mobil referansına yakındır çünkü:

- chart doğrudan candle listesi ile beslenir,
- chart kendi içinde candlestick render eder,
- visible subset dışarıda hazırlanır, chart içi state minimum tutulur.

Chart bileşeni üç net durum gösterir:

1. `ticker` seçilmemişse boş state
2. veri hâlâ yükleniyorsa loading state
3. seçili ana kadar mum yoksa no-data state

Veri varsa:

- `visibleChartData = priceCache[chartTicker].filter(bar.t <= currentTime)`
- bu liste doğrudan `CandlestickChart` bileşenine verilir

Bu sayede chart, simulatorun saatine kadar oluşmuş gerçek 1 dakikalık mumları gösterir.

## 7. Ticker seçimi ve preload davranışı

`frontend/features/paper-trade/simulator-game-panel.tsx` iki aşamalı veri yükler:

### Başlangıç preload

- `BIST_POPULAR.slice(0, 8)` ile ilk 8 popüler ticker preload edilir
- bu preload sadece kullanıcı ilk ekranı boş görmesin diye yapılır
- preload verisi artık simulator saatini etkilemez

### Sonradan ticker seçimi

- kullanıcı bir ticker seçince `loadTickerData(ticker)` çağrılır
- eğer cache’te yoksa `1m` veri çekilir
- fetch bitene kadar `loadingTicker` state’i tutulur
- veri geldikten sonra `priceCache[ticker]` içine yazılır

Bu yapı sayesinde "hisse seçince grafik yok ama +1 dk basınca geliyor" davranışı büyük ölçüde render/fetch yarışından çıkarılıp kontrollü hale getirilmiştir.

## 8. Emir paneli ve sonuç ekranı

`frontend/features/paper-trade/simulator-order-panel.tsx` artık fiyat etiketini `currentTime` üzerinden gösterir:

- tarih
- saat
- dakika
- ilgili mum kapanışı

`frontend/features/paper-trade/simulator-results.tsx` ise yeni config alanlarına (`startAt/endAt`) bağlanmıştır.

## 9. Mobil implementasyonla paralellik

Mobil tarafta akış kabaca şöyledir:

1. API’den candle listesi alınır
2. `ChartDataMapper` ile chart formatına çevrilir
3. `StockChartWebView` içine gönderilir
4. `chart.html` içindeki `updateChartData(...)` fonksiyonu ile chart render edilir

Web tarafındaki yeni akış bununla mantıksal olarak aynıdır:

1. API’den candle listesi alınır
2. `normalizeSimulationBars(...)` ile chart için temizlenir
3. `visibleChartData` ile seçili ana kadar kırpılır
4. `CandlestickChart` içine doğrudan verilir

Yani web tarafı artık "global cache zaman çizelgesine göre simülasyon yürüt" yerine "zamanı bağımsız yönet, chart’a sadece seçili ticker’ın uygun mumlarını ver" modelini kullanır. Bu, mobildeki veri-akış odaklı yaklaşımın web karşılığıdır.

# Kontrol Listesi (Checklist)

1. `/paper-trade` ekranını aç.
2. Setup ekranında başlangıcı `2026-01-21T09:55` veya sonrası bir zamana ayarla.
3. Bitiş zamanını birkaç gün veya birkaç hafta sonrasına ayarla.
4. Simulasyonu başlat.
5. Preload içindeki bir ticker seç ve chart’ın gelmesini kontrol et.
6. Preload dışında bir ticker seç ve loading sonrası chart’ın gelmesini kontrol et.
7. `+1 Dk` butonuna bas ve simulator saatinin tam 1 dakika ilerlediğini doğrula.
8. `+1 Dk` sonrası tarihin alakasız biçimde `28 Nisan 2026` gibi ileri bir güne sıçramadığını doğrula.
9. `+5 Dk`, `+30 Dk`, `+3 Saat`, `+1 Gun`, `+1 Hafta` butonlarını test et.
10. Seçili anda veri olmayan bir hissede no-data mesajının göründüğünü doğrula.
11. Veri geldikten sonra chart’ın candlestick olarak render edildiğini doğrula.
12. Emir panelindeki fiyat bilgisinin gün değil dakika bazlı zamanı gösterdiğini kontrol et.
13. Bir alım ve bir satım işlemi yaparak `tradeHistory` ve `portfolioSnapshots` akışını kontrol et.
14. Simulasyonu bitir ve sonuç ekranında `startAt/endAt` özetinin doğru geldiğini doğrula.
15. Sayfayı yenile ve persist sonrası simulator state’inin bozulmadığını, fakat `priceCache`’in yeniden fetch edildiğini kontrol et.

# Bilinen Sorunlar / Eksikler

- Çok uzun 1 dakikalık aralıklar ileride `200_000` limitini aşarsa, frontend tarafında chunk’lı fetch gerekebilir. Şu anki yapı seçilen range için tek istek mantığıyla çalışır.
- `priceCache` persist edilmez. Bu bilinçli bir tercih olsa da sayfa yenilemelerinde veriler yeniden çekilir.
- Seçili anda ilgili ticker için henüz oluşmuş mum yoksa chart boş değil, no-data state gösterir. Bu beklenen davranıştır; bug değildir.
- Bu rapor web simulator akışını açıklar. Fullscreen webview chart entegrasyonu ayrı bir akıştır ve bu dokümanın ana kapsamı değildir.
