# Ozet

Bu dokuman, Co-Movement sayfasini backend'e dokunmadan frontend tarafinda prod'a hazir bir urun deneyimine tasimak icin ana yol haritasidir. Hedef; ekonomistlerin ve piyasa ile ilgilenen son kullanicilarin tum piyasa, secili grup, secili cift veya secili hisseler kapsaminda birlikte hareket iliskilerini kaybolmadan inceleyebilmesidir.

Bu dosya bundan sonraki Co-Movement frontend gelistirmeleri icin source of truth olarak kullanilacak. Her faz tamamlandiginda bu dokumandaki durumlar ve kabul kriterleri guncellenecek.

# Degisiklik Listesi

- `docs/co-movement/2026-05-02/frontend-ux-product-roadmap.md` eklendi.
- `frontend/features/markets/co-movement/co-movement-section.tsx` uzerinde moduler UI ilk dilimi uygulandi.
- `frontend/features/markets/co-movement/co-movement-section.tsx` uzerinde premium sadeleştirme uygulama dilimi tamamlandi.
- `frontend/features/markets/co-movement/co-movement-section.tsx` uzerinde snapshot/header polish, scoped pair detaylari ve node detay sadeleştirmesi tamamlandi.

# Teknik Detaylar

## Tasarim Benchmark Kaynaklari ve Revize Kararlar

Durum: Plana eklendi - uygulama sirasi bu kararlarin uzerinden ilerleyecek.

Bu revizyon, sadece daha az kart kullanma hedefinden daha yuksek bir UX kalite cikasina gecis kararidir. Sayfa artik "veri raporu" gibi degil, "finansal iliski analizi calisma alani" gibi tasarlanacak. Kaynak alinacak ana prensipler:

- Nielsen Norman Group usability heuristics: sistem durumunu gorunur tut, kullanicinin dilini konus, hatayi onle, kullaniciyi hafizaya zorlamadan tanima uzerinden ilerlet, gereksiz bilgiyi arayuzden cikar.
- Nielsen Norman Group visual design principles: en fazla 2-3 tipografik seviye kullan, olcekle onemi anlat, kontrasti sadece onemli noktalarda kullan, Gestalt/proximity ile ilgili bilgileri birbirine yakin tut.
- Dieter Rams: "less, but better" yaklasimi. Onemsiz olan cikarilacak; kalan her parca daha net, daha kaliteli ve daha islevsel olacak.
- Luke Wroblewski: mobile-first ve "obvious always wins" yaklasimi. Dar ekranda ne kalmasi gerekiyorsa desktop'ta da asil oncelik odur.
- IBM Carbon dashboard guidance: dashboard once buyuk resmi vermeli, sonra kullaniciyi kesfe yonlendirmeli; metrik sayisi sinirlanmali, beyaz/negatif alan bilincli kullanilmali, detaylar drill-down ile acilmali.
- IBM data visualization guidance: grafik basliklari ana insight'i soylemeli, legend/etiketler kisa olmali, grid/cizgi/gorsel gurultu minimumda tutulmali, her renk bir anlam tasimali.
- Stripe dashboard/app UX guidance: kullanici mevcut workflow icinde tutulmali; kisa baglamsal yuzeyler ile derin/focused is akislari ayrilmali; aksiyonlar ilgili nesnenin baglaminda verilmelidir.

Bu kaynaklara gore Co-Movement sayfasinin yeni tasarim ilkeleri:

- Tek ekran, tek niyet: kullanici bulundugu bolumde once "neye bakiyorum?" ve "simdi ne yapabilirim?" sorularini cevaplayabilmeli.
- Ana canvas once: graph/heatmap ve secili odak sayfanin ana uretim alani olacak; metin ve tablo canvas'i destekleyecek.
- Baslik ekonomisi: tab veya ust modul zaten ne oldugunu soyluyorsa ayni baslik tekrar edilmeyecek.
- Detay talep uzerine: Pair ranking, Rolling Stability, Data Quality ve teknik metrikler korunacak ama ana akisi bolmeden tabs/sheet/disclosure altinda verilecek.
- Baglamsal aksiyon: `Yorum Uret`, `Kaydet`, `Ac`, `Yeni analiz` gibi aksiyonlar sadece ilgili analiz/odak yuzeyinde gosterilecek.
- Premium sadelik: border/kart sayisi azalacak; ayrimlar daha cok spacing, ton, ince divider ve tipografik hiyerarsiyle kurulacak.
- Mobil oncelik: mobile'da gereksiz gorunen her tekrar desktop'ta da sorgulanacak.
- Renk disiplini: accent renk sadece aktif secim, guclu iliski, uyarilar ve ana aksiyonda kullanilacak.
- Ekonomik/analitik terimlere saygi: `Hybrid similarity`, `DTW`, `Louvain`, `modularity` gibi terimler saklanmayacak; fakat terim aciklamalari ana metin yerine mikro-yardim/tooltip/detail alaninda tutulacak.

## Oncelikli Mimari Karar - Moduler Sayfa Yapisi

Durum: Uygulaniyor - ilk sadeleştirme dilimi tamamlandi; premium UX revizyonu ile kalite ciktisi yukseltildi.

Bu karar tum fazlarin uzerindedir. Co-Movement sayfasi cok sayida kartin alt alta dizildigi bir rapor sayfasi gibi degil, kullanicinin grafikten odaga, yorumdan detaya kaybolmadan ilerledigi moduler bir analiz calisma alani gibi kurgulanacak.

Ana prensipler:

- Graph ve secili odak sayfanin ana calisma alani olarak kalacak.
- Ozet bilgiler tek tek kartlara bolunmek yerine kompakt metrik seritleri ve durum satirlariyla verilecek.
- Kullanicinin sik ihtiyac duymadigi detaylar `Detay`, `Gelismis Ayarlar`, tab veya acilir panel altinda tutulacak.
- Finansal/analitik terimler saklanmayacak; sadece dogru modulde ve kisa baglamla gosterilecek.
- Kayitli analizler, yorum ve ozel analiz aksiyonlari sayfayi sisirmeden ayni is akisi icinde konumlanacak.
- Her yeni UI parcasi su soruya cevap vermeli: kullanici bu bolumu gorunce bir sonraki aksiyonunu daha hizli anlayacak mi?
- Ayni bilgi iki kez baslik/aciklama olarak verilmeyecek; tekrar varsa daha alt seviye UI metni kaldirilacak.
- Ana sayfada en fazla uc buyuk yuzey olacak: kontrol/composer, analiz canvas'i, detaylar.
- Her yuzeyde tek ana aksiyon olacak; ikincil aksiyonlar overflow, sheet veya detay alanina tasinacak.

## Urun Hedefi

Co-Movement sayfasi teknik demo gibi degil, finansal iliski analizi urunu gibi calismali. Kullanici su sorulara hizli cevap alabilmeli:

- Hangi hisseler birlikte hareket ediyor?
- Hangi community/grup daha belirgin?
- Secili cift veya secili hisseler arasindaki iliski ne kadar guclu?
- Bu iliski sadece genel piyasa icinde mi anlamli, yoksa secili odakta da guclu mu?
- Kendi yaptigim ozel analizi daha sonra tekrar acabilir miyim?

## Hedef Kitle

Hedef kullanici ekonomist, piyasa analisti, finansla ilgilenen yatirimci veya akademik/analitik kullanicidir. Bu nedenle `Hybrid similarity`, `DTW`, `Louvain`, `modularity`, `rolling stability` gibi finansal/analitik kavramlar saklanmayacak. Amac terimleri yok etmek degil, dogru baglamda ve kullaniciyi yormadan sunmaktir.

## Sinirlar

- Backend application kodu degistirilmeyecek.
- Mevcut backend endpoint'leri ve frontend API proxy katmani kullanilacak.
- Graph'ta tum hisseleri gorme kabiliyeti korunacak.
- Mevcut guclu isler bozulmayacak: snapshot gorunumu, ozel analiz, graph, heatmap, pair rankings, rolling stability ve data quality korunacak.
- Frontend-only veya Firebase tabanli gelistirmeler yapilacak.
- Yatirim tavsiyesi ureten dil kullanilmayacak.

## Ana Fazlar

### Faz 0 - Baseline Stabilizasyon

Durum: Tamamlandi.

Amac: Yorum uretme akisinin yarida kesilmemesi ve kullanicinin loading durumunda sayfanin takildigini dusunmemesi.

Teslimatlar:

- Stream tabanli yorum akisi.
- Eksik LLM summary durumunda fallback kullanimi.
- Snapshot ve ozel analiz yorumlari icin gorunur loading state.
- Browser uzerinden temel dogrulama.

Kabul kriterleri:

- `Yorum Uret` tiklandiginda kullanici aninda hazirlaniyor durumunu gorur.
- Final yorum yarim cumleyle bitmez.
- LLM eksik yanit dondururse kullanici temiz fallback metni gorur.

### Faz 1 - Context-Aware Yorum Uretme

Durum: Tamamlandi.

Amac: Yorumun kullanicinin o anda baktigi kapsama gore uretilmesi. Genel snapshot yorumu, secili community yorumu, secili pair yorumu ve secili hisse sepeti yorumu birbirinden ayrilmali.

Kapsamlar:

- `Tüm piyasa`: Mevcut snapshot veya analiz sonucunun genel ozeti.
- `Seçili grup`: Secili community'nin hisseleri, grup ici en guclu pair'ler, ortalama similarity, graph/modularity baglami.
- `Seçili çift`: Sadece secili iki hissenin Pearson, DTW, Hybrid ve varsa rolling stability iliskisi.
- `Seçili hisseler`: Manuel veya focus sembol listesi icindeki pair'ler ve varsa community baglami.

Teslimatlar:

- Frontend'de yorum scope modeli.
- Snapshot icin scope-aware explain payload builder.
- Ozel analiz icin scope-aware explain payload builder.
- UI'da net scope gostergesi: ornek `Odak: G9 · 70 hisse`, `Odak: GARAN-ISCTR`, `Odak: 6 secili hisse`.
- `Yorum Uret` sonucunda kaynak ve kapsam bilgisinin birlikte gosterilmesi.
- Scope degistiginde eski yorumun yanlis kapsamda kalmamasini saglayan state temizligi.

Kabul kriterleri:

- Community seciliyken yorum yalnizca o community hakkinda olur.
- Pair seciliyken yorum yalnizca o iki hisse hakkinda olur.
- Manual/focus semboller seciliyken yorum sadece o semboller arasindaki iliskileri baz alir.
- `Tüm piyasa` moduna donunce genel yorum tekrar uretilebilir.
- Backend endpoint degisikligi gerekmez.

Riskler:

- Backend explain endpoint'i context alanini bilmedigi icin scope'u payload daraltarak anlatacagiz.
- Dar payload cok az veri icerirse fallback yorum fazla kisa olabilir. Bu durumda frontend payload'ina scope etiketi ve yeterli top pair eklemek gerekir.

### Faz 2 - Firebase Tabanli Kayitli Ozel Analizler

Durum: Tamamlandi - frontend servis, hook, temel UI ve Firestore security rules deploy edildi.

Amac: Kullanici ozel analiz yaptiginda sonucu hesabina kaydedebilmeli ve daha sonra tekrar acabilmeli. Bu backend application kodu degistirilmeden Firebase Auth + Firestore ile yapilacak.

Firestore veri modeli:

```txt
users/{uid}/coMovementAnalyses/{analysisId}
users/{uid}/coMovementAnalyses/{analysisId}/matrices/{matrixName}
```

Ana dokuman:

```ts
{
  id: string
  title: string
  createdAt: string
  updatedAt: string
  symbols: string[]
  dateRange: {
    start: string
    end: string
    alignedStart?: string
    alignedEnd?: string
  }
  config: {
    topK: number
    minSimilarity: number
    rollingWindow: number
    rollingStep?: number
  }
  metrics: CoMovementMetrics
  communities: CoMovementCommunity[]
  topPairs: CoMovementPair[]
  pairRankings: CoMovementPairRankings
  graph: {
    nodes: CoMovementNode[]
    edges: CoMovementEdge[]
  }
  rollingStability: CoMovementRollingStabilityRow[]
  dataQuality: CoMovementDataQualityRow[]
  excludedSymbols: CoMovementExcludedSymbol[]
  explanation?: CoMovementExplainResponse
  explanationScope?: string
}
```

Matrix dokumanlari:

```ts
{
  matrixName: 'pearson' | 'spearman' | 'dtw_distance' | 'dtw_similarity' | 'hybrid_similarity'
  symbols: string[]
  matrix: CoMovementMatrixDictionary
}
```

Teslimatlar:

- `co-movement-saved-analyses.service.ts` Firebase servis katmani.
- Firestore converter/helper fonksiyonlari.
- Kaydet, listele, ac, sil, yeniden adlandir aksiyonlari.
- Auth durumuna gore UI: giris yapmamis kullaniciya kaydetme icin giris cagrisi.
- Analiz sonucu geldikten sonra `Analizi Kaydet` aksiyonu.
- Kayitli analiz acildiginda backend'e tekrar analyze istegi atmadan sonucu ekrana basma.
- Kayitli analiz acildiginda yorum, graph, matrix ve detay bolumlerinin normal analiz sonucu gibi calismasi.

Kabul kriterleri:

- Giriş yapmış kullanici ozel analiz sonucunu kaydedebilir.
- Kayitli analizler sayfadan cikilip geri gelindiginde listelenir.
- Kayitli analiz acildiginda graph, pair listesi, community listesi ve yorum gorunur.
- Buyuk matrix payload'lari ana Firestore dokumanini sisirmez.
- Kullanici sadece kendi analizlerini okuyup yazabilir.

Firebase notu:

- Firestore security rules tarafinda `users/{uid}/coMovementAnalyses` icin `request.auth.uid == uid` zorunlu olmali.
- Bu kural frontend kodundan ayri bir altyapi adimidir; prod hazirlik checklist'inde ayrica dogrulanacak.

### Faz 3 - Moduler Bilgi Mimarisi ve Kart Azaltma

Durum: Uygulaniyor - kart azaltma ilk dilimi, kayitli analiz tam liste paneli, yeniden adlandirma ve silme onayi eklendi. Premium UX revizyonu sonrasi bu faz "yuzey azaltma ve baslik ekonomisi" fazina genisletildi. Ozel analiz icindeki tekrar eden baslik kaldirildi; kayitli analizler ana ekranda kompakt giris haline getirildi; metrikler kompakt seride toplandi; snapshot ust durum satiri kaldirildi; detay kartlari tek `Detaylar` tab yuzeyinde toplandi.

Amac: Sayfadaki kart yogunlugunu azaltip ozel analiz, kayitli analiz, yorum ve detay bolumlerini daha moduler bir is akisi haline getirmek. Kaydetme ozelligi de bu yapi icinde kalabalik yaratmadan kullanilabilir olacak. Bu fazda hedef sadece daha az kutu degil; kullanicinin ekranda daha az karar noktasi gorup daha hizli ilerlemesidir.

Teslimatlar:

- Tekrar eden bolum basliklarini kaldirma: tab veya ust yuzey zaten `Ozel Analiz` diyorsa icerde tekrar ayni baslik ve aciklama gosterilmeyecek.
- Sayfayi uc ana yuzeye indirme: `Composer`, `Analysis Canvas`, `Details`.
- Snapshot ve ozel analiz ozet metrikleri icin tek kompakt metrik seridi.
- Ozel analiz sonucu, donem/config bilgisi ve `Analizi Kaydet` aksiyonu icin tek aksiyon satiri.
- Ozel analiz sekmesinde buyuk `Kayitli Analizler` karti yerine kompakt `Kayitli analiz ac` girisi.
- Son analizler icin sadece 2-3 satirlik hafif liste veya tek dropdown/sheet girisi.
- Tum kayitlari gormek icin acilir panel veya modal; ana canvas'ta surekli yer kaplamayacak.
- Her kayitta: baslik, sembol sayisi, tarih araligi, grup sayisi ve en guclu pair.
- Kayit acma, silme ve yeniden adlandirma.
- Kayitli analiz acik oldugunda net durum etiketi: `Kayitli analiz · Analiz adi`.
- Kayitli analizden yeni analiz parametrelerine donme aksiyonu.
- `Pair siralamalari`, `Rolling stability`, `Veri kalitesi` gibi alt detaylar ana akis yerine tek `Detaylar` alaninda tab'lerle gosterilecek.
- Kart border'lari azaltilacak; ayrimlar spacing, divider, opacity ve tipografiyle kurulacak.

Kabul kriterleri:

- Kullanici ilk bakista grafik, odak, yorum ve detaylar arasindaki hiyerarsiyi anlar.
- Ozet metrikler ekranda daha az yer kaplar ama finansal anlamini kaybetmez.
- Kullanici kayitli analiz ile yeni analiz formunu karistirmaz.
- Kayitli analiz acildiginda sayfa reload olmadan sonuc gorunur.
- Silme islemi yanlislikla yapilmaz; onay gerekir.
- Bos liste, loading ve hata durumlari sade ve anlasilir olur.
- Ayni ekranda ayni anlamdaki baslik/aciklama iki kez gorunmez.
- Ana ekranda kullaniciya ayni anda birden fazla birincil CTA verilmez.

### Faz 4 - Ozel Analiz Akisini Sadelestirme

Durum: Uygulaniyor - `Top K`, `Min Benzerlik` ve `Rolling Window` varsayilan kapali `Gelismis Ayarlar` modulune alindi; analiz hazirlik ozeti, aksiyon odakli hata yonlendirmesi ve baslik tekrarsiz composer yapisi eklendi.

Amac: Analitik gucu koruyup ilk kullanimdaki karmasayi azaltmak. Ozel analiz, rapor bolumu gibi degil, kullanicinin hizli sekilde analiz kurdugu premium bir composer gibi davranacak.

Teslimatlar:

- Ana akista sadece hisse secimi, tarih araligi ve `Analizi Calistir`.
- Composer icinde tekrar eden `Ozel Analiz` basligi kaldirilacak; ust tab zaten baglami tasiyacak.
- Hisse secimi, tarih araligi ve analiz durumu tek yuzeyde gruplanacak.
- Kayitli analiz acma aksiyonu composer icinde ikincil, sade bir giris olarak konumlanacak.
- `Top K`, `Min Benzerlik`, `Rolling Window` gibi ayarlar `Gelismis Ayarlar` altina alinacak.
- Secilen hisse sayisi, tarih araligi ve analiz hazirligi ustte kisa bir summary olarak gosterilecek.
- Hata mesajlari kullanici aksiyonuna baglanacak: ornek `En az 2 hisse secin`, `Tarih araligi gecersiz`, `Bazi hisselerde yeterli veri yok`.
- Hazirlik ozeti bilgi karti gibi degil, formun karar satiri gibi gorunecek.
- Formda label/aciklama tekrarlarinin her biri gereklilik testinden gececek: kullanici aksiyonunu degistirmiyorsa kaldirilacak.

Kabul kriterleri:

- Yeni kullanici ozel analiz baslatmak icin ayar kalabaligina maruz kalmaz.
- Gelismis kullanici ayarlari acip degistirebilir.
- Mevcut backend request parametreleri korunur.
- Ozel analiz bolumunde ayni amaci anlatan iki baslik/metin bulunmaz.
- Analiz calistirma akisi mobile'da tek kolon ve tek ana aksiyonla tamamlanir.

### Faz 5 - Graph ve Odak Deneyimi Polishi

Durum: Uygulaniyor - snapshot ve ozel analiz graph alanlarina gorunur `Odak` satiri ve `Tum piyasaya don` aksiyonu eklendi. Graph yan paneli mobile'da dikey akisa alinip desktop'ta yan panel olarak korunacak sekilde duzenlendi. Snapshot yenileme aksiyonu graph header'ina ikon buton olarak tasindi.

Amac: Mevcut graph davranisini bozmadan kullanicinin odagini kaybetmemesini saglamak. Graph sayfanin "ana canvas"i oldugu icin diger yuzeyler graph'i desteklemeli, onunla yarisarak dikkat dagitmamalidir.

Teslimatlar:

- Tum piyasa graph'i korunacak.
- Community, pair veya manuel sembol seciminde odak net gosterilecek.
- `Tüm piyasaya dön` aksiyonu daha belirgin olacak.
- Secili node/edge/community icin yan panel veya mevcut detay alani daha net hale getirilecek.
- Graph'ta performans ve okunabilirlik sorunu varsa sadece gerekli minimal iyilestirme yapilacak.
- Graph odak bilgisi ve yorum kapsami ayni dili kullanacak: `Tum piyasa`, `Secili grup`, `Secili cift`, `Secili hisseler`.
- Graph yan/alt detay paneli kart gibi sisirilmeyecek; secime bagli minimal insight paneli olacak.
- Graph ile Heatmap/Pair/Ranking alanlari linked-chart mantigiyla birbirini destekleyecek; secim degisince detaylar ayni odaga gore filtrelenecek veya kapsam belirtilecek.
- Mobile'da graph kontrol ve detaylari drawer/sheet mantigina alinacak; sabit yan panel kullanilmayacak.

Kabul kriterleri:

- Kullanici tum hisseleri gormeye devam eder.
- Secim yapinca odak degisir ve neye baktigi net gorunur.
- Graph degisikligi mevcut iyi calisan etkilesimi bozmaz.
- Secili odak degistiginde yorum, detay ve grafik baglami birbiriyle celismez.

### Faz 6 - Detay Alanlari ve Finansal Terim Dengesi

Durum: Uygulaniyor - premium UX revizyonu sonrasi detaylar "talep uzerine profesyonel analiz" yuzeyine donusturuldu. Heatmap, Pair'ler, Rolling ve Veri Kalitesi tek `Detaylar` tab yuzeyinde toplandi; `Topluluklar` tekrar eden detay tab'i kaldirildi.

Amac: Teknik/finansal metrikleri saklamadan daha okunabilir bir bilgi mimarisi kurmak. Detaylar, ana canvas'in altinda kart yiginina donusmeyecek; profesyonel kullanicinin ihtiyac duydugunda acacagi net bir analiz katmani olacak.

Teslimatlar:

- Heatmap, pair rankings, rolling stability ve data quality korunacak.
- Ana ekran karar akisini bolmeyecek sekilde tek `Detaylar` bolumunde gruplanacak.
- Detaylar icinde tab yapisi: `Heatmap`, `Pair'ler`, `Rolling`, `Veri Kalitesi`.
- Varsayilan detay tab'i kullanicinin son odagina gore akilli secilecek; pair secildiyse `Pair'ler`, grup secildiyse `Heatmap` veya community ic pair gorunumu one cikacak.
- `Hybrid similarity`, `DTW`, `Louvain`, `modularity` terimleri korunacak.
- Gereken yerlerde kisa tooltip veya mikro-aciklama kullanilacak; uzun aciklama metinleriyle sayfa sisirilmeyecek.
- Tablo basliklari ana insight'i soyleyecek; sadece teknik kolon ismi tekrar etmeyecek.
- Renk, badge ve vurgu sadece analitik anlam tasidiginda kullanilacak.

Kabul kriterleri:

- Finansal/analitik kullanici metriklere ulasabilir.
- Yeni kullanici metrik kalabaliginda kaybolmaz.
- Terimlerin anlamini merak eden kullanici kisa yardim alabilir.
- Detaylar kapaliyken ana analiz deneyimi eksik veya kirik hissettirmez.
- Detaylar acikken de ayni anda birden fazla gereksiz kart basligi gorunmez.

### Faz 7 - Prod Hazirlik, Test ve Dokumantasyon

Durum: Planlandi.

Amac: Sayfayi sadece calisir hale degil, prod'da guvenilir kullanilabilir hale getirmek.

Teslimatlar:

- Context-aware yorum icin unit veya component-level testler.
- Firebase service icin mock'lu testler.
- Browser QA senaryolari:
  - Piyasa gorunumu genel yorum.
  - Community yorumu.
  - Pair yorumu.
  - Ozel analiz calistirma.
  - Ozel analizi Firebase'e kaydetme.
  - Kayitli analizi acma.
  - Kayitli analizi silme.
  - Giriş yapmamis kullanici kaydetme deneyimi.
- Responsive kontrol: desktop ve mobile.
- Firestore rules kontrolu.
- Her tamamlanan faz icin `docs/co-movement/YYYY-MM-DD/...` altinda rapor.

Kabul kriterleri:

- Lint ve ilgili testler gecer.
- In-app browser uzerinden ana akislar dogrulanir.
- Kayitli analizler kullanici bazli izole calisir.
- Sayfa backend app kodu degistirilmeden prod'a hazir frontend deneyimi sunar.

# Kontrol Listesi

- [x] Co-Movement sayfasinin urun amaci netlestirildi.
- [x] Backend application koduna dokunmama karari netlestirildi.
- [x] Finansal/analitik terimleri saklamama karari netlestirildi.
- [x] Sektor UX benchmark kaynaklari incelendi ve premium sadeleştirme prensipleri plana eklendi.
- [x] Faz 0 baseline yorum stabilizasyonu tamamlandi.
- [x] Faz 1 context-aware yorum uretme uygulanacak.
- [x] Faz 2 Firebase tabanli kayitli analizler uygulanacak.
- [x] Faz 3 moduler sayfa yapisi plana eklendi ve ilk kart azaltma dilimi uygulandi.
- [x] Faz 3 kayitli analiz tam liste, yeniden adlandirma ve silme onayi uygulandi.
- [x] Faz 3 premium revizyon: tekrar eden basliklari kaldir, sayfayi `Composer`, `Analysis Canvas`, `Details` yuzeylerine indir.
- [ ] Faz 3 kalan polish: girisli kullanici ile Firebase e2e rename/delete QA ve mobil sheet kontrolu.
- [x] Faz 4 ozel analiz akisi icin gelismis ayarlar varsayilan kapali hale getirildi.
- [x] Faz 4 analiz hazirlik ozeti ve aksiyon odakli form kilidi eklendi.
- [x] Faz 4 premium revizyon: ozel analiz composer'ini sade, tek aksiyonlu ve baslik tekrarsiz hale getir.
- [x] Faz 4 kalan polish: backend hata mesajlarini daha temiz kullanici diline cevirmek.
- [x] Faz 5 graph odak satiri ve tum piyasaya don aksiyonu eklendi.
- [x] Faz 5 premium revizyon: graph, yorum ve detay kapsamlarini linked insight mantigiyla ayni odaga bagla.
- [x] Faz 5 kalan polish: mobil graph/yan panel ergonomisi ve secili node/community detaylari.
- [x] Faz 6 detay alanlari tek `Detaylar` tab yuzeyinde toplanacak.
- [x] Snapshot ust durum satiri kaldirildi; yenileme butonu graph header'ina tasindi.
- [x] Hero basligi sade `Co_movement` basligina indirildi.
- [x] Detaylarda `Topluluklar` tekrar tab'i kaldirildi.
- [x] `En Guclu Eslesmeler` ve `Pair Siralamalari` secili odaga/gruba gore filtrelenecek sekilde guncellendi.
- [x] Graph hisse detay karti yalniz hisse adi ve grup bilgisini gosterecek sekilde sadeleştirildi.
- [ ] Faz 7 prod hazirlik ve QA tamamlanacak.

# Bilinen Sorunlar / Eksikler

- Firebase security rules `evalon-auths` projesine deploy edildi; kullanici izolasyonu `request.auth.uid == uid` kuralina bagli.
- Firestore dokuman boyutu limiti nedeniyle matrix verileri ana analiz dokumanina gomulmemeli.
- Kayitli analizler Firebase ile yapilirsa misafir kullanici icin kaydetme deneyimi ayrica kararlastirilmeli.
- Context-aware yorum icin backend degismeyeceginden kapsam bilgisi frontend payload daraltma ve UI state ile yonetilecek.
- Local fallback yorumlarinda Turkce karakter kalitesi daha sonra iyilestirilmeli.
- Girisli kullanici ile Firebase rename/delete e2e QA henuz yapilmadi; veri degistiren islem oldugu icin ayrica onayli test edilmeli.
- Detay tab'lari tek yuzeyde toplandi; ileride secili odaga gore varsayilan tab secimi daha akilli hale getirilebilir.
