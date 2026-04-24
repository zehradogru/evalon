# Oracle BIST_NEWS → Frontend News Entegrasyonu

## Özet

Frontend news sayfası mock verilerden arındırıldı; Oracle ADW'deki `BIST_NEWS` tablosunu sorgulayan yeni bir FastAPI endpoint (`/v1/news`) yazıldı ve Next.js proxy pattern ile frontend'e bağlandı.

---

## Değişiklik Listesi

| Dosya | İşlem |
|---|---|
| `backend/backtest/api/main.py` | Değiştirildi — `/v1/news` GET endpoint eklendi (`NewsItem`, `NewsResponse` Pydantic modelleri ile) |
| `frontend/app/api/news/route.ts` | Oluşturuldu — Next.js API route, `/v1/news` proxy'si |
| `frontend/types/news.ts` | Oluşturuldu — `NewsItem`, `NewsResponse` TypeScript interface'leri |
| `frontend/services/news.service.ts` | Oluşturuldu — `fetchNews(params)` client-side servis fonksiyonu |
| `frontend/features/news/news-view.tsx` | Değiştirildi — Hardcoded mock veriler kaldırıldı, `useEffect` + `fetchNews` ile gerçek veri çekimi eklendi |
| `frontend/.env.local` | Değiştirildi — Oracle env var'ları eklendi (`ORACLE_DB_USER`, `ORACLE_DB_PASSWORD`, `ORACLE_DB_DSN`, `ORACLE_WALLET_DIR`, `ORACLE_WALLET_PASSWORD`) |
| `frontend/package.json` | Değiştirildi — `oracledb` npm paketi eklendi |

---

## Teknik Detaylar

### Backend — `/v1/news` Endpoint

```
GET /v1/news
  ?symbol=GARAN        # opsiyonel, Oracle BIST_NEWS.SYMBOL filtresi
  ?sentiment=OLUMLU    # opsiyonel, NÖTR / OLUMLU / OLUMSUZ
  ?q=faiz              # opsiyonel, TITLE/SUMMARY LIKE arama
  ?limit=20            # 1–100 arası, varsayılan 20
  ?page=1              # sayfalama
```

- Oracle ADW `BIST_NEWS` tablosunu sorgular.
- Tüm filtreler bind parametreli → SQL Injection koruması sağlanmıştır.
- Yanıt: `{ items: NewsItem[], total: int, page: int, limit: int }`

### Frontend — Proxy Pattern

```
Kullanıcı → /api/news → proxyEvalonJson({ pathname: '/v1/news' }) → Cloud Run /v1/news
```

- `proxyEvalonJson` (`lib/server/evalon-proxy.ts`) mevcut proxy mekanizması kullanıldı.
- `NEXT_PUBLIC_EVALON_API_URL` env var'ı ile Cloud Run URL'i belirtilir.

### Oracle Tablo Şeması (Kullanılan Sütunlar)

| Sütun | Tip | Açıklama |
|---|---|---|
| `ID` | NUMBER | Primary key |
| `SYMBOL` | VARCHAR2 | Hisse senedi sembolü |
| `NEWS_SOURCE` | VARCHAR2 | Kaynak (Borsa İstanbul, vs.) |
| `TITLE` | VARCHAR2 | Haber başlığı |
| `SUMMARY` | CLOB | Özet |
| `SENTIMENT` | VARCHAR2 | NÖTR / OLUMLU / OLUMSUZ / BEKLIYOR |
| `SENTIMENT_SCORE` | FLOAT | Güven skoru |
| `NEWS_URL` | VARCHAR2 | Kaynak link |
| `AUTHOR` | VARCHAR2 | Yazar |
| `PUBLISHED_AT` | TIMESTAMP | Yayın tarihi |

### news-view.tsx Değişiklikleri

- `useState<NewsItem[]>([])` — gerçek veri state'i
- `searchQ` state + debounce — arama filtresi
- `loading` / `error` durumları gösterilir
- "Open Source" butonu → `<a href={item.news_url} target="_blank">`
- `symbol`, `sentiment`, gerçek `published_at` gösterilir

---

## Kontrol Listesi

- [ ] Backend local test: `cd backend/backtest && uvicorn api.main:app --reload --port 8000`
- [ ] `GET http://localhost:8000/v1/news` → `items`, `total`, `page`, `limit` döndüğünü doğrula
- [ ] `GET http://localhost:8000/v1/news?symbol=GARAN&limit=5` → sadece GARAN haberleri geldiğini doğrula
- [ ] `GET http://localhost:8000/v1/news?sentiment=OLUMLU` → filtre çalıştığını doğrula
- [ ] Frontend: `NEXT_PUBLIC_EVALON_API_URL=http://localhost:8000` yapıp `npm run dev` ile test et
- [ ] News sayfasında haberler yüklendiğini ve haber kartlarında `symbol`, `sentiment`, `published_at` göründüğünü doğrula
- [ ] "Open Source" butonunun `news_url` ile doğru linke gittiğini kontrol et
- [ ] **Cloud Run deploy**: `python scripts/deploy_backend.py` — yeni endpoint production'a almak için zorunlu
- [ ] Deploy sonrası production URL ile `/v1/news` test et

---

## Bilinen Sorunlar / Eksikler

- **Cloud Run deploy henüz yapılmadı.** Backend endpoint lokal çalışıyor; production'da görünmesi için deploy gerekiyor.
- `ORACLE_WALLET_DIR` frontend `.env.local`'a eklendi ancak frontend proxy pattern kullandığından bu env var'lar şu an aktif değil. Backend tarafında wallet zaten konfigüre.
- `BIST_NEWS.SENTIMENT` sütunu çoğu satırda `'BEKLIYOR'` — v4 BERT modeli eğitildikten sonra toplu güncelleme yapılacak.
- `oracledb` npm paketi kuruldu fakat frontend'de doğrudan kullanılmıyor (proxy pattern tercih edildi); kaldırılabilir.
