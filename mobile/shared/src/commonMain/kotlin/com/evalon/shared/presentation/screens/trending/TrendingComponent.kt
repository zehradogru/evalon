package com.evalon.shared.presentation.screens.trending

import com.arkivanov.decompose.ComponentContext

interface TrendingComponent {
    fun navigateBack()
}

class TrendingComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, TrendingComponent {
    override fun navigateBack() {}
}
