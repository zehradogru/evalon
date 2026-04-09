package com.evalon.shared.presentation.screens.watchlist

import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.presentation.components.StockItemData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WatchlistGroup(
    val name: String,
    val stocks: List<StockItemData>
)

data class WatchlistUiState(
    val isLoading: Boolean = true,
    val groups: List<WatchlistGroup> = emptyList(),
    val searchQuery: String = ""
)

class WatchlistViewModel(
    private val dbHelper: DatabaseHelper,
    private val marketListRepository: MarketListRepository
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(WatchlistUiState())
    val uiState: StateFlow<WatchlistUiState> = _uiState.asStateFlow()

    /** Market snapshot cache to resolve prices for watchlist symbols */
    private val priceCache = mutableMapOf<String, StockItemData>()

    init {
        loadData()
    }

    private fun loadData() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            // Fetch market list for price data
            marketListRepository.observeMarketList("BIST").collect { result ->
                result.items.forEach { item ->
                    priceCache[item.symbol] = StockItemData(
                        symbol = item.symbol,
                        companyName = item.name,
                        price = item.price,
                        changePercent = item.changePercent,
                        volume = item.volume
                    )
                }
                buildGroups()
            }
        }
        // Also show watchlist immediately from DB (before market data arrives)
        buildGroups()
    }

    private fun buildGroups() {
        val symbols = dbHelper.getWatchlist()
        val stocks = symbols.map { symbol ->
            priceCache[symbol] ?: StockItemData(symbol, symbol, 0.0, 0.0)
        }

        val groups = if (stocks.isEmpty()) {
            emptyList()
        } else {
            listOf(WatchlistGroup(name = "İzleme Listem", stocks = stocks))
        }

        _uiState.value = WatchlistUiState(isLoading = false, groups = groups)
    }

    fun addToWatchlist(symbol: String) {
        dbHelper.addToWatchlist(symbol)
        buildGroups()
    }

    fun removeFromWatchlist(symbol: String) {
        dbHelper.removeFromWatchlist(symbol)
        buildGroups()
    }

    fun isInWatchlist(symbol: String): Boolean = dbHelper.isInWatchlist(symbol)

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun refresh() {
        loadData()
    }
}
