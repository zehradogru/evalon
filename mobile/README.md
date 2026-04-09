# 📱 EVALON Mobile

> **The Official Kotlin Multiplatform Client for the Evalon Financial Ecosystem**
> 
> A unified, native-grade trading and market analysis experience across both iOS and Android devices from a single, robust codebase.

---

## 📂 1. PROJECT STRUCTURE

The repository is modularized to strictly separate cross-platform business logic from platform-specific execution environments:

- **`shared/`** : The core Kotlin Multiplatform module (Shared business logic, networking, database).
- **`androidApp/`** : The Android-specific application module.
- **`iosApp/`** : The iOS-specific application module *(Currently in the integration phase)*.

---

## 🛠️ 2. TECHNOLOGY STACK

We leverage a modern, scalable, and fully declarative technology stack tailored for cross-platform efficiency:

| Category | Technology |
| :--- | :--- |
| **Core Framework** | Kotlin Multiplatform Mobile (KMM) |
| **User Interface** | Jetpack Compose Multiplatform |
| **Networking** | Ktor Client |
| **Dependency Injection** | Koin |
| **Local Persistence** | SQLDelight |
| **Navigation & State** | Decompose |

---

## 📐 3. ARCHITECTURE PRINCIPLES

The application strictly adheres to **Clean Architecture** principles, ensuring a decoupled, testable, and highly maintainable environment:

1. **Domain Layer:** Encapsulates core business rules, use cases, and repository interfaces.
2. **Data Layer:** Manages remote API clients, local storage implementations, and data mapping.
3. **Presentation Layer:** Handles declarative UI rendering (via Compose), ViewModels, and state-driven navigation.

---

## 🚀 4. GETTING STARTED & DEVELOPMENT

### 💻 Development Environment Capabilities
- **Windows / Linux:** Full support for Android and `shared` module development.
- **macOS:** Required for iOS compilation, building, and testing (alongside full Android/shared module support).

> 💡 *Note: For in-depth cross-platform workflows and environment setup, please refer to our [CROSS_PLATFORM_DEVELOPMENT.md](CROSS_PLATFORM_DEVELOPMENT.md) guide.*

### 🔨 Build Commands

**🟢 Android Compilation (Windows / Linux / macOS)**
To assemble the debug APK for Android, run the following command in your terminal:
```bash
./gradlew :androidApp:assembleDebug
