# EVALON WEB - Proje Durum Raporu

**Son Güncelleme:** 15 Şubat 2026  
**Versiyon:** 2.0  
**Aktif Faz:** Faz 2 Tamamlandı ✅ - Sonraki: Faz 3

---

## FAZ 2 - TAMAMLANDI ✅

### Hedef
Dashboard sayfasına 3 yeni widget eklemek:
1. Piyasa Görünümü Chart (recharts) ✅
2. Watchlist Widget (API'den BIST hisseleri + mini charts) ✅
3. Market News Widget (mock data ile carousel) ✅

### Tamamlanan Adımlar
- [x] recharts kütüphanesi
- [x] API types (PriceBar, PriceResponse, WatchlistItem)
- [x] Environment variable + constants.ts
- [x] Price service + API proxy (CORS fix)
- [x] React Query hooks
- [x] Piyasa görünümü chart (category axis, ResizeObserver)
- [x] Mini chart (fixed dimensions)
- [x] Watchlist widget (THYAO, GARAN, ASELS, EREGL)
- [x] News carousel (mock data)
- [x] Dashboard page entegrasyonu
- [x] Chart iyileştirmeleri (category axis, label formatting)

### Timeframe Mapping (Güncel)
| UI | API Timeframe | Limit | Açıklama |
|----|---------------|-------|----------|
| 1D | 5m | 100 | ~1 işlem günü |
| 1W | 1h | 40 | 5 gün × 8 saat |
| 1M | 1d | 30 | 30 gün |

### Bilinen Kısıtlamalar
- **5m verisi kısıtlı:** API'de sadece 21-23 Ocak arası 5m data mevcut
- **1D görünümü:** Eski tarih gösterebilir (API veri eksikliği nedeniyle)
- **Çözüm bekliyor:** API tarafından daha fazla 5m verisi eklenmesi

### Opsiyonel Alternatif
İleride grafikler arkadaşın hazırladığı webview/iframe ile değiştirilebilir (CSP/X-Frame-Options ayarı gerekir).

---

## TAMAMLANAN İŞLER

### Faz 1: Dashboard Base Layout ✅
- Modern top navbar (glassmorphism, responsive)
- Dashboard overview page (welcome + 3 stat cards)
- Protected route wrapper
- Dark theme (#0a0e1a, #131722, #1a1f2e)
- Visual polish (gradients, hover effects, 300ms transitions)

**Commit:** `03e7ea1` - feat: add dashboard with modern UI and space-themed auth pages

### Infrastructure ✅
- Firebase Authentication (Email, Google)
- Vercel deployment (auto-deploy on git push)
- SSR enabled
- Terms, Privacy, Help pages

---

## PROJE YAPISI (Güncel)

```
evalon-web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           ✅
│   │   ├── signup/page.tsx          ✅
│   │   └── forgot-password/page.tsx ✅
│   ├── dashboard/
│   │   ├── layout.tsx               ✅ Protected wrapper
│   │   └── page.tsx                 ✅ Stats cards
│   ├── help/page.tsx                ✅
│   ├── privacy/page.tsx             ✅
│   ├── terms/page.tsx               ✅
│   ├── layout.tsx
│   ├── page.tsx                     → /dashboard redirect
│   └── globals.css
│
├── components/
│   ├── auth/
│   │   └── protected-route.tsx      ✅
│   ├── dashboard/
│   │   └── navbar.tsx               ✅ (TEK COMPONENT)
│   ├── ui/                          shadcn/ui
│   └── providers.tsx                ✅
│
├── lib/
│   ├── firebase.ts                  ✅
│   ├── api-client.ts                Axios (mock mode)
│   ├── constants.ts                 USE_MOCK_DATA = true
│   └── utils.ts
│
├── services/
│   ├── auth.service.ts              ✅ Firebase auth
│   └── market.service.ts            Mock data
│
├── hooks/
│   └── use-markets.ts               React Query hooks
│
├── store/
│   ├── use-auth-store.ts            ✅
│   └── use-ui-store.ts
│
├── data/
│   └── markets.mock.ts              Mock market data
│
├── types/
│   └── index.ts
│
└── .env.local                       ⚠️ gitignore'da
```

---

## TEKNİK DETAYLAR

### Tech Stack
```json
{
  "framework": "Next.js 16.1.6",
  "ui": "React 19.2.3 + TailwindCSS 4",
  "state": "Zustand 5.0.11",
  "data-fetching": "@tanstack/react-query 5.90.20",
  "auth": "Firebase Auth 12.9.0",
  "deployment": "Vercel (Hobby Plan)"
}
```

### Environment Variables
```bash
# .env.local (git'e commitlenmez)

# Firebase (mevcut)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Evalon API (Faz 2'de eklenecek)
NEXT_PUBLIC_EVALON_API_URL=https://evalon-mu.vercel.app
```

---

## PYTHON API BİLGİLERİ

**Base URL:** Environment variable ile (`NEXT_PUBLIC_EVALON_API_URL`)

### Endpoints
```bash
GET /v1/prices?ticker=THYAO&timeframe=1h&limit=24    # Saatlik
GET /v1/prices?ticker=THYAO&timeframe=1d&limit=30    # Günlük
```

### Response Format
```json
{
  "ticker": "THYAO",
  "timeframe": "1h",
  "rows": 24,
  "data": [
    { "t": "2026-01-21T10:00:00", "o": 285.50, "h": 287.20, "l": 284.80, "c": 286.90, "v": 1250000 }
  ]
}
```

### Mevcut Veri
- 124 BIST ticker
- Tarih aralığı: 2026-01-21 ~ 2026-02-06

### Ticker Listesi (124 adet)
```
AEFES, AGHOL, AKBNK, AKSA, AKSEN, ALARK, ALTNY, ANSGR, ARCLK, ASELS,
ASTOR, BALSU, BIMAS, BRSAN, BRYAT, BSOKE, BTCIM, CANTE, CCOLA, CIMSA,
CWENE, DAPGM, DOAS, DOHOL, DSTKF, ECILC, EFOR, EGEEN, EKGYO, ENERY,
ENJSA, ENKAI, EREGL, EUPWR, FENER, FROTO, GARAN, GENIL, GESAN, GLRMK,
GRSEL, GRTHO, GSRAY, GUBRF, HALKB, HEKTS, ISCTR, ISMEN, IZENR, KCAER,
KCHOL, KLRHO, KONTR, KRDMD, KTLEV, KUYAS, MAGEN, MAVI, MGROS, MIATK,
MPARK, OBAMS, ODAS, OTKAR, OYAKC, PASEU, PATEK, PETKM, PGSUS, QUAGR,
RALYH, REEDR, SAHOL, SASA, SISE, SKBNK, SOKM, TABGD, TAVHL, TCELL,
THYAO, TKFEN, TOASO, TRALT, TRENJ, TRMET, TSKB, TSPOR, TTKOM, TTRAK,
TUKAS, TUPRS, TUREX, TURSG, ULKER, VAKBN, VESTL, YEOTK, YKBNK, ZOREN,
AKCNS, AKENR, AKFGY, ALGYO, ALFAS, AHGAZ, AGROT, ARDYZ, BAGFS,
BIZIM, CLEBI, DEVA, GWIND, ISGYO, KAREL, LOGO, NETAS, PETUN,
PNSUT, SELEC, TMSN, VESBE, ZEDUR, IZFAS
```

---

## MILESTONE'LAR

| Milestone | Durum | Açıklama |
|-----------|-------|----------|
| 1. Base Layout | ✅ | Navbar, protected routes, stat cards |
| 2. Dashboard Overview | 🚧 | Portfolio chart, watchlist, news |
| 3. Markets Page | ⏳ | BIST listesi, market tabs |
| 4. Stock Detail | ⏳ | Candlestick chart, statistics |

---

## KNOWN ISSUES

- Cross-Origin-Opener-Policy warning (Firebase popup - zararsız)
- Apple Sign-In disabled (Apple Developer Account gerekli)

---

## TASARIM REHBERİ

### Renkler
```css
/* Backgrounds */
--bg-primary: #0a0e1a;
--bg-secondary: #131722;
--bg-card: #1a1f2e;

/* Accents */
--accent-blue: #2962FF;
--accent-green: #26A69A;
--accent-red: #EF5350;

/* Text */
--text-primary: #ffffff;
--text-secondary: #94a3b8; /* slate-400 */
```

### Efektler
- Transitions: 300ms
- Hover glow: `hover:shadow-xl hover:shadow-blue-500/10`
- Glassmorphism: `backdrop-blur-xl bg-[#131722]/95`
- Gradients: `bg-gradient-to-br from-[#1a1f2e] to-[#151923]`

---

## DEPLOYMENT

### Local Development
```bash
npm run dev              # http://localhost:3000
npm run build            # Production build test
```

### Git Flow
```bash
git add .
git commit -m "feat: description"
git push                 # Auto Vercel deploy
```

---

## SESSION GEÇMİŞİ

### Session 3: 15 Şubat 2026 (Aktif)
- 🚧 Faz 2 başlangıcı - PROJECT_STATUS.md düzenleme

### Session 2: 14 Şubat 2026
- ✅ Dashboard base layout (Faz 1)
- ✅ Top navbar, 3 stat cards
- ✅ Space-themed auth backgrounds
- **Commit:** `03e7ea1`

### Session 1: Önceki
- ✅ Firebase Authentication
- ✅ Vercel deployment
- ✅ Auth pages

---

## GİZLİLİK NOTU

⚠️ Bu dosya git'e commitlenebilir - hassas bilgiler placeholder.

**Gerçek credentials:**
- Local: `.env.local` (gitignore'da)
- Production: Vercel Dashboard → Environment Variables
- Firebase: Firebase Console → Project Settings
