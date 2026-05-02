# Evalon Mobil Uygulama - Kurulum Rehberi

## Android Studio Kurulumu (ÖNERİLEN)

Android Studio, Kotlin Multiplatform Mobile (KMP) geliştirme için en iyi seçenektir.

### Adımlar:

1. **Android Studio'yu İndirin**
   - https://developer.android.com/studio adresinden indirin
   - "Download Android Studio" butonuna tıklayın
   - İşletim sisteminize uygun versiyonu seçin (Windows/Mac/Linux)

2. **Kurulum**
   - İndirilen dosyayı çalıştırın
   - Kurulum sihirbazını takip edin
   - Android SDK'yı otomatik olarak indirecek (yaklaşık 2-3 GB)

3. **Projeyi Açma**
   - Android Studio'yu açın
   - "Open" seçeneğini tıklayın
   - `evalon` klasörünü seçin
   - Gradle sync'in tamamlanmasını bekleyin (ilk açılışta 5-10 dakika sürebilir)

4. **Emulator Kurulumu (Test için)**
   - Android Studio'da "Device Manager" açın
   - "Create Device" butonuna tıklayın
   - Bir telefon modeli seçin (örn: Pixel 6)
   - Sistem görüntüsü seçin (API 33 veya 34 önerilir)
   - Emulator'ü başlatın

5. **Uygulamayı Çalıştırma**
   - Emulator çalışırken
   - Android Studio'da üst menüden "androidApp" konfigürasyonunu seçin
   - Yeşil "Run" butonuna tıklayın (veya Shift+F10)

## Alternatif Yöntemler

### 1. IntelliJ IDEA (KMP için de uygun)
- IntelliJ IDEA Ultimate veya Community Edition
- Kotlin Multiplatform Mobile plugin'i yükleyin
- Android Studio ile benzer özellikler

### 2. Komut Satırı (CLI) - Gelişmiş Kullanıcılar için
```bash
# Gradle ile build
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew :androidApp:assembleDebug

# APK dosyası oluşturulur
# androidApp/build/outputs/apk/debug/androidApp-debug.apk
```

`SDK location not found` hatası alırsanız proje kökünde `local.properties` dosyası oluşturup Android SDK yolunu tanımlayın:

```properties
sdk.dir=/Users/aliberkyesilduman/Library/Android/sdk
```

### 3. VS Code (Sınırlı Desteği)
- Kotlin extension yükleyin
- Ancak Android emulator çalıştıramazsınız
- Sadece kod editörü olarak kullanılabilir

## İlk Çalıştırma İçin Gereksinimler

- **Java JDK 17 veya 21** önerilir
- **Not:** Bu projede Gradle, sistemde kurulu `JDK 25` ile sorun çıkarabiliyor. Android Studio içinde Gradle JDK olarak `17` veya `21` seçin.
- **En az 8 GB RAM** (16 GB önerilir)
- **En az 10 GB boş disk alanı** (SDK + Emulator için)
- **İnternet bağlantısı** (ilk sync için)

## Sorun Giderme

### Gradle Sync Hatası
- File > Invalidate Caches / Restart
- Build > Clean Project
- Tekrar sync edin

### Emulator Yavaş Çalışıyorsa
- Emulator ayarlarından RAM'i artırın
- HAXM veya Hyper-V'yi etkinleştirin
- Daha düşük çözünürlüklü emulator kullanın

### iOS Test İçin
- macOS gereklidir
- Xcode kurulu olmalı
- iOS Simulator kullanılabilir
- Firebase pod entegrasyonu nedeniyle iOS tarafını `iosApp/Evalon.xcworkspace` ile açın

## Hızlı Başlangıç

1. Android Studio'yu açın
2. Projeyi import edin
3. Emulator başlatın
4. Run butonuna basın
5. Login ekranını görün! 🎉

## İletişim

Sorun yaşarsanız:
- Android Studio loglarını kontrol edin
- Gradle sync hatalarını okuyun
- Proje README.md dosyasına bakın
