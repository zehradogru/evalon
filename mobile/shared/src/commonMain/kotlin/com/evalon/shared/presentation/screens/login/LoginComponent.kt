package com.evalon.shared.presentation.screens.login

import com.arkivanov.decompose.ComponentContext

interface LoginComponent {
    fun onLoginSuccess()
}

class LoginComponentImpl(
    componentContext: ComponentContext,
    private val onSuccess: () -> Unit
) : ComponentContext by componentContext, LoginComponent {
    override fun onLoginSuccess() { onSuccess() }
}
