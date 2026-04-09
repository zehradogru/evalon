package com.evalon.shared.presentation.screens.settings

import com.arkivanov.decompose.ComponentContext

interface SettingsComponent {
    fun navigateBack()
}

class SettingsComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, SettingsComponent {
    override fun navigateBack() {}
}
