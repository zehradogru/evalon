plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.evalon.android"
    compileSdk = 35

    sourceSets["main"].manifest.srcFile("src/main/AndroidManifest.xml")

    defaultConfig {
        applicationId = "com.evalon.android"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation(project(":shared"))
    implementation(platform(libs.firebase.bom))
    
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.activity)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.koin.android)
    implementation(libs.firebase.auth)
    implementation(libs.firebase.storage)
    implementation(libs.googleid)
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
}
