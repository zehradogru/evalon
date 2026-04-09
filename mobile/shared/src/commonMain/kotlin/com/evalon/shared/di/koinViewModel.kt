package com.evalon.shared.di

import androidx.compose.runtime.Composable
import org.koin.compose.koinInject

// Helper function to get ViewModel from Koin
@Composable
inline fun <reified T : Any> koinViewModel(): T {
    return koinInject<T>()
}
