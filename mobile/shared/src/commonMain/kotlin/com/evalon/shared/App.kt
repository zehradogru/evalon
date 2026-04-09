package com.evalon.shared

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.arkivanov.decompose.DefaultComponentContext
import com.arkivanov.essenty.lifecycle.LifecycleRegistry
import com.evalon.shared.presentation.navigation.NavComponentImpl
import com.evalon.shared.presentation.navigation.NavContent
import com.evalon.shared.presentation.ui.theme.EvalonTheme

@Composable
@Suppress("FunctionName")
fun App() {
    // Create navigation component
    val lifecycle = remember { LifecycleRegistry() }
    val navComponent = remember {
        NavComponentImpl(
            componentContext = DefaultComponentContext(lifecycle = lifecycle)
        )
    }
    
    EvalonTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            NavContent(navComponent = navComponent)
        }
    }
}
