# Evalon AI — Chatbot Sayfası Yeniden Tasarımı

**Son güncelleme:** 17 Nisan 2026

## Özet

Eski `/llm` rotasındaki temel ve hatalı chatbot arayüzü tamamen silindi. Yerine TradingView benzeri, üç panelli profesyonel bir AI asistan sayfası oluşturuldu; navbar, sidebar güncellendi ve Firestore tabanlı kalıcı sohbet geçmişi eklendi. Yeni rota `/ai`.

---

## Değişiklik Listesi

### Silinen Dosyalar
- `frontend/app/llm/page.tsx` — Eski LLM sayfası
- `frontend/features/llm/llm-view.tsx` — Eski temel chatbot bileşeni

### Eklenen Dosyalar
- `frontend/app/ai/page.tsx` — Yeni AI sayfası (route: `/ai`)
- `frontend/features/ai-assistant/ai-assistant-view.tsx` — Yeni tam özellikli AI asistan bileşeni
- `frontend/services/ai-history.service.ts` — Firestore tabanlı oturum + mesaj kalıcılık servisi

### Güncellenen Dosyalar
- `frontend/components/dashboard/navbar.tsx` — "AI Terminal" kaldırıldı; "Evalon AI" üst seviye navbar linki olarak Community yanına eklendi (gradient + Sparkles ikonu)
- `frontend/src/components/layout/Sidebar.tsx` — Evalon AI widget path `/llm` → `/ai`
- `frontend/components/layout/dashboard-shell.tsx` — `LLMView` import/kullanımı `AiAssistantView` ile değiştirildi
- `frontend/features/dashboard/market-status.tsx` — Dashboard shortcut linki `/llm` → `/ai`

### Firebase Güvenlik Kuralları
`aiMessages` subcollection için kural eklendi:
```javascript
match /users/{userId} {
  allow read, create, update: if request.auth != null && request.auth.uid == userId;
  allow delete: if false;

  match /aiMessages/{sessionId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```

---

## Teknik Detaylar

### Yeni Sayfa Mimarisi (`AiAssistantView`)

**İki mod:**
- `isWidget={false}` (default): Tam sayfa, üç panelli layout
- `isWidget={true}`: Dashboard sidebar widget modu (sadece chat)

**Üç panel layout (tam sayfa):**

| Panel | İçerik | Genişlik |
|-------|---------|----------|
| Sol — Oturum Geçmişi | Oturum listesi, "+" yeni oturum, aktif araç sayısı | 220px (toggle ile kapatılabilir) |
| Orta — Chat Alanı | Mesaj balonları, boş durum ekranı, yazma göstergesi, input alanı | flex-1 |
| Sağ — Bağlam & Çıktı | Sembol/periyot/indikatör ayarları, son yanıt detayı, kayıtlı assetler | 280px (toggle ile kapatılabilir) |

**Tüm özellikler:**
- `EmptyState`: 4 hızlı prompt kartı (Strateji Öner, Backtest, İndikatör Analizi, Kural Seti)
- `MessageContent`: Kod blokları (` ``` `), kalın metin (`**...**`), satır sonlarını destekleyen inline renderer
- `ChatMessage`: Hover copy butonu, tool sonuçları collapse/expand, taslak badge'i, timestamp
- `AssetCard`: Kayıtlı assetler (strateji/kural/indikatör) için expand/collapse kartları
- Yazarken animasyonlu üç nokta (bouncing dots) typing indicator
- Panel toggle butonları (PanelLeftClose / PanelRightClose) — TradingView benzeri
- Session başlığı inline düzenlenebilir (blur'da Firestore'a kaydedilir, sol listede anlık güncellenir)
- İlk mesajdan otomatik session başlığı üretimi (ilk 40 karakter)
- Error mesajı toolbar'da anlık gösterim
- **`SymbolPicker`**: Serbest metin girişi yerine `BIST_AVAILABLE` listesinden arama yapılabilen, chip gösterimi olan çoklu sembol seçici
- **Optimistik kullanıcı mesajı**: Gönder'e basınca mesaj anında ekrana yansıyor, hata durumunda geri alınıyor
- **Oturum silme**: Her oturumun üzerine gelinince `Trash2` ikonu görünür, Firestore'dan temizler
- **Mesaj yükleme spinnerı**: Oturum geçmişine tıklanınca `Loader2 animate-spin` gösterilir

### Firestore Kalıcılık Mimarisi (`ai-history.service.ts`)

```
Firestore
└── users/{userId}
    ├── aiSessions: StoredAiSession[]   ← oturum listesi (max 50)
    └── aiMessages/{sessionId}
        └── messages: AiMessage[]       ← o oturumun mesajları
```

**`StoredAiSession`**: `{ sessionId: string; title: string; createdAt: number }`

| Metot | Açıklama |
|-------|----------|
| `getSessions(userId)` | Oturum listesini okur |
| `saveSession(userId, session)` | Başa ekle, dedupe, max 50'de kes |
| `deleteSession(userId, sessionId)` | Listeden sil + messages temizle |
| `updateSessionTitle(userId, sessionId, title)` | Başlığı güncelle |
| `getMessages(userId, sessionId)` | Oturum mesajlarını yükle |
| `appendMessages(userId, sessionId, messages)` | Mevcut mesajlara ekle |

### Cloud Run Yeniden Başlatma Koruması

Backend session store in-memory olduğundan Cloud Run restart veya scale-out sonrası session kaybolabilir. `sendMutation.mutationFn` içinde otomatik yeniden oluşturma mekanizması var:

```
mesaj gönder
  → 404/400 hatası
    → yeni backend session oluştur
      → mesajı tekrar gönder (şeffaf, kullanıcı fark etmez)
```

### Kullanılan API Endpointleri

| Endpoint | Açıklama |
|----------|----------|
| `GET /v1/ai/tools` | Araç kataloğu |
| `POST /v1/ai/sessions` | Oturum oluştur |
| `GET /v1/ai/sessions/{id}` | Oturum detayı (devre dışı, Firestore kullanılıyor) |
| `POST /v1/ai/sessions/{id}/messages` | Mesaj gönder |
| `GET /v1/ai/assets` | Kayıtlı assetler |

**Kullanılan tipler:** `AiMessage`, `AiMessageResponse`, `AiRequestContext`, `AiAsset` (`@/types`)

---

## Kontrol Listesi

1. `http://localhost:3000/ai` adresine git → Üç panelli AI sayfası yüklenmeli
2. Navbar'da Community yanında **Evalon AI** linki görünmeli (gradient + Sparkles)
3. Sağ sidebar Evalon AI ikonuna tıkla → Widget modunda chat paneli açılmalı
4. Giriş yapmadan `/ai` → "Giriş yapman gerekiyor" mesajı görünmeli
5. Giriş yaptıktan sonra boş durum ekranında 4 hızlı prompt kartı görünmeli
6. Bir prompt kartına tıkla → Input alanına text kopyalanmalı
7. Enter tuşu veya gönder butonu ile mesaj gönder → Üç nokta animasyonu çıkmalı, yanıt gelince mesaj balonunda görünmeli
8. AI kodu içeren yanıt verirse → Syntax highlighted kod bloğu render edilmeli
9. Sol panel (oturum geçmişi) toggle butonu çalışmalı
10. Sağ panel (bağlam) toggle butonu çalışmalı
11. Mesaj balonunun üzerine gel → Kopyala butonu görünmeli
12. Sayfayı yenile → Sol panelde oturum listesi korunmalı (Firestore'dan yüklenir)
13. Eski oturuma tıkla → Mesaj geçmişi yüklenmeli
14. "Yeni Oturum Oluştur" → Temiz boş chat açılmalı, eski mesajlar kaybolmamalı
15. Semboller alanında hisse ara → Autocomplete listesi çıkmalı, chip olarak eklenmeli
16. `/llm` adresine git → 404 dönmeli (sayfa silindiği için)

---

## Bilinen Sorunlar / Eksikler

- **Backend context kaybı:** Cloud Run restart sonrası AI'ın aktif strateji taslağı/bağlamı sıfırlanır. Mesajlar Firestore'da korunur ama backend'in çalışma belleği kaybolur.
- **Streaming yok:** Yanıtlar tek seferde gelir, token-by-token stream yoktur.
- **react-markdown kurulu değil:** Kod bloğu renderer manuel yazıldı; karmaşık Markdown (tablolar, nested listeler) tam desteklenmez.
