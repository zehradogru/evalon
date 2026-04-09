package com.evalon.shared.presentation.screens.dashboard

import com.arkivanov.decompose.ComponentContext

interface DashboardComponent {
    fun navigateToStrategy(strategyId: String? = null)
}

class DashboardComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, DashboardComponent {
    override fun navigateToStrategy(strategyId: String?) {
        // Navigation handled by parent
    }
}
