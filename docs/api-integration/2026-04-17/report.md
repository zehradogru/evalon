# Evalon API & Frontend Entegrasyon Raporu

**Tarih:** 2026-04-17
**Tür:** Backend Migrasyonu ve Frontend Entegrasyonu
**Durum:** Tamamlandı (Hata Temizleme Aşamasında)

## Özet
Bu çalışma ile Evalon sitesi, mock (sahte) verilerden kurtarılarak PDF dokümanında belirtilen Cloud Run FastAPI backendine (`https://evalon-backtest-api-474112640179.europe-west1.run.app`) bağlanmıştır. Fiyat grafiği, teknik indikatörler, backtest motoru ve AI çalışma alanı artık gerçek verilerle çalışmaktadır.

## Yapılan Değişiklikler

### 1. Altyapı ve Proxy Katmanı
- **`frontend/lib/server/evalon-proxy.ts`**: Frontend'den gelen istekleri Cloud Run backendine güvenli bir şekilde ileten proxy katmanı kuruldu.
- **`frontend/app/api/...`**: Prices, Indicators, Backtests ve AI için toplam 18 yeni proxy route eklendi.
- **`frontend/lib/constants.ts`**: `USE_MOCK_DATA` kontrolü optimize edildi, temel akışlar gerçeğe çevrildi.

### 2. Özellik Bazlı Geliştirmeler
- **Market Detay (`ticker-view.tsx`)**: 
  - Fiyat grafiği gerçek API'ye bağlandı.
  - 1m'den 1M'ye kadar tüm zaman dilimleri (timeframes) aktif edildi.
  - Alt kısımdaki indikatör paneli (RSI, MACD vb.) dinamik hale getirildi.
- **Backtest Sistemi (`backtest-view.tsx`)**:
  - Sync (Hızlı) ve Async (Kuyruklu) işlem başlatma eklendi.
  - Portföy eğrisi (`Portfolio Curve`) ve işlem olayları (`Trade Events`) gerçek veriye bağlandı.
  - Blueprint builder (strateji oluşturucu) fonksiyonel hale getirildi.
- **AI Workspace (`llm-view.tsx`)**:
  - AI ile mesajlaşma ve session yönetimi backend'e bağlandı.
  - Üretilen strateji taslaklarının (drafts) kaydedilmesi sağlandı.
- **Indicator Lab (`analysis-view.tsx`)**: 
  - Eski "Analysis" ekranı, tüm indikatörlerin parametreleriyle denenebildiği bir laboratuvar ekranına dönüştürüldü.

## Teknik Detaylar
- **Base URL:** `https://evalon-backtest-api-474112640179.europe-west1.run.app`
- **Auth:** Firebase User UID, AI ve Asset endpointlerinde `user_id` olarak iletilmektedir.
- **State Yönetimi:** Firebase auth ve TanStack Query (React Query) ile senkronize edildi.

## Sitede Kontrol Edilmesi Gerekenler (Checklist)

> [!IMPORTANT]
> Testleri yaparken tarayıcı konsolunu (F12) açık tutun.

1.  **[ ] Market Detay:** `/markets/THYAO` sayfasına gidin. Fiyatın yüklendiğinden ve alttaki "Indicator Panel" kısmında RSI/MACD çizgilerinin oluştuğundan emin olun.
2.  **[ ] Zaman Dilimleri:** Grafikte "1h", "4h" ve "1d" arasında geçiş yapın. Verilerin güncellendiğini teyit edin.
3.  **[ ] Indicator Lab:** `/analysis` sayfasında farklı bir hisse (örn: GARAN) seçip indikatör parametrelerini değiştirerek "Yenile" butonuna basın.
4.  **[ ] Backtest:** `/backtest` sayfasında "Sync Run" butonuna basarak hızlı bir sonuç almayı deneyin. Ardından "Async Start" ile süreci başlatıp "Run Status" barının ilerlediğini görün.
5.  **[ ] Evalon AI:** `/llm` sayfasında "THYAO için RSI stratejisi yaz" gibi bir komut verin. AI'nın cevap verdiğinden ve sağ tarafta "AI Output" kısmının dolduğundan emin olun.
6.  **[ ] Dashboard:** Ana sayfadaki "Market Movers" (En çok artan/azalan) listesinin gerçek hisselerle dolduğunu kontrol edin.

## Bilinen Sorunlar ve Notlar
- **Async Store:** Backend tarafındaki asenkron backtest kayıtları hafıza (memory) tabanlıdır. Backend servisinin restart olması durumunda aktif testler kaybolabilir.
- **Haberler:** Haber entegrasyonu (`news`) bu aşamanın dışında bırakılmıştır, mevcut yapısını korumaktadır.
