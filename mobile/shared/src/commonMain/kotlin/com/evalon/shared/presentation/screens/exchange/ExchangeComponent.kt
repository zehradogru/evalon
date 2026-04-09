package com.evalon.shared.presentation.screens.exchange

import com.arkivanov.decompose.ComponentContext

interface ExchangeComponent {
    val exchangeType: String
    fun navigateBack()
}

class ExchangeComponentImpl(
    componentContext: ComponentContext,
    override val exchangeType: String
) : ComponentContext by componentContext, ExchangeComponent {
    override fun navigateBack() {}
}
