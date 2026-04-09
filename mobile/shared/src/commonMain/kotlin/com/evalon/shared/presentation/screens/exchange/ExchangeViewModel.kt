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
        val type = exchangeType.uppercase()
        if (type == "BIST") {
            loadBistFromApi()
        } else {
            loadMockData(type)
        }
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

    private fun loadMockData(type: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            delay(600)
            val (name, index, change, stocks) = when (type) {
                "NASDAQ" -> Quad(
                    "NASDAQ", "16,428.82", 0.87,
                    listOf(
                        StockItemData("AAPL", "Apple Inc.", 182.63, 1.25, "85.2M"),
                        StockItemData("MSFT", "Microsoft Corp.", 378.91, 0.95, "22.1M"),
                        StockItemData("NVDA", "NVIDIA Corp.", 721.33, 3.42, "45.8M"),
                        StockItemData("GOOGL", "Alphabet Inc.", 141.80, 0.65, "28.3M"),
                        StockItemData("AMZN", "Amazon.com Inc.", 178.25, 1.80, "35.6M"),
                        StockItemData("META", "Meta Platforms", 484.10, 2.15, "18.9M"),
                        StockItemData("TSLA", "Tesla Inc.", 193.57, -1.35, "112.4M")
                    )
                )
                "CRYPTO" -> Quad(
                    "Kripto Paralar", "Piyasa D.: \$2.1T", 2.45,
                    listOf(
                        StockItemData("BTC", "Bitcoin", 52340.0, 2.85, "28.5B"),
                        StockItemData("ETH", "Ethereum", 2890.0, 3.20, "15.2B"),
                        StockItemData("BNB", "Binance Coin", 312.50, 1.45, "1.2B"),
                        StockItemData("SOL", "Solana", 103.20, 5.80, "3.8B"),
                        StockItemData("ADA", "Cardano", 0.58, -1.20, "680M"),
                        StockItemData("AVAX", "Avalanche", 36.80, 4.10, "520M"),
                        StockItemData("DOT", "Polkadot", 7.45, 1.90, "320M")
                    )
                )
                "FOREX" -> Quad(
                    "Forex", "DXY: 103.85", -0.32,
                    listOf(
                        StockItemData("USD/TRY", "Dolar/TL", 30.85, 0.15),
                        StockItemData("EUR/TRY", "Euro/TL", 33.42, 0.22),
                        StockItemData("EUR/USD", "Euro/Dolar", 1.0834, -0.08),
                        StockItemData("GBP/USD", "Sterlin/Dolar", 1.2645, 0.12),
                        StockItemData("USD/JPY", "Dolar/Yen", 150.28, 0.35),
                        StockItemData("XAU/USD", "Altın/Dolar", 2024.50, 0.65)
                    )
                )
                else -> Quad("Borsa", "-", 0.0, emptyList())
            }
            _uiState.value = ExchangeUiState(
                isLoading = false,
                exchangeName = name,
                indexValue = index,
                indexChange = change,
                stocks = stocks
            )
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

private data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
