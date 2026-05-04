# Calendar Spacer Null Check

## Özet
Takvim görünümünde production build'i durduran `eventListRef` nullability hatası giderildi. Resize callback'i artık başlangıçta doğrulanmış liste elemanını sabit yerel referans üzerinden kullanır.

## Değişiklik Listesi
- Değiştirildi: `frontend/features/calendar/calendar-view.tsx`
- Eklendi: `docs/calendar/2026-05-05/calendar-spacer-null-check.md`

## Teknik Detaylar
- `useEffect` içinde `eventListRef.current` null kontrolünden geçtikten sonra `listElement` sabitine atanır.
- `updateSpacer` ve `ResizeObserver.observe` aynı doğrulanmış DOM elemanını kullanır.
- Takvim davranışı, spacer hesabı ve resize observer akışı değiştirilmedi.

## Kontrol Listesi (Checklist)
1. `frontend` dizininde `npx eslint features/calendar/calendar-view.tsx` çalıştır.
2. `frontend` dizininde `npm run build` çalıştır.
3. Takvim sayfasını açıp etkinlik listesi yüksekliğine göre alt spacer davranışını kontrol et.
4. Pencere boyutu değiştiğinde spacer hesabının güncellendiğini doğrula.

## Bilinen Sorunlar / Eksikler
- Bilinen ek sorun yok.
