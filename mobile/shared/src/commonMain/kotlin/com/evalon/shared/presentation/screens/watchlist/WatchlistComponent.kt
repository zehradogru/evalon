package com.evalon.shared.presentation.screens.watchlist

import com.arkivanov.decompose.ComponentContext

interface WatchlistComponent {
    fun navigateBack()
}

class WatchlistComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, WatchlistComponent {
    override fun navigateBack() {}
}
