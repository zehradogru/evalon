package com.evalon.shared.presentation.screens.stockdetail

import com.arkivanov.decompose.ComponentContext
import com.evalon.shared.domain.repository.StockPriceRepository
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

interface StockDetailComponent {
    val ticker: String
    val viewModel: StockDetailViewModel
    fun navigateBack()
}

class StockDetailComponentImpl(
    componentContext: ComponentContext,
    override val ticker: String
) : ComponentContext by componentContext, StockDetailComponent, KoinComponent {
    
    private val repository: StockPriceRepository by inject()
    
    override val viewModel: StockDetailViewModel = StockDetailViewModel(
        ticker = ticker,
        repository = repository
    )
    
    override fun navigateBack() {
        // Navigation handled by parent (NavComponent.navigateBack())
    }
}
