# Evalon Prices API (v1)

**Belge Türü:** Teknik API Referansı  
**Belge Adı:** `evalon-prices-api-v1.md`  
**Sürüm:** 1.0  
**Son Güncelleme:** 2026-04-06

## 1) Kapsam
Bu doküman, dış fiyat API'sinin `/v1/prices` endpoint sözleşmesini, örnek kullanımını ve projede doğrulanmış veri dönen BIST ticker listesini içerir.

- **Base URL:** `https://evalon-mu.vercel.app`
- **Ana endpoint:** `GET /v1/prices`

## 2) Endpoint Sözleşmesi

### GET /v1/prices
Tek bir ticker için OHLCV bar verisi döner.

### Query Parametreleri
| Parametre | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `ticker` | string | Evet | Enstrüman kodu (ör. `THYAO`) |
| `timeframe` | string | Evet | `1m`, `5m`, `15m`, `1h`, `1d`, `1w`, `1M` |
| `start` | string (ISO) | Hayır | Başlangıç zamanı: `YYYY-MM-DDTHH:MM:SS` |
| `end` | string (ISO) | Hayır | Bitiş zamanı: `YYYY-MM-DDTHH:MM:SS` |
| `limit` | integer | Hayır | Döndürülecek bar üst limiti. Doküman notuna göre: `1..200000` |

## 3) Kullanım Örnekleri

### 1 dakikalık veri (1m)
Son N bar:
```http
GET /v1/prices?ticker=THYAO&timeframe=1m&limit=1000
```

Belirli aralık:
```http
GET /v1/prices?ticker=THYAO&timeframe=1m&start=2026-01-21T10:00:00&end=2026-01-21T18:00:00
```

### Timeframe bazlı veri
5 dakika (son N bar):
```http
GET /v1/prices?ticker=THYAO&timeframe=5m&limit=500
```

1 saat (aralık):
```http
GET /v1/prices?ticker=THYAO&timeframe=1h&start=2026-01-01T09:00:00&end=2026-01-10T18:00:00
```

Günlük:
```http
GET /v1/prices?ticker=THYAO&timeframe=1d&limit=2000
```

Haftalık:
```http
GET /v1/prices?ticker=THYAO&timeframe=1w&limit=500
```

Aylık:
```http
GET /v1/prices?ticker=THYAO&timeframe=1M&limit=240
```

## 4) Yanıt Formatı

JSON yanıt şeması:
```json
{
  "ticker": "THYAO",
  "timeframe": "1d",
  "rows": 2,
  "data": [
    { "t": "2026-04-02T00:00:00", "o": 289.4, "h": 292.1, "l": 286.8, "c": 291.3, "v": 1234567 }
  ]
}
```

Alanlar:
- `t`: zaman damgası (ISO)
- `o`: open
- `h`: high
- `l`: low
- `c`: close
- `v`: volume

## 5) Uygulama Entegrasyon Notları (Bu Repo)
Bu projede dış API doğrudan değil, çoğunlukla local proxy üzerinden kullanılır:

- `GET /api/prices`: tek ticker proxy
- `GET /api/prices/batch`: çoklu ticker proxy

Ek bilgi:
- Varsayılan dış API URL’si: `NEXT_PUBLIC_EVALON_API_URL` yoksa `https://evalon-mu.vercel.app`
- Proxy katmanı, son veriyi daha güvenli almak için `start` ve `fetchLimit` değerlerini zaman dilimine göre akıllı hesaplar.

## 6) Verisi Olan Hisseler (BIST)
Aşağıdaki liste, projedeki doğrulanmış `BIST_AVAILABLE` kaynağından alınmıştır.

- **Doğrulanan veri tarihi:** 2026-03-17
- **Toplam ticker:** 127
- **Kaynak:** `config/markets.ts` → `BIST_AVAILABLE`

```
AEFES, AGHOL, AGROT, AHGAZ, AKBNK, AKCNS, AKENR, AKFGY, AKSA, AKSEN, ALARK, ALFAS
ALGYO, ALTNY, ANSGR, ARCLK, ARDYZ, ASELS, ASTOR, BAGFS, BALSU, BIMAS, BIZIM, BRSAN
BRYAT, BSOKE, BTCIM, CANTE, CCOLA, CIMSA, CLEBI, CWENE, DAPGM, DEVA, DOAS, DOHOL
DSTKF, ECILC, EFOR, EGEEN, EKGYO, ENERY, ENJSA, ENKAI, ERCB, EREGL, EUPWR, FENER
FROTO, GARAN, GENIL, GESAN, GLRMK, GRSEL, GRTHO, GSRAY, GUBRF, GWIND, HALKB, HEKTS
ISCTR, ISGYO, ISMEN, IZENR, IZFAS, IZMDC, KAREL, KCAER, KCHOL, KLRHO, KONTR, KRDMD
KTLEV, KUYAS, LOGO, MAGEN, MAVI, MGROS, MIATK, MPARK, NETAS, OBAMS, ODAS, OTKAR
OYAKC, PASEU, PATEK, PETKM, PETUN, PGSUS, PNSUT, PRKME, QUAGR, RALYH, REEDR, SAHOL
SASA, SELEC, SISE, SKBNK, SOKM, TABGD, TAVHL, TCELL, THYAO, TKFEN, TMSN, TOASO
TRALT, TRENJ, TRMET, TSKB, TSPOR, TTKOM, TTRAK, TUKAS, TUPRS, TUREX, TURSG, ULKER
VAKBN, VESBE, VESTL, YEOTK, YKBNK, ZEDUR, ZOREN
```

## 7) Operasyonel Notlar
- `start/end` ISO formatı saniye hassasiyetinde kullanılmalıdır (ör. `2026-01-21T10:00:00`).
- `limit` verilmediğinde servis default davranışı uygulanır.
- Veri boş dönebilir (ör. ilgili tarih/market için bar yoksa). Bu durumda istemci tarafında boş dizi senaryosu handle edilmelidir.
