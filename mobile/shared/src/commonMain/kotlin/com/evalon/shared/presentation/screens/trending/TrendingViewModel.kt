package com.evalon.shared.presentation.screens.trending

import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.presentation.components.StockItemData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class TrendingStockData(
    val stock: StockItemData,
    val trendScore: Int,
    val mentions: Int,
    val category: String
)

data class TrendingUiState(
    val isLoading: Boolean = true,
    val stocks: List<TrendingStockData> = emptyList(),
    val selectedCategory: String = "Tümü"
)

class TrendingViewModel(
    private val marketListRepository: MarketListRepository
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(TrendingUiState())
    val uiState: StateFlow<TrendingUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            marketListRepository.observeMarketList("BIST").collect { result ->
                if (result.items.isEmpty() && result.isWarming) return@collect

                val items = result.items
                val gainers = items
                    .filter { it.changePercent > 0 }
                    .sortedByDescending { it.changePercent }
                val losers = items
                    .filter { it.changePercent < 0 }
                    .sortedBy { it.changePercent }

                val trendingStocks = buildList {
                    gainers.take(5).forEachIndexed { i, item ->
                        add(TrendingStockData(
                            stock = StockItemData(item.symbol, item.name, item.price, item.changePercent, item.volume),
                            trendScore = 100 - i * 5,
                            mentions = 0,
                            category = "En Çok Yükselen"
                        ))
                    }
                    losers.take(5).forEachIndexed { i, item ->
                        add(TrendingStockData(
                            stock = StockItemData(item.symbol, item.name, item.price, item.changePercent, item.volume),
                            trendScore = 60 - i * 5,
                            mentions = 0,
                            category = "En Çok Düşen"
                        ))
                    }
                    items.sortedByDescending { it.volume.replace(Regex("[^0-9.]"), "").toDoubleOrNull() ?: 0.0 }
                        .take(5)
                        .forEachIndexed { i, item ->
                            add(TrendingStockData(
                                stock = StockItemData(item.symbol, item.name, item.price, item.changePercent, item.volume),
                                trendScore = 80 - i * 3,
                                mentions = 0,
                                category = "En Çok İşlem"
                            ))
                        }
                }

                _uiState.value = TrendingUiState(
                    isLoading = false,
                    stocks = trendingStocks
                )
            }
        }
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(selectedCategory = category)
    }

    fun getFilteredStocks(): List<TrendingStockData> {
        val cat = _uiState.value.selectedCategory
        if (cat == "Tümü") return _uiState.value.stocks
        return _uiState.value.stocks.filter { it.category == cat }
    }

    fun refresh() {
        loadData()
    }
}
