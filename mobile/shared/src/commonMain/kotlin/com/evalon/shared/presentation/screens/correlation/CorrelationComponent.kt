package com.evalon.shared.presentation.screens.correlation

import com.arkivanov.decompose.ComponentContext

interface CorrelationComponent {
    fun navigateBack()
}

class CorrelationComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, CorrelationComponent {
    override fun navigateBack() {}
}
