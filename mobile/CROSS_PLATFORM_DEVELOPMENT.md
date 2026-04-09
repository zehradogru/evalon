# Cross-Platform Geliştirme Rehberi

## 🖥️ Windows'ta Geliştirme (Ana Geliştirme Ortamı)

### ✅ Yapabilecekleriniz:

1. **Android Geliştirme**
   - Android Studio'da tam geliştirme
   - Android emulator çalıştırma
   - Android build ve test
   - Android-specific kod yazma

2. **Shared Module Geliştirme**
   - Tüm business logic (Domain layer)
   - API client kodları (Data layer)
   - Compose UI kodları (Presentation layer)
   - ViewModels, Use Cases, Repositories
   - **iOS'ta da çalışacak tüm kodlar!**

3. **Kotlin Multiplatform Kodları**
   - `commonMain/` klasöründeki tüm kodlar
   - Platform-specific implementasyonlar (`expect/actual`)
   - iOS için de geçerli olan tüm kodlar

### ❌ Yapamayacaklarınız:

1. **iOS Build/Test**
   - iOS Simulator çalıştıramazsınız
   - iOS cihazda test edemezsiniz
   - iOS-specific Xcode ayarları yapamazsınız

2. **iOS App Modülü Değişiklikleri**
   - `iosApp/` klasöründeki Swift dosyaları
   - Xcode proje ayarları
   - iOS Info.plist değişiklikleri

---

## 🍎 macOS'ta Geliştirme (iOS için)

### ✅ Yapabilecekleriniz:

1. **iOS Geliştirme**
   - Xcode'da iOS projesi geliştirme
   - iOS Simulator çalıştırma
   - Gerçek iOS cihazda test
   - iOS build ve App Store'a yükleme

2. **Her Şey (Windows'taki gibi)**
   - Android geliştirme (Android Studio macOS'ta da var)
   - Shared module geliştirme
   - Tüm Kotlin kodları

---

## 📋 Geliştirme Senaryoları

### Senaryo 1: Windows'ta Ana Geliştirme

```
Windows (Ana Geliştirme)
├── Android Studio açık
├── Shared kod yazıyorsunuz
├── Android test ediyorsunuz
└── Git'e commit/push yapıyorsunuz

macOS (Sadece iOS için)
├── Git'ten pull yapıyorsunuz
├── iOS build/test yapıyorsunuz
└── iOS-specific değişiklikler varsa yapıyorsunuz
```

### Senaryo 2: Shared Kod Değişikliği

```
1. Windows'ta:
   - Shared kodda değişiklik yap
   - Android'de test et
   - Git'e commit et

2. macOS'ta (opsiyonel):
   - Git'ten pull yap
   - iOS'ta test et
   - Her şey çalışıyorsa tamam!
```

### Senaryo 3: Yeni Özellik Ekleme

```
1. Windows'ta:
   - Yeni screen/feature ekle (Compose)
   - ViewModel yaz
   - Repository implement et
   - Android'de test et
   - Git'e commit et

2. macOS'ta:
   - Git'ten pull yap
   - iOS'ta otomatik çalışır! (Compose Multiplatform)
   - Sadece test et, kod değişikliği gerekmez
```

---

## 🎯 Pratik Yaklaşım

### Günlük Geliştirme (Windows'ta)

```kotlin
// shared/src/commonMain/kotlin/...
// ✅ Burada yazdığınız her şey iOS'ta da çalışır!

class NewFeatureViewModel {
    // Business logic
}

@Composable
fun NewFeatureScreen() {
    // UI - iOS'ta da aynı görünür!
}
```

### iOS Test (macOS'ta - Haftada 1-2 kez)

```bash
# macOS'ta:
git pull
# Xcode'da aç
# Build & Run
# Test et
# Her şey çalışıyorsa tamam!
```

---

## 📁 Proje Yapısı ve Platform Bağımlılığı

```
evalon/
├── shared/                    ← Windows'ta geliştir ✅
│   ├── commonMain/           ← Her iki platformda çalışır
│   ├── androidMain/          ← Windows'ta geliştir ✅
│   └── iosMain/              ← Windows'ta geliştir ✅
│
├── androidApp/                ← Windows'ta geliştir ✅
│   └── MainActivity.kt
│
└── iosApp/                    ← macOS'ta geliştir ❌
    ├── App.swift
    └── ComposeView.swift
```

**Önemli:** `iosMain/` klasöründeki Kotlin kodlarını Windows'ta yazabilirsiniz! Sadece `iosApp/` (Xcode projesi) macOS'ta olmalı.

---

## 🔄 Git Workflow

### Windows'ta (Günlük)

```bash
# 1. Feature branch oluştur
git checkout -b feature/new-screen

# 2. Kod yaz (shared/, androidApp/)
# 3. Android'de test et
# 4. Commit & Push
git add .
git commit -m "Add new feature screen"
git push origin feature/new-screen
```

### macOS'ta (Haftalık/İhtiyaç Olduğunda)

```bash
# 1. Pull yap
git pull

# 2. iOS'ta test et
# 3. Her şey çalışıyorsa merge et
# 4. iOS-specific değişiklik varsa yap ve commit et
```

---

## ⚡ Hızlı Cevap

### Soru: macOS'ta iOS modülü ekledikten sonra Windows'ta devam edebilir miyim?

**CEVAP: EVET! ✅**

- ✅ Windows'ta Android geliştirmeye devam edebilirsiniz
- ✅ Shared kodları Windows'ta yazabilirsiniz
- ✅ iOS'ta da çalışacak kodları Windows'ta yazabilirsiniz
- ✅ `iosMain/` klasöründeki Kotlin kodlarını Windows'ta yazabilirsiniz
- ❌ Sadece iOS build/test için macOS gerekir
- ❌ `iosApp/` klasöründeki Swift dosyaları için macOS gerekir

### Ne Zaman macOS Gerekir?

1. **İlk iOS modülü eklerken** (bir kere)
2. **iOS build/test yaparken** (haftada 1-2 kez yeterli)
3. **iOS-specific Swift kodları değiştirirken** (nadiren)
4. **App Store'a yüklerken** (release zamanı)

### Günlük Geliştirme?

**Windows'ta devam edin!** 🎉

- Günlük geliştirmenin %95'i Windows'ta yapılabilir
- Shared kodlar otomatik olarak iOS'ta da çalışır
- Sadece test için macOS'a ihtiyaç olur

---

## 💡 Öneriler

1. **Ana geliştirme Windows'ta yapın**
2. **Haftada 1-2 kez macOS'ta iOS test edin**
3. **Shared kodları öncelikli tutun** (her iki platformda çalışır)
4. **Platform-specific kodları minimize edin**
5. **Git kullanın** (kod senkronizasyonu için)

---

## 📊 Zaman Dağılımı

```
Windows'ta:  %90-95  ← Ana geliştirme
macOS'ta:    %5-10   ← iOS test ve release
```

**Sonuç:** Windows'ta rahatça geliştirmeye devam edebilirsiniz! 🚀
