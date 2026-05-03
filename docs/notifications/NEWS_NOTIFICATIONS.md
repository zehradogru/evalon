# Haber Bildirimleri — Geliştirici Rehberi

Bu belge, Evalon'daki haber bildirim sisteminin **nasıl çalıştığını** ve sana düşen geliştirme görevlerini açıklar.

---

## Genel Akış (Büyük Resim)

```
[Cloud Run Job — günlük]
  collect_markets_news.py        → Haberleri çeker
  daily_bist_news_job.py         → Oracle BIST_NEWS tablosuna yazar
  sentiment_inference.py         → Haberleri OLUMLU/OLUMSUZ/NÖTR etiketler

      ↓ Oracle'da etiketli haberler hazır

[Next.js API — /api/news]
  Oracle'dan haberleri çekip JSON döner
  ?symbols=THYAO,SASA&published_after=2026-05-01T00:00:00Z gibi filtreler desteklenir

      ↓ Firebase Cloud Functions dakikada bir çalışır

[evaluateNewsAlertRules — Firebase Scheduled Function]
  Her kullanıcının news_alert_rules koleksiyonuna bakar
  Kullanıcının watchlist'indeki ticker'lar için yeni haber var mı? → /api/news çağırır
  Eşleşen haberler → Firestore'a matches olarak kaydedilir
  Burst window (varsayılan 10 dk) dolunca bildirim gönderilir

      ↓ Firebase Cloud Messaging (FCM)

[Kullanıcının tarayıcısı / cihazı]
  Web push notification gelir
  Tıklanınca /news?symbols=THYAO,SASA sayfasına yönlendirir
```

---

## Mevcut Durum — Neyin Hazır Olduğu

| Bileşen | Durum | Nerede |
|---------|-------|--------|
| Haber scraper (Cloud Run Job) | ✅ Çalışıyor | `cloud_jobs/news_scraper/` |
| Oracle BIST_NEWS tablosu | ✅ Dolu | Oracle Autonomous DB |
| `/api/news` Next.js endpoint | ✅ Var | `frontend/app/api/news/route.ts` |
| Firebase Cloud Functions altyapısı | ✅ Deploy edilmiş | `functions/src/index.ts` |
| `evaluateNewsAlertRules` scheduled function | ✅ Yazılmış, dakikada 1 çalışıyor | `functions/src/index.ts` |
| FCM push gönderimi (`sendNotificationToDevices`) | ✅ Yazılmış | `functions/src/index.ts` |
| Cihaz kaydı (`registerDevice`) | ✅ Yazılmış | `functions/src/index.ts` |
| Bildirim ayarları UI (`/settings`) | ⚠️ Kontrol et | `frontend/features/settings/` |
| Kullanıcının news alert rule oluşturması | ⚠️ UI tarafı gerekebilir | Aşağıda açıklandı |

---

## Firestore Veri Modeli

### Kullanıcı Tercihleri
```
users/{userId}
  preferences.notifications.newsAlerts: boolean      ← "haber bildirimi açık/kapalı"
  preferences.notifications.pushEnabled: boolean     ← "push izni var mı"
  preferences.notifications.newsDigest: boolean      ← günlük özet (henüz kullanılmıyor)
  watchlist.tickers: string[]                        ← ["THYAO", "SASA", "EREGL"]
```

### Haber Uyarı Kuralı (Rule)
```
users/{userId}/news_alert_rules/{ruleId}
  status: "active" | "paused"
  scopeType: "watchlist"                             ← şimdilik hep "watchlist"
  sentiments: ["OLUMLU", "OLUMSUZ", "NOTR"]         ← hangi etiketlerde bildirim gitsin
  burstWindowMinutes: 10                             ← 10 dakikada bir özet
  lastCheckedAt: string | null                       ← en son ne zamana kadar kontrol edildi
  lastTriggeredAt: string | null
  lastEvaluatedAt: string | null
  createdAt: string
  updatedAt: string
```

> **Not:** `NÖTR` değil `NOTR` yazılıyor Firestore'da (Türkçe karakter sorununu önlemek için). Kod içinde `normalizeNewsAlertSentiment()` fonksiyonu çeviriyi yapıyor.

### Eşleşen Haberler (Matches)
```
users/{userId}/news_alert_rules/{ruleId}/matches/{newsId}
  ticker: string | null
  title: string
  sentiment: "OLUMLU" | "OLUMSUZ" | "NOTR"
  publishedAt: string
  windowStart: string                                ← burst window başlangıcı
  windowEnd: string                                  ← burst window bitişi
  status: "pending" | "delivered"
  deliveredAt: string | null
```

### Gönderilen Bildirimler
```
users/{userId}/notifications/{notifId}
  kind: "news"
  title: "3 new watchlist news items"
  body: "THYAO, SASA: THY yeni rota açıkladı | SASA..."
  ticker: string | null
  payload.articleIds: string[]
  payload.tickers: string[]
  payload.count: number
  isRead: boolean
  createdAt: string
```

### Kayıtlı Cihazlar (FCM Token)
```
users/{userId}/notification_devices/{deviceKey}
  token: string | null                               ← FCM push token
  permission: "granted" | "denied" | "default"
  browser: string
  platform: string
  active: boolean
  lastSeenAt: string
```

---

## Cloud Job Nasıl Çalışıyor?

```
Google Cloud Scheduler
  → Her gün saat 18:30 İstanbul (15:30 UTC)
  → Cloud Run Job: evalon-bist-news-scraper tetiklenir
      ↓
  daily_bist_news_job.py
    1. collect_markets_news.py çalıştırır
       - bist_tickers.json içindeki tüm ticker'lar için RSS + scraping
       - bist-news-data/ klasörüne CSV yazar
    2. En son CSV'yi Oracle'a atar (URL_HASH ile duplicate kontrolü)
       - SENTIMENT = 'BEKLIYOR' olarak kaydedilir
    3. sentiment_inference.py modeli çalıştırır
       - GCS'den final_model_dbmdz indirir (yoksa)
       - Her habere OLUMLU/OLUMSUZ/NÖTR atar
       - Oracle'ı günceller
```

Eğer bir haber `BEKLIYOR` kalırsa (inference başarısız olursa) `label_bekliyor_db.py` scripti yerel GPU ile tamamlar.

---

## Firebase Functions Nasıl Çalışıyor?

```
evaluateNewsAlertRules
  → Her dakika çalışır (Cloud Scheduler cron: "* * * * *")
  → Tüm kullanıcıların aktif news_alert_rules'larını tarar (max 100)
  → Her kural için evaluateNewsRuleSnapshot() çağırır:

      1. Kullanıcının watchlist.tickers ve preferences'ını okur
      2. newsAlerts=false veya watchlist boşsa → atla
      3. /api/news?symbols=...&published_after=lastCheckedAt çağırır
      4. Gelen haberler sentiment filtresiyle eşleşiyor mu? → matches alt-koleksiyonuna ekle
      5. windowEnd geçmiş "pending" match'leri grupla (burst window)
      6. Bir pencerede birden fazla haber → tek bildirim ("3 new watchlist news items")
      7. FCM ile push gönder, matches'i "delivered" yap
      8. lastCheckedAt güncelle
```

---

## Sana Düşen: Olası Eksikler

Sistem backendi hazır. Kullanıcı tarafında şunları kontrol et / eklemen gerekebilir:

### 1. Haber Uyarısı Kuralı Oluşturma (Öncelikli)

Kullanıcının `news_alert_rules` koleksiyonunda bir kural olması gerekiyor. Bu kural UI'dan oluşturulabilmeli.

**Settings sayfasında şöyle bir toggle yeterli:**
```ts
// Kural yoksa oluştur, varsa aktifleştir/durdur
const createOrToggleNewsAlertRule = async (userId: string, enabled: boolean) => {
  const rulesRef = db
    .collection('users').doc(userId)
    .collection('news_alert_rules')

  const existing = await rulesRef.limit(1).get()

  if (existing.empty) {
    await rulesRef.add({
      status: enabled ? 'active' : 'paused',
      scopeType: 'watchlist',
      sentiments: ['OLUMLU', 'OLUMSUZ', 'NOTR'],  // hepsi varsayılan
      burstWindowMinutes: 10,
      lastCheckedAt: null,
      lastTriggeredAt: null,
      lastEvaluatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } else {
    await existing.docs[0].ref.update({
      status: enabled ? 'active' : 'paused',
      updatedAt: new Date().toISOString(),
    })
  }
}
```

### 2. `preferences.notifications.newsAlerts` Toggle

`/settings` sayfasında kullanıcı "Haber bildirimleri" toggle'ını açınca:
- Firestore `users/{uid}.preferences.notifications.newsAlerts = true` set edilmeli
- Yukarıdaki kural da oluşturulmalı/aktifleştirilmeli

Firebase Functions bu iki şeyi birlikte kontrol ediyor.

### 3. FCM Push Token Kaydı

Tarayıcıdan push izni alındığında `registerDevice` Cloud Function çağrılmalı:

```ts
// frontend'de — bildirim izni alındıktan sonra
const token = await getToken(messaging, { vapidKey: VAPID_KEY })
await httpsCallable(functions, 'registerDevice')({
  deviceKey: 'browser-' + crypto.randomUUID(),  // cihaz başına sabit tutulabilir
  token,
  permission: 'granted',
  browser: navigator.userAgent,
  platform: navigator.platform,
  active: true,
})
```

Bu zaten `notification-push-bootstrap.tsx` bileşeninde mevcut olabilir — kontrol et:
`frontend/components/notifications/notification-push-bootstrap.tsx`

### 4. `/api/news` Endpoint — `published_after` Parametresi

Firebase Functions `published_after` parametresiyle çağırıyor. Bu parametrenin mevcut `route.ts`'de desteklendiğini doğrula. Yoksa ekle:

```ts
// frontend/app/api/news/route.ts içinde
const publishedAfter = searchParams.get('published_after')
// Oracle sorgusuna: AND PUBLISHED_AT > :published_after
```

---

## Test Etme

### 1. Manuel Kural Ekle (Firestore Console)

Firebase Console → Firestore → `users/{senin-uid}` → `news_alert_rules` → Belge Ekle:
```json
{
  "status": "active",
  "scopeType": "watchlist",
  "sentiments": ["OLUMLU", "OLUMSUZ", "NOTR"],
  "burstWindowMinutes": 2,
  "lastCheckedAt": null,
  "lastTriggeredAt": null,
  "lastEvaluatedAt": null,
  "createdAt": "2026-05-04T00:00:00.000Z",
  "updatedAt": "2026-05-04T00:00:00.000Z"
}
```

Watchlist'ine bir ticker ekle → 1-2 dakika bekle → `notifications` alt-koleksiyonunu kontrol et.

### 2. Test Push Bildirimi

```ts
await httpsCallable(functions, 'sendTestNotification')({})
// Eğer FCM token kayıtlıysa tarayıcıda bildirim görünmeli
```

### 3. Functions Logları

```bash
firebase functions:log --only evaluateNewsAlertRules
```

---

## Özet: Neyi Yapman Gerekiyor

1. **Settings UI** — "Haber bildirimleri" toggle'ı → `newsAlerts` preference + kural oluştur
2. **`/api/news` `published_after` kontrolü** — zaten varsa geç
3. **FCM token kaydının çalıştığını doğrula** — `notification-push-bootstrap.tsx`
4. Cloud Function ve Firestore tarafı **hazır, dokunma**
