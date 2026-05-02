package com.evalon.shared.presentation.screens.exchange

import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.presentation.components.StockItemData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ExchangeUiState(
    val isLoading: Boolean = true,
    val isWarming: Boolean = false,
    val exchangeName: String = "",
    val indexValue: String = "",
    val indexChange: Double = 0.0,
    val stocks: List<StockItemData> = emptyList(),
    val searchQuery: String = "",
    val selectedFilter: String = "Tümü",
    val error: String? = null
)

class ExchangeViewModel(
    private val exchangeType: String,
    private val marketListRepository: MarketListRepository
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(ExchangeUiState())
    val uiState: StateFlow<ExchangeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        loadBistFromApi()
    }

    private fun loadBistFromApi() {
        _uiState.value = _uiState.value.copy(
            isLoading = true,
            exchangeName = "BIST 100"
        )
        viewModelScope.launch {
            marketListRepository.observeMarketList("BIST").collect { result ->
                val stocks = result.items.map { item ->
                    StockItemData(
                        symbol = item.symbol,
                        companyName = item.name,
                        price = item.price,
                        changePercent = item.changePercent,
                        volume = item.volume
                    )
                }
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isWarming = result.isWarming,
                    exchangeName = "BIST 100",
                    indexValue = "-",
                    indexChange = 0.0,
                    stocks = stocks
                )
            }
        }
    }



    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun setFilter(filter: String) {
        _uiState.value = _uiState.value.copy(selectedFilter = filter)
    }

    fun getFilteredStocks(): List<StockItemData> {
        val state = _uiState.value
        var stocks = state.stocks

        // Filter by rising/falling
        stocks = when (state.selectedFilter) {
            "Yükselenler" -> stocks.filter { it.changePercent > 0 }
            "Düşenler" -> stocks.filter { it.changePercent < 0 }
            "En Hacimli" -> stocks.sortedByDescending { it.volume }
            else -> stocks
        }

        val query = state.searchQuery.lowercase()
        if (query.isEmpty()) return stocks
        return stocks.filter {
            it.symbol.lowercase().contains(query) || it.companyName.lowercase().contains(query)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            marketListRepository.refresh(exchangeType.uppercase())
            loadData()
        }
    }
}

