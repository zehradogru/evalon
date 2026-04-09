package com.evalon.shared.presentation.screens.welcome

import com.arkivanov.decompose.ComponentContext

interface WelcomeComponent {
    fun onContinue()
}

class WelcomeComponentImpl(
    componentContext: ComponentContext,
    val userName: String
) : ComponentContext by componentContext, WelcomeComponent {
    override fun onContinue() {
        // Navigation handled by parent
    }
}
