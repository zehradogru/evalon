# Özet

Co-Movement sayfasinda snapshot ust durum satiri kaldirildi, yenileme aksiyonu ag grafigi header'ina tasindi ve sayfa hero basligi sade `Co_movement` basligina indirildi. Detaylar tarafinda tekrar eden `Topluluklar` tab'i kaldirildi; en guclu eslesmeler ve pair siralamalari artik secili odak/grup uzerinden filtreleniyor.

# Değişiklik Listesi

- `frontend/features/markets/co-movement/co-movement-section.tsx` guncellendi.
- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` guncellendi.
- `docs/co-movement/2026-05-02/snapshot-header-scoped-details-polish.md` eklendi.

# Teknik Detaylar

- `filterPairsForScope` ve `buildScopedPairRankings` helper'lari eklendi; `market`, `community`, `pair` ve `symbols` odaklari icin pair listeleri ayni scope mantigiyla filtreleniyor.
- Snapshot ustundeki `Guncel snapshot` kontrol satiri ve tarihsel snapshot select'i kaldirildi.
- Snapshot yenileme aksiyonu `SnapshotExplorerView` icine `onRefresh` / `isRefreshing` props'lariyla tasindi ve ag grafigi header'inda ikon buton olarak gosterildi.
- Hero bolumu sadeleştirildi; uzun `Birlikte Hareket Eden Hisseler` basligi ve aciklama metinleri kaldirildi, `Co_movement` premium basligi kullanildi.
- `DetailsWorkspace` icindeki `Topluluklar` tab'i kaldirildi.
- `DetailsWorkspace` artik `scopeLabel` aliyor ve secili grup/odak bilgisini detay aciklamasinda gosteriyor.
- Snapshot ve custom analizde `En Guclu Eslesmeler` ve `Pair Siralamalari`, mevcut explain/graph scope'una gore daraltiliyor.
- Graph hisse detay kartinda gruptaki diger hisselerin chip listesi kaldirildi; ust kart sadece hisse adi ve grup bilgisini gosteriyor.

# Kontrol Listesi (Checklist)

- [x] `npm run lint -- features/markets/co-movement/co-movement-section.tsx services/co-movement-saved-analyses.service.ts hooks/use-co-movement-saved-analyses.ts services/co-movement.service.ts app/api/co-movement/explain/route.ts app/api/co-movement/explain/stream/route.ts`
- [x] `npx tsc --noEmit`
- [x] Browser'da `/markets/co-movement` reload edildi.
- [x] `Co_movement` basliginin gorundugu, eski uzun basligin gorunmedigi dogrulandi.
- [x] `Guncel snapshot` ust durum satirinin kalktigi dogrulandi.
- [x] `Snapshot yenile` butonunun ag grafigi header'inda gorundugu dogrulandi.
- [x] `Detaylar` icinde `Topluluklar` tab'inin kalktigi dogrulandi.
- [x] G16 community secildiginde detay aciklamasinin `G16 odagina gore...` seklinde daraldigi ve pair alanlarinda G16 hisselerinin gorundugu dogrulandi.

# Bilinen Sorunlar / Eksikler

- Browser QA'da graph node secimi dogrudan tiklanarak test edilmedi; node detay sadeleştirmesi kod seviyesinde uygulandi.
- Tarihsel snapshot secimi bu sadeleştirme kapsaminda UI'dan kaldirildi; ileride gerekirse ayri, daha az gorunen bir arsiv girisi olarak tasarlanabilir.
