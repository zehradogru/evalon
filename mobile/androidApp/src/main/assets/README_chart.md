# Grafik ekranı – CDN / offline

## Grafiğin gelmemesinin olası nedenleri

1. **İnternet kapalı veya CDN’e erişilemiyor**  
   `chart.html` önce yerel dosyayı dener, yoksa `unpkg.com` CDN’inden yükler. İnternet yoksa ve yerel dosya da yoksa grafik yüklenmez.

2. **CDN yavaş veya engelli**  
   Emülatör/cihazda ağ kısıtı, firewall veya yavaş bağlantı CDN’in yüklenmesini engelleyebilir.

3. **WebView’da script henüz yüklenmeden veri gönderilmesi**  
   Sayfa bitti sanılıp veri enjekte edilirken kütüphane hâlâ yükleniyor olabilir (zamanlama).

## Offline (internet olmadan) çalışması için

Aşağıdaki dosyayı indirip `androidApp/src/main/assets/` içine koyun:

- **Dosya adı:** `lightweight-charts.standalone.production.js`  
- **İndirme adresi:**  
  https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js  

Tarayıcıda bu adresi açıp “Farklı kaydet” ile veya `curl`/wget ile indirip bu klasöre `lightweight-charts.standalone.production.js` adıyla kaydedin. Böylece grafik internet olmadan da çalışır.
