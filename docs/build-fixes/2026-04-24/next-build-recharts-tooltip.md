# Next Build Recharts Tooltip Düzeltmesi

## Özet

Next.js üretim derlemesinde Recharts `Tooltip` formatter tipleri nedeniyle oluşan TypeScript hatası giderildi. Ayrıca Next.js'in çoklu lockfile nedeniyle yanlış workspace root tahmini yapmasını engellemek için Turbopack root ayarı eklendi.

## Değişiklik Listesi

- `frontend/features/dashboard/main-chart.tsx`: Tooltip formatter parametre tipi Recharts tarafından infer edilecek şekilde güncellendi.
- `frontend/features/landing/market-overview-section.tsx`: Tooltip formatter parametre tipi Recharts ile uyumlu hale getirildi.
- `frontend/features/paper-trade/portfolio-chart.tsx`: Tooltip formatter içindeki mutable array tip beklentisi kaldırıldı.
- `frontend/features/paper-trade/time-machine-panel.tsx`: Tooltip formatter parametre tipi Recharts ile uyumlu hale getirildi.
- `frontend/next.config.ts`: `turbopack.root` değeri `process.cwd()` olarak ayarlandı.
- `frontend/package.json`: Next.js sürümü `^16.2.4` olarak güncellendi.
- `frontend/package-lock.json`: Next.js sürüm güncellemesine bağlı lockfile değişiklikleri eklendi.

## Teknik Detaylar

- Recharts `Tooltip` formatter değeri sadece `number` olmayabilir; `ValueType` içinde `string` ve readonly array değerleri de bulunabilir. Bu nedenle callback parametreleri dar tiplerle annotate edilmek yerine JSX context typing'e bırakıldı.
- Sayısal gösterimler `Number(value ?? 0)` ile formatlanarak mevcut tooltip çıktıları korunmaya çalışıldı.
- Next.js 16.2.4 Turbopack, parent dizindeki lockfile'ı workspace root olarak seçtiği için `next.config.ts` içine `turbopack.root` eklendi.
- `package.json` ve `package-lock.json` dosyalarındaki Next.js 16.2.4 güncellemesi commit kapsamına dahil edildi.
- API endpoint veya yeni domain type eklenmedi.

## Kontrol Listesi (Checklist)

1. `frontend` dizininde `npm run build` komutunu çalıştır.
2. Build çıktısında TypeScript hatası olmadığını doğrula.
3. Build çıktısında workspace root uyarısının görünmediğini doğrula.
4. Dashboard ana grafik tooltip'ini kontrol et.
5. Landing market overview tooltip'ini kontrol et.
6. Paper trade portföy grafiği ve time machine grafiği tooltip formatlarını kontrol et.

## Bilinen Sorunlar / Eksikler

- Tooltip davranışları üretim derlemesiyle doğrulandı, tarayıcı üzerinde manuel görsel kontrol yapılmadı.
