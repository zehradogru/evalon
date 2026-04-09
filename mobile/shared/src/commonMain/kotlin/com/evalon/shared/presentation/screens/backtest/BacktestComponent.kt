package com.evalon.shared.presentation.screens.backtest

import com.arkivanov.decompose.ComponentContext

interface BacktestComponent {
    fun navigateBack()
}

class BacktestComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, BacktestComponent {
    override fun navigateBack() {}
}
