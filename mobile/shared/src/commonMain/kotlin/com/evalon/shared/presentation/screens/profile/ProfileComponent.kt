package com.evalon.shared.presentation.screens.profile

import com.arkivanov.decompose.ComponentContext

interface ProfileComponent {
    fun navigateBack()
}

class ProfileComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, ProfileComponent {
    override fun navigateBack() {}
}
