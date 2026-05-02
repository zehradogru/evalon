# Özet

Co-Movement sayfasinda kart kalabaligini azaltmak icin moduler sayfa yapisi plana eklendi ve ilk frontend sadeleştirme dilimi uygulandi. Ozet metrikler tek seride toplandi, ozel analizde gelismis ayarlar varsayilan kapali hale getirildi ve analiz sonucu/kaydet aksiyonu tek satirda birlestirildi.

# Değişiklik Listesi

- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` guncellendi.
- `frontend/features/markets/co-movement/co-movement-section.tsx` guncellendi.
- `docs/co-movement/2026-05-02/modular-layout-first-pass.md` eklendi.

# Teknik Detaylar

- `MetricStrip` component'i eklendi; snapshot ve ozel analiz metrikleri artik dort ayri kart yerine tek kompakt serit olarak gosteriliyor.
- `snapshotSummaryCards` ve `analysisSummaryCards` akislari `snapshotSummaryStrip` ve `analysisSummaryStrip` olarak sadeleştirildi.
- `SavedAnalysesPanel` agir kart gorunumunden cikarilip ozel analiz paneli icinde hafif liste modulune donusturuldu.
- Ozel analiz formunda `Top K`, `Min Benzerlik` ve `Rolling Window` alanlari varsayilan kapali `Gelismis Ayarlar` modulune alindi.
- Ozel analiz sonucunda durum, donem, kullanilan hisse sayisi, config ozeti ve `Analizi Kaydet` butonu tek aksiyon satirinda birlestirildi.
- Backend endpoint veya Firebase veri modeli degistirilmedi.

# Kontrol Listesi (Checklist)

- [x] `npm run lint -- features/markets/co-movement/co-movement-section.tsx services/co-movement-saved-analyses.service.ts hooks/use-co-movement-saved-analyses.ts services/co-movement.service.ts app/api/co-movement/explain/route.ts app/api/co-movement/explain/stream/route.ts`
- [x] `npx tsc --noEmit`
- [x] Browser'da `/markets/co-movement` sayfasi reload edildi.
- [x] Snapshot ozet metriklerinin tek serit olarak gorundugu kontrol edildi.
- [x] Ozel analiz sekmesinde `Gelismis Ayarlar` kapali geldigi ve acilinca `Top K`, `Rolling`, `Min Benzerlik` alanlarini gosterdigi kontrol edildi.
- [x] Ozel analiz sonucu uretildiginde `Hybrid Pair`, `Topluluk`, `Modularity`, `Dislanan` metrik seridi ve `Analizi Kaydet` aksiyon satiri gorundu.

# Bilinen Sorunlar / Eksikler

- Kayitli analizlerde tum kayitlari modal/panel ile gorme, yeniden adlandirma ve silme onayi henuz tamamlanmadi.
- Detay alanlari icin daha ileri seviyede progressive disclosure ve mobil optimizasyon sonraki fazlarda yapilacak.
- Browser console'da onceki hot-reload hatalari log gecmisinde duruyor; temiz reload sonrasi hata sayisi artmadi.
