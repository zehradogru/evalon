# iOS Modülü Ekleme Planı

## 📱 Mevcut Durum

### ✅ Hazır Olanlar:
1. **Shared Module** - iOS target'ları zaten yapılandırılmış
   - `iosX64`, `iosArm64`, `iosSimulatorArm64` target'ları var
   - iOS-specific kodlar hazır (`iosMain/`)
   - `MainViewController()` fonksiyonu hazır

2. **iOS-Specific Implementations**:
   - `TokenStorage.ios.kt` - iOS Keychain entegrasyonu
   - `EvalonApiClient.ios.kt` - Ktor Darwin client
   - `Main.kt` - iOS entry point

### ❌ Eksik Olanlar:
- **iOS App Modülü** (Xcode projesi)
- Xcode proje yapılandırması
- Info.plist dosyası
- iOS app bundle identifier

---

## 🎯 iOS Modülü Ekleme Adımları

### Yöntem 1: Manuel Oluşturma (Önerilen)

#### Adım 1: Xcode Projesi Oluştur
```bash
# Xcode'da yeni bir iOS App projesi oluştur
# - Product Name: Evalon
# - Organization Identifier: com.evalon
# - Language: Swift (veya Objective-C)
# - Interface: SwiftUI (Compose Multiplatform ile uyumlu)
```

#### Adım 2: Shared Framework'ü Entegre Et
1. **Gradle ile Framework Build Et:**
   ```bash
   ./gradlew :shared:embedAndSignAppleFrameworkForXcode
   ```
   Bu komut iOS framework'ünü oluşturur.

2. **Xcode'da Framework Ekle:**
   - Xcode projesinde "Frameworks" klasörüne sağ tık
   - "Add Files to Evalon" seç
   - `shared/build/xcode-frameworks/` klasöründen `shared.framework` seç
   - "Copy items if needed" işaretle

#### Adım 3: Bridging Header Oluştur (Swift için)
```swift
// Evalon-Bridging-Header.h
#import <shared/shared.h>
```

#### Adım 4: App Entry Point Oluştur
```swift
// App.swift veya AppDelegate.swift
import SwiftUI
import shared

@main
struct EvalonApp: App {
    var body: some Scene {
        WindowGroup {
            ComposeView()
        }
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        return MainViewController()
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
```

#### Adım 5: Build Settings Ayarla
- **Framework Search Paths**: `$(SRCROOT)/../shared/build/xcode-frameworks`
- **Other Linker Flags**: `-framework shared`
- **Swift Compiler - General**: Bridging header path'i ekle

---

### Yöntem 2: Gradle ile Otomatik (Daha Kolay)

#### Adım 1: iOS App Modülü Oluştur
```kotlin
// settings.gradle.kts'e ekle:
include(":iosApp")

// iosApp/build.gradle.kts oluştur:
plugins {
    kotlin("multiplatform")
    id("com.android.library") // iOS için de gerekli
}

kotlin {
    iosX64()
    iosArm64()
    iosSimulatorArm64()
    
    sourceSets {
        val iosMain by creating {
            dependencies {
                implementation(project(":shared"))
            }
        }
    }
}
```

#### Adım 2: Xcode Integration
Gradle'ın Xcode entegrasyonu ile otomatik framework oluşturma.

---

## 📋 Detaylı Plan

### Splash Ekranı ve Logo (Hazırlık)

- [ ] Evalon logosunu `iosApp/Assets.xcassets` altında `EvalonLogo` adlı bir image set olarak ekle.
- [ ] Launch Screen (Storyboard veya SwiftUI) içinde bu logoyu ortalanmış şekilde kullan:

```swift
// LaunchScreen.swift (örnek SwiftUI tabanlı yaklaşım)
import SwiftUI

struct LaunchScreenView: View {
    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.06, blue: 0.09) // Android'deki splash_background rengine yakın koyu ton
                .ignoresSafeArea()

            Image("EvalonLogo") // Assets.xcassets içindeki logo ismi
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 240)
        }
    }
}
```

Bu yapı, Android'de tanımladığımız `Theme.Evalon.Splash` ile görsel olarak uyumlu bir launch/splash deneyimi sağlar. iOS modülü ve Xcode projesi oluşturulduğunda bu ekran doğrudan Launch Screen olarak bağlanabilir.

### Faz 1: Temel Yapı (1-2 gün)
- [ ] Xcode projesi oluştur
- [ ] Shared framework'ü entegre et
- [ ] Basit bir "Hello World" ekranı göster
- [ ] Build ve run test et

### Faz 2: Compose Entegrasyonu (1 gün)
- [ ] ComposeUIViewController entegrasyonu
- [ ] App() fonksiyonunu çağır
- [ ] Login ekranını iOS'ta görüntüle

### Faz 3: Platform-Specific Özellikler (2-3 gün)
- [ ] iOS Keychain entegrasyonu (TokenStorage)
- [ ] iOS-specific navigation patterns
- [ ] iOS UI/UX iyileştirmeleri
- [ ] Push notification setup (gelecekte)

### Faz 4: Test ve Optimizasyon (1-2 gün)
- [ ] iOS Simulator'de test
- [ ] Gerçek cihazda test
- [ ] Performance optimizasyonu
- [ ] Memory leak kontrolü

---

## 🔧 Teknik Detaylar

### Shared Framework Yapısı
```
shared/
├── build/
│   └── xcode-frameworks/
│       └── shared.framework/  ← iOS için build edilen framework
│           ├── shared (binary)
│           ├── Headers/
│           └── Info.plist
```

### iOS App Yapısı
```
iosApp/
├── Evalon/
│   ├── App.swift              ← SwiftUI entry point
│   ├── ComposeView.swift      ← Compose bridge
│   ├── Info.plist
│   └── Assets.xcassets
├── Evalon.xcodeproj
└── Evalon.xcworkspace
```

### Build Komutları
```bash
# Shared framework build
./gradlew :shared:embedAndSignAppleFrameworkForXcode

# iOS app build (Xcode'dan)
# Product > Build (Cmd+B)
# Product > Run (Cmd+R)
```

---

## ⚠️ Önemli Notlar

### Gereksinimler:
1. **macOS** - iOS geliştirme için zorunlu
2. **Xcode** - En son versiyon (15.0+)
3. **Apple Developer Account** - Gerçek cihaz test için (ücretsiz hesap yeterli)
4. **CocoaPods** (opsiyonel) - Dependency management için

### Sınırlamalar:
- iOS geliştirme sadece macOS'ta yapılabilir
- Windows/Linux'ta sadece Android geliştirme yapılabilir
- iOS Simulator sadece macOS'ta çalışır

### Avantajlar:
- **Tek Kod Tabanı**: Shared modüldeki tüm kod iOS'ta da çalışır
- **Compose Multiplatform**: Aynı UI kodu her iki platformda
- **Native Performance**: Framework native olarak compile edilir

---

## 🚀 Hızlı Başlangıç (macOS'ta)

```bash
# 1. Shared framework'ü build et
./gradlew :shared:embedAndSignAppleFrameworkForXcode

# 2. Xcode'da yeni proje oluştur
# 3. Framework'ü ekle
# 4. ComposeView.swift oluştur
# 5. Run! 🎉
```

---

## 📝 Sonuç

**iOS modülü eklemek için:**
1. macOS + Xcode gereklidir
2. Shared framework zaten hazır
3. Sadece Xcode projesi oluşturup framework'ü entegre etmek yeterli
4. Compose Multiplatform sayesinde UI kodu zaten hazır!

**Şu an için:**
- Android geliştirmeye devam edebilirsiniz
- iOS modülü gerektiğinde (macOS'ta) kolayca eklenebilir
- Shared kod zaten iOS-ready! ✅
