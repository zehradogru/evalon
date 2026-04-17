# Detail Fullscreen Chart WebView

## Özet
Market detay sayfasındaki tam ekran butonu, Cloud Run üzerinde çalışan harici grafik webview’ine bağlandı. Kullanıcı artık detay sayfasından ayrı bir fullscreen route’a geçip grafik servisini `iframe` içinde açabiliyor; yükleme uzarsa sayfa boş kalmadan retry ve yeni sekmede aç fallback’leri sunuluyor.

## Değişiklik Listesi
- `frontend/lib/evalon.ts`
- `frontend/features/markets/ticker-view.tsx`
- `frontend/features/markets/fullscreen-chart-view.tsx`
- `frontend/app/markets/[ticker]/chart/page.tsx`

## Teknik Detaylar
- Yeni public graph host default’u eklendi:
  `NEXT_PUBLIC_EVALON_GRAPH_WEB_URL`
  Varsayılan değer: `https://evalon-graph-web-474112640179.europe-west1.run.app`
- `frontend/lib/evalon.ts` içinde şu yardımcılar eklendi:
  `toGraphWebTimeframe()` ve `buildGraphWebUrl()`
- Detail view’de tam ekran aksiyonu artık iç route’a gider:
  `/markets/[ticker]/chart?tf=...`
- Fullscreen route, Cloud Run chart URL’ini `iframe` içinde açar ve minimal toolbar sunar:
  geri, timeframe badge, yenile, yeni sekmede aç
- `iframe` yükleme durumu `load` + timeout mantığıyla yönetilir. Cross-origin olduğu için içerik okunmaz; yavaş veya problemli açılışlarda kullanıcıya sayfadan çıkmadan retry etme imkanı verilir.

## Kontrol Listesi (Checklist)
1. `/markets/THYAO` sayfasına gidin ve tam ekran butonuna tıklayın.
2. Uygulamanın `/markets/THYAO/chart?tf=...` route’una geçtiğini doğrulayın.
3. Toolbar’da geri, yenile ve yeni sekmede aç aksiyonlarının göründüğünü kontrol edin.
4. Açılan iframe’in doğru `symbol` ve `tf` query param’leriyle Cloud Run chart hostuna gittiğini teyit edin.
5. Detail sayfasında timeframe değiştirip tekrar tam ekrana geçtiğinizde yeni timeframe’in taşındığını kontrol edin.
6. Fullscreen route’u doğrudan yeni sekmede açarak geri aksiyonunun detail route fallback’ine döndüğünü doğrulayın.
7. Ağ yavaşlatıldığında önce loading state, ardından gerekirse timeout fallback kartının göründüğünü kontrol edin.
8. `Yeni Sekmede Aç` aksiyonunun doğrudan harici grafik URL’ini açtığını doğrulayın.
9. `frontend` dizininde `npm run build` komutunun geçtiğini doğrulayın.

## Bilinen Sorunlar / Eksikler
- Embed davranışı harici hostun `X-Frame-Options` veya CSP politikasına bağlıdır; host ileride iframe’i engellerse route içi fallback panel yine çalışır ama asıl çözüm yeni sekmede açmaktır.
- V1’de detail sayfası ile iframe arasında iki yönlü state senkronizasyonu yoktur; yalnızca başlangıç `ticker` ve `timeframe` aktarılır.
- `iframe` içeriği cross-origin olduğu için gerçek yüklenme hataları doğrudan okunamaz; kullanıcı deneyimi timeout ve fallback aksiyonlarıyla korunur.
