# Frontend → Backend Güvenlik Analizi

**Tarih:** 2026-04-24  
**Kapsam:** `frontend/` — API route'lar, proxy katmanı, servis katmanı, auth

---

## Mimari Özeti

```
Browser
  │
  ├── lib/firebase.ts ──────────────────► Firebase Auth / Firestore (doğrudan)
  │
  └── services/*.service.ts
        │
        ├── lib/api-client.ts (axios) ──► localhost:3001  (legacy, USE_MOCK_DATA=true)
        │
        └── fetch('/api/...')
                │
                └── app/api/**/route.ts  (Next.js Route Handlers)
                          │
                          └── lib/server/evalon-proxy.ts
                                    │
                                    └── Cloud Run Backend
                                        (evalon-backtest-api-*.run.app)
```

### Dosya Haritası

| Dosya | Görev |
|---|---|
| `lib/firebase.ts` | Firebase init (Auth, Firestore, Storage) |
| `lib/api-client.ts` | Legacy axios client — şu an kullanılmıyor (mock) |
| `lib/evalon.ts` | Backend URL sabitleri + timeframe helper'ları |
| `lib/server/evalon-proxy.ts` | Server-side proxy — tüm route'ların backend köprüsü |
| `app/api/prices/route.ts` | Fiyat verisi endpoint (Yahoo + Evalon) |
| `app/api/prices/batch/route.ts` | Toplu fiyat endpoint |
| `app/api/backtests/run/route.ts` | Backtest çalıştırma |
| `app/api/backtests/start/route.ts` | Async backtest başlatma |
| `app/api/ai/sessions/route.ts` | AI session oluşturma |
| `app/api/ai/sessions/[sessionId]/messages/route.ts` | AI mesaj gönderme |
| `app/api/indicators/route.ts` | İndikatör listesi |
| `app/api/markets/list/route.ts` | Market listesi |
| `services/auth.service.ts` | Firebase Auth işlemleri |
| `services/backtests.service.ts` | Backtest servis çağrıları |

---

## Güvenlik Bulguları

### 🔴 Kritik — API Route'larda Kimlik Doğrulama Yok

**Etki:** Tüm `/api/*` endpoint'leri internete açık, auth kontrolü yok.

Backtest çalıştırma, AI session açma, indikatör çekme gibi işlemler herhangi biri tarafından yapılabilir. Cloud Run backend maliyeti ve rate limit'i açıkta kalıyor.

**Etkilenen dosyalar:**
- `app/api/backtests/run/route.ts`
- `app/api/backtests/start/route.ts`
- `app/api/ai/sessions/route.ts`
- `app/api/ai/sessions/[sessionId]/messages/route.ts`
- `app/api/ai/sessions/[sessionId]/route.ts`
- `app/api/indicators/route.ts`
- `app/api/prices/route.ts`
- `app/api/prices/batch/route.ts`

**Mevcut kod (örnek):**
```ts
// app/api/backtests/run/route.ts
export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyEvalonJson({ pathname: '/v1/backtests/run', method: 'POST', body })
    // ⚠️ Firebase ID token doğrulaması YOK
}
```

**Önerilen çözüm:**  
Her route'da `firebase-admin` ile `verifyIdToken()` çağrısı — `Authorization: Bearer <token>` header'dan alınacak.

---

### 🔴 Kritik — Path Traversal Riski (sessionId / runId)

**Etki:** URL path parametreleri doğrulanmadan backend URL'ine ekleniyor. `../../` gibi değerler farklı backend endpoint'lerine yönlendirme yapabilir.

**Etkilenen dosyalar:**
- `app/api/ai/sessions/[sessionId]/messages/route.ts`
- `app/api/ai/sessions/[sessionId]/route.ts`
- `app/api/backtests/[runId]/status/route.ts`
- `app/api/backtests/[runId]/events/route.ts`
- `app/api/backtests/[runId]/portfolio-curve/route.ts`

**Mevcut kod:**
```ts
const { sessionId } = await context.params
return proxyEvalonJson({
    pathname: `/v1/ai/sessions/${sessionId}/messages`,  // ⚠️ sanitize edilmiyor
    ...
})
```

**Önerilen çözüm:**  
UUID/slug formatında whitelist regex ile doğrulama:
```ts
if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
}
```

---

### 🟡 Orta — `localStorage`'da Token Saklama (XSS Riski)

**Etki:** XSS saldırısında token çalınabilir.

**Dosya:** `lib/api-client.ts`

```ts
// Request interceptor
const token = localStorage.getItem('auth_token')  // ⚠️ XSS'e karşı zayıf
if (token) {
    config.headers.Authorization = `Bearer ${token}`
}
```

**Not:** Firebase Auth kendi memory/IndexedDB storage'ını kullanıyor, bu `auth_token` key'i set edilmiyor ve legacy görünüyor. Interceptor bloğunun kaldırılması öneriliyor.

---

### 🟡 Orta — Ticker Input Validasyonu Eksik

**Etki:** Kullanıcı/istemci kaynaklı ticker değerleri backend'e olduğu gibi iletiliyor. `BIST_AVAILABLE` whitelist'i mevcut olmasına rağmen route'larda kullanılmıyor.

**Dosya:** `app/api/prices/batch/route.ts`

```ts
const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean)
// ⚠️ BIST_AVAILABLE veya benzeri bir whitelist kontrolü yok
// Maks 150 limiti var ama içerik doğrulaması eksik
```

**Önerilen çözüm:**  
`BIST_AVAILABLE` + diğer piyasa listelerinden oluşan bir set ile filtrele.

---

### 🟢 Bilgi — `NEXT_PUBLIC_` Env Değişkenleri Tarayıcıya Açık

**Dosya:** `.env.local`

```
NEXT_PUBLIC_EVALON_API_URL=https://evalon-backtest-api-474112640179.europe-west1.run.app
NEXT_PUBLIC_FIREBASE_API_KEY=...
```

Firebase config için bu tasarım gereği kabul edilebilir. Ancak `NEXT_PUBLIC_EVALON_API_URL` tarayıcıya açık olduğu için backend URL'i de biliniyor. Auth yokken bu, doğrudan backend'e erişim anlamına gelir.

**Öneri:** `EVALON_API_URL`'i `NEXT_PUBLIC_` prefix'siz yap — sadece server-side route'larda kullanılıyor zaten.

---

### 🟢 Bilgi — In-Memory Cache (Sunucu Restart'ta Sıfırlanır)

**Dosya:** `app/api/prices/route.ts`, `app/api/prices/batch/route.ts`

```ts
const cache = new Map<string, CacheEntry>()
```

Serverless/Cloud Run ortamında instance restart'ta cache sıfırlanır. Mevcut davranış için sorun değil ama beklenti yönetimi açısından not edilmeli.

---

## Düzeltme Öncelik Sırası

| Öncelik | Konu | İş Yükü |
|---|---|---|
| 🔴 1 | API route'lara Firebase token auth ekle | Orta |
| 🔴 2 | Path param'ları (sessionId, runId) UUID regex ile sanitize et | Küçük |
| 🟡 3 | `api-client.ts` localStorage token bloğunu kaldır | Küçük |
| 🟡 4 | Batch endpoint'te ticker whitelist doğrulaması ekle | Küçük |
| 🟢 5 | `NEXT_PUBLIC_EVALON_API_URL` → server-only env'e taşı | Küçük |
