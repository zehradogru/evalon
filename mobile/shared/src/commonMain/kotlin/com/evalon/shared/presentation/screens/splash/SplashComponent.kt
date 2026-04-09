package com.evalon.shared.presentation.screens.splash

import com.arkivanov.decompose.ComponentContext

interface SplashComponent {
    fun onSplashFinished()
}

class SplashComponentImpl(
    componentContext: ComponentContext,
    private val onFinished: () -> Unit
) : ComponentContext by componentContext, SplashComponent {
    
    override fun onSplashFinished() {
        onFinished()
    }
}
