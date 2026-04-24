# Haber Infinite Scroll, Candlestick Chart, Kripto Fiyat Entegrasyonu

**Commit:** `763fdd4`  
**Branch:** `feature/improvements`  
**Tarih:** 2026-04-25

---

## Özet

News sayfasına infinite scroll ve gelişmiş loading state eklendi. Yeni `CandlestickChart` bileşeni `lightweight-charts` kütüphanesiyle oluşturuldu. Fiyat API'sine kripto desteği ve Yahoo Finance fallback mekanizması eklendi. Backend `main.py`'de minor iyileştirmeler yapıldı.

---

## Değişiklik Listesi

### Yeni Eklenen Dosyalar
| Dosya | Açıklama |
|---|---|
| `frontend/components/candlestick-chart.tsx` | TradingView lightweight-charts tabanlı mum grafik bileşeni (112 satır) |
| `scrapers/news_scraper/check2.py` | Oracle DB tablo kontrol scripti (29 satır) |

### Güncellenen Dosyalar
| Dosya | Değişiklik |
|---|---|
| `frontend/features/news/news-view.tsx` | Infinite scroll, gelişmiş loading states (+242 satır) |
| `frontend/features/markets/ticker-view.tsx` | Candlestick chart entegrasyonu, ticker detay düzenlemesi |
| `frontend/app/api/prices/route.ts` | Kripto fiyat desteği, Yahoo Finance fallback (+31 satır) |
| `frontend/lib/evalon.ts` | Yardımcı fonksiyon eklendi (+3 satır) |
| `frontend/package.json` | `lightweight-charts` bağımlılığı eklendi |
| `frontend/package-lock.json` | Lock dosyası güncellendi |
| `backend/backtest/api/main.py` | Minor iyileştirmeler (+32 satır) |
| `backend/backtest/data_clients/bist_prices_1h_client.py` | 1h veri istemcisi düzeltmesi |
| `backend/graph/apps/chart-client/src/main.ts` | Chart client güncelleme |

---

## Teknik Detaylar

### Yeni Bağımlılık: lightweight-charts
```json
"lightweight-charts": "^5.x"
```
- TradingView'ın açık kaynak grafik kütüphanesi
- `CandlestickChart` bileşeninde kullanılıyor
- OHLCV verisini `{ time, open, high, low, close }` formatında alıyor

### CandlestickChart Bileşeni (`frontend/components/candlestick-chart.tsx`)
- `useRef` ile DOM mount, `useEffect` ile chart init
- `resizeObserver` ile responsive boyutlandırma
- Dark tema desteği (Evalon renk paleti)
- Props: `data: OHLCVBar[]`, `height?: number`, `className?: string`
- Cleanup: component unmount'ta chart dispose edilir (memory leak yok)

### News View: Infinite Scroll
- `useIntersectionObserver` ile son kart görüntülenince otomatik yükleme
- `hasNextPage` / `fetchNextPage` (React Query `useInfiniteQuery`)
- Loading state: skeleton kartlar gösteriliyor
- Error state: yeniden dene butonu
- `staleTime: 2 * 60 * 1000`

### Fiyat API Kripto + Yahoo Finance Fallback (`frontend/app/api/prices/route.ts`)
Öncelik sırası:
1. Evalon backend (`NEXT_PUBLIC_EVALON_API_URL`)
2. TwelveData (kripto semboller için: `BTC/USD`, `ETH/USD` formatı)
3. Yahoo Finance fallback (`^GSPC`, `BTC-USD` formatı)

Ticker normalizasyonu güncellendi:
- Alt çizgi `_` karakterine izin verildi (örn: `BTC_USD`)
- `/` → `_` dönüşümü düzelttildi

### Backend main.py Güncellemeleri
- Screener router eklendi: `app.include_router(create_screener_router(price_client=client))`
- `GET /v1/screener/tickers` ve `POST /v1/screener/scan` endpoint'leri aktif
- 1h fiyat veri istemcisinde timeout sorunu giderildi

### Oracle Scraper Kontrol Scripti (`scrapers/news_scraper/check2.py`)
- Oracle DB'deki haber tablolarını listeler
- Tablo satır sayılarını ve son kayıt tarihini gösterir
- Kullanım: `python check2.py`

---

## API Endpoint Değişiklikleri

### Backend (evalon-backtest-api)
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /v1/screener/tickers` | **YENİ** | 340 BIST hissesi + sektör bilgisi |
| `POST /v1/screener/scan` | **YENİ** | Teknik filtre taraması, 120s timeout |

### Frontend API Routes
| Route | Değişiklik |
|---|---|
| `GET /api/prices?ticker=BTC&timeframe=1d` | Kripto ticker desteği eklendi |
| `POST /api/screener/scan` | Yeni proxy route (önceki session'da eklenmişti) |
| `GET /api/screener/tickers` | Yeni proxy route |

---

## Kontrol Listesi

- [ ] `/news` → Sayfa aşağı kaydırınca yeni haberler yükleniyor
- [ ] `/news` → Yüklenirken skeleton kartlar görünüyor
- [ ] `/markets/[ticker]` → Mum grafik render oluyor
- [ ] `/markets/BTC` veya kripto ticker → Fiyat verisi geliyor
- [ ] `/screener` → Tickers endpoint çağrısı başarılı (340 hisse)
- [ ] `/screener` → Scan çalıştır → sonuçlar geliyor
- [ ] Backend `/docs` → screener endpoint'leri listede görünüyor

---

## Bilinen Sorunlar / Eksikler

- `lightweight-charts` SSR uyumlu değil; `dynamic(() => import(...), { ssr: false })` ile kullanılmalı (bileşen bunu handle ediyor)
- Kripto fiyat gecikmesi ~15 dakika (Yahoo Finance free tier)
- Oracle scraper: bağlantı bilgileri `.env` üzerinden alınmalı, hardcode edilmemeli
