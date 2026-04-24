# Screener API Proxy Düzeltmeleri ve Compile Error Fix

## Özet
`price.service.ts`'deki duplicate `const` tanımı tüm Next.js API route'larını çökertiyor ve 404 döndürüyordu. Sorun düzeltildi ve screener proxy route'ları ayrı bir backend URL'ini destekleyecek şekilde güncellendi.

## Değişiklik Listesi

| Dosya | İşlem |
|---|---|
| `frontend/services/price.service.ts` | `YAHOO_BENCHMARK_SYMBOLS` const'u ikinci kez (184-256. satırlar) tanımlanmış halde bulundu ve kaldırıldı |
| `frontend/lib/server/evalon-proxy.ts` | `ProxyOptions` ve `JsonProxyOptions` interface'lerine `baseUrl?: string` eklendi; `buildEvalonUrl` ve `fetchEvalonJson` bunu kullanacak şekilde güncellendi |
| `frontend/app/api/screener/scan/route.ts` | `EVALON_SCREENER_API_URL` env var okunuyor, `proxyEvalonJson`'a `baseUrl` olarak geçiliyor |
| `frontend/app/api/screener/tickers/route.ts` | Aynı `EVALON_SCREENER_API_URL` env var desteği eklendi |
| `frontend/.env.local` | `EVALON_SCREENER_API_URL` satırı **kaldırıldı** — production'da Cloud Run'a fallback yapıyor |

## Teknik Detaylar

**Root Cause:**  
Turbopack, `price.service.ts` dosyasında aynı `const YAHOO_BENCHMARK_SYMBOLS` iki kez tanımlanmış olduğu için derlemeyi durduruyordu. Bu, sadece bu dosyayı değil **tüm API route'larını** 404 yapıyordu (Next.js app çökünce health dışındakiler de yanıt veremez hale geliyordu).

**Proxy baseUrl Mekanizması:**  
```
EVALON_SCREENER_API_URL   →  screener route'larının hedefi
  tanımlıysa              →  lokal FastAPI veya ayrı bir servis
  tanımlı değilse         →  NEXT_PUBLIC_EVALON_API_URL (Cloud Run) kullanılır
```

**API Endpointleri:**
- `GET  /api/screener/tickers` → `/v1/screener/tickers`
- `POST /api/screener/scan`    → `/v1/screener/scan`

**Deploy Notu:**  
Backend (Cloud Run) screener endpoint'lerini içeren yeni imajla deploy edilince `EVALON_SCREENER_API_URL` env var'ı tanımlanmadan otomatik çalışır.

## Kontrol Listesi

- [ ] Screener sayfasını aç → sağ üstte tickers yükleniyor mu?
- [ ] Filtre ekle (örn: RSI Overbought quick chip) → Scan'e bas → sonuçlar geliyor mu?
- [ ] Boş filtre ile scan → tüm hisse listesi dönüyor mu?
- [ ] Sektor seçip scan → sadece o sektörden hisseler geliyor mu?
- [ ] `/api/health` → `{"status":"ok"}` dönüyor mu?

## Bilinen Sorunlar / Eksikler

- Screener backend Cloud Run'a henüz deploy edilmedi (main branch'e merge bekleniyor).
- Deploy sonrası `EVALON_SCREENER_API_URL` env var'ına gerek kalmayacak.
