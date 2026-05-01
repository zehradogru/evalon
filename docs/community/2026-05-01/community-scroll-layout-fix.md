## Ozet

Community feed ve post detail ekranlarinda, genis viewportlarda icerik footer'dan once kirpiliyor ve sayfa scroll uretmiyordu. Koku flex item'in shrink olmasini engelleyip yatay aurora tasmasini koruyarak bu layout kirilmasi duzeltildi.

## Degisiklik Listesi

- `frontend/features/community/community-view.tsx` guncellendi.
- `frontend/features/community/post-detail-view.tsx` guncellendi.

## Teknik Detaylar

- Sorun, `DashboardShell` icindeki `main` alaninin `flex flex-col` olmasi ve community ekranlarinin kok wrapper'inin varsayilan `flex-shrink: 1` davranisiyla daralmasindan kaynaklaniyordu.
- Koku wrapper `overflow-hidden` kullandigi icin daralan alandan tasan feed kartlari ve detail icerigi gorunmeden kirpiliyordu; bu da footer'in erken yukari cikmis gibi gorunmesine neden oluyordu.
- Her iki community kok wrapper'ina `shrink-0` eklendi; boylece icerik kendi dogal yuksekligini koruyor ve `main` tekrar dogru scroll yuksekligi hesapliyor.
- `overflow-hidden`, dikey icerigi kesmemesi icin `overflow-x-hidden` olarak daraltildi. Aurora/background tasmalari yatay eksende kliplenmeye devam ediyor.

## Kontrol Listesi

1. `/community` sayfasini genis desktop viewport'ta ac.
2. Feed kartlari footer'dan once kesilmiyor mu kontrol et.
3. Fare tekerlegi veya trackpad ile sayfanin asagi kayabildigini dogrula.
4. Footer'in artik feed sonrasinda geldigini dogrula.
5. `/community/[postId]` detay sayfasini ac.
6. Detay icerigi, yorum paneli ve related posts alaninin footer tarafindan kesilmedigini kontrol et.
7. Mobil ve dar viewport'ta hero arka plan tasmasinin yatay scroll olusturmadigini kontrol et.

## Bilinen Sorunlar / Eksikler

- `DashboardShell` icindeki diger uzun sayfalar ayni shrink desenini kullaniyorsa benzer bir risk tasiyabilir; bu duzeltme community ekranlarina hedefli uygulanmistir.
