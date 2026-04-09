package com.evalon.shared.presentation.screens.strategy

import com.arkivanov.decompose.ComponentContext

interface StrategyComponent {
    val strategyId: String?
    fun navigateBack()
}

class StrategyComponentImpl(
    componentContext: ComponentContext,
    override val strategyId: String?
) : ComponentContext by componentContext, StrategyComponent {
    override fun navigateBack() {
        // Navigation handled by parent
    }
}
