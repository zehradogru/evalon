# Frontend: Yeni Sayfalar & Navigasyon Güncellemesi

## Özet

Üç yeni frontend özelliği eklendi: Kar/Zarar Hesaplayıcı, Top Movers tam sayfası ve Borsa Akademisi sözlüğü. Navbar tüm yeni sayfalara link verecek şekilde güncellendi.

---

## Değişiklik Listesi

### Yeni Eklenen Dosyalar

| Dosya | Açıklama |
|---|---|
| `frontend/app/tools/profit-loss/page.tsx` | Kar/Zarar Hesaplayıcı route sayfası |
| `frontend/features/tools/profit-loss-calculator.tsx` | Hesaplayıcı bileşeni (tam implementasyon) |
| `frontend/app/markets/movers/page.tsx` | Top Movers route sayfası |
| `frontend/features/markets/movers-view.tsx` | Top 20 Gainers / Losers / Most Active tabları |
| `frontend/app/academy/page.tsx` | Borsa Akademisi route sayfası |
| `frontend/features/academy/academy-view.tsx` | Akademi bileşeni (arama + filtre + grid + dialog) |
| `frontend/data/academy.ts` | 37 terim, 5 kategori, tip tanımları |
| `frontend/components/ui/dialog.tsx` | Eksik Dialog shadcn bileşeni oluşturuldu |

### Güncellenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `frontend/features/dashboard/top-movers.tsx` | "Tümünü Gör →" footer linki eklendi (`/markets/movers`) |
| `frontend/components/dashboard/navbar.tsx` | Products'a Kar/Zarar, Markets'a Top Movers, More'a Academy eklendi |

---

## Teknik Detaylar

### 1. Kar/Zarar Hesaplayıcı (`/tools/profit-loss`)

- **Hesap mantığı:**
  - `gross = (exitPrice - entryPrice) × qty × direction`
  - `commissionTotal = (entryPrice + exitPrice) × qty × (commissionBps / 10000)`
  - `bsmv = commissionTotal × (bsmvBps / 1000)`
  - `net = gross - commissionTotal - bsmv`
  - `roi = (net / totalCost) × 100`
  - `breakEven = entryPrice × (1 + totalFeeRatio)` (long için)
- **Varsayılan değerler:** Komisyon `2‰`, BSMV `5‰`
- **State:** `useMemo` ile gerçek zamanlı hesaplama, harici API çağrısı yok
- **Yön:** Long / Short toggle butonu

### 2. Top Movers Sayfası (`/markets/movers`)

- **Veri kaynağı:** `useMarketMovers()` hook'u (`hooks/use-dashboard-data.ts`)
- **Sekmeler:** Gainers (changePercent desc), Losers (changePercent asc), Most Active (vol desc) — ilk 20
- **Tıklama:** `router.push('/markets/{ticker}')` ile hisse detay sayfasına yönlendirme
- **Loading/Error/Warming state:** `MarketDataStatusChip` + Yenile butonu mevcut

### 3. Borsa Akademisi (`/academy`)

- **Tipler:** `AcademyTerm { slug, title, fullName, category, icon, short, long, formula? }`
- **Kategoriler:** `Teknik Analiz | Temel Analiz | Genel Kavramlar | Türev Ürünler | Piyasa Türleri`
- **Toplam terim:** 37
- **Arama:** `title`, `fullName`, `short`, `long` alanlarında `useMemo` ile canlı filtreleme
- **Filtre:** Kategori chip butonları (All + 5 kategori)
- **Dialog:** Karta tıklanınca `Dialog` bileşeniyle detay + varsa `formula` gösterimi

### 4. Navbar Eklemeleri

```ts
// Products grubuna
{ href: '/tools/profit-loss', label: 'Kar/Zarar Hesap.', icon: Calculator }

// Markets grubuna
{ href: '/markets/movers', label: 'Top Movers', icon: TrendingUp }

// More grubuna
{ href: '/academy', label: 'Academy', icon: GraduationCap }
```

### 5. Dialog Bileşeni

`@/components/ui/dialog` eksikti. `radix-ui` paketi (projede zaten mevcut, `sheet.tsx` de kullanıyor) üzerinden `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` export'ları oluşturuldu.

---

## Kontrol Listesi

- [ ] `/tools/profit-loss` — Long/Short yön değiştirme çalışıyor mu?
- [ ] `/tools/profit-loss` — Net kâr, ROI ve başabaş fiyatı doğru hesaplanıyor mu?
- [ ] `/tools/profit-loss` — "Gelişmiş" toggle ile komisyon/BSMV alanları açılıyor mu?
- [ ] `/markets/movers` — Gainers / Losers / Most Active sekmeleri veri yüklüyor mu?
- [ ] `/markets/movers` — Hisse satırına tıklayınca doğru hisse sayfasına gidiyor mu?
- [ ] Dashboard → Market Movers widget'ında "Tümünü Gör →" linki görünüyor ve `/markets/movers`'a yönlendiriyor mu?
- [ ] `/academy` — Arama kutusu çalışıyor mu?
- [ ] `/academy` — Kategori filtreleri çalışıyor mu?
- [ ] `/academy` — Karta tıklayınca dialog açılıyor mu? Formüllü terimlerde (RSI, MACD vb.) formül bölümü görünüyor mu?
- [ ] Navbar → Products menüsünde "Kar/Zarar Hesap." görünüyor mu?
- [ ] Navbar → Markets menüsünde "Top Movers" görünüyor mu?
- [ ] Navbar → More menüsünde "Academy" görünüyor mu?

---

## Bilinen Sorunlar / Eksikler

- Akademi terimleri statik (`data/academy.ts`). CMS veya Firestore entegrasyonu yapılmamıştır.
- Kar/Zarar Hesaplayıcı'da hisse fiyatı otomatik çekilmiyor; kullanıcı manuel giriş yapar.
- `dialog.tsx` bileşeni temel animasyonlarla oluşturulmuştur; projenin diğer dialog kullanımları varsa bu bileşen merkezi hale getirilmelidir.
