package com.evalon.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.evalon.shared.App

import com.evalon.shared.di.initKoin
import org.koin.android.ext.koin.androidContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 12+ SplashScreen API entegrasyonu
        installSplashScreen()
        
        super.onCreate(savedInstanceState)
        
        // Initialize Koin with Android Context
        initKoin {
            androidContext(this@MainActivity)
        }
        
        setContent {
            App()
        }
    }
}
