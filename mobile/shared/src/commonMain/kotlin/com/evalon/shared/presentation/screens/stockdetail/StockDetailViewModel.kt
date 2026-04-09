package com.evalon.shared.presentation.screens.stockdetail

import com.evalon.shared.domain.model.ExchangeCategory
import com.evalon.shared.domain.model.StockCandle
import com.evalon.shared.domain.model.StockConstants
import com.evalon.shared.domain.model.Timeframe
import com.evalon.shared.domain.repository.StockPriceRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.max

/**
 * UI State for the Stock Detail screen.
 */
data class StockDetailUiState(
    val ticker: String = "",
    val selectedTimeframe: Timeframe = Timeframe.DAILY,
    val availableTimeframes: List<Timeframe> = Timeframe.selectorDefaults(),
    val candles: List<StockCandle> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    // Trade state
    val tradeQuantity: Int = 1,
    val minQuantity: Int = 1,
    val maxQuantity: Int = 1000,
    // Ticker Selection State
    val isTickerSheetOpen: Boolean = false,
    val searchQuery: String = "",
    val selectedExchange: ExchangeCategory = StockConstants.DEFAULT_EXCHANGE,
    val availableTickers: List<String> = StockConstants.tickersForExchange(StockConstants.DEFAULT_EXCHANGE),
    val filteredTickers: List<String> = StockConstants.tickersForExchange(StockConstants.DEFAULT_EXCHANGE)
) {
    /**
     * Current price from the last candle.
     */
    val currentPrice: Double?
        get() = candles.lastOrNull()?.close
    
    /**
     * Price change percentage compared to first candle.
     */
    val priceChangePercent: Double?
        get() {
            if (candles.size < 2) return null
            val firstPrice = candles.first().open
            val lastPrice = candles.last().close
            if (firstPrice == 0.0) return null
            return ((lastPrice - firstPrice) / firstPrice) * 100
        }
    
    /**
     * Whether price is up or down.
     */
    val isPriceUp: Boolean
        get() = (priceChangePercent ?: 0.0) >= 0
    
    /**
     * Total cost for buying at current price.
     */
    val totalCost: Double?
        get() = currentPrice?.let { it * tradeQuantity }
}

/**
 * ViewModel for the Stock Detail screen.
 * Manages timeframe selection, data fetching, trade actions, and ticker selection.
 */
class StockDetailViewModel(
    private val ticker: String,
    private val repository: StockPriceRepository
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    
    private val _uiState = MutableStateFlow(
        StockDetailUiState(
            ticker = ticker,
            selectedTimeframe = Timeframe.DAILY
        )
    )
    val uiState: StateFlow<StockDetailUiState> = _uiState.asStateFlow()
    
    // Internal ticker tracking to reload data correctly
    private var currentTicker: String = ticker
    
    init {
        loadData()
    }
    
    // ==================== Ticker Selection Functions ====================
    
    fun onTickerSheetOpen(isOpen: Boolean) {
        val exchange = _uiState.value.selectedExchange
        val tickers = StockConstants.tickersForExchange(exchange)
        _uiState.value = _uiState.value.copy(
            isTickerSheetOpen = isOpen,
            searchQuery = "",
            filteredTickers = tickers
        )
    }

    fun onExchangeSelected(exchange: ExchangeCategory) {
        val tickers = StockConstants.tickersForExchange(exchange)
        val query = _uiState.value.searchQuery
        val filtered = if (query.isBlank()) tickers
            else tickers.filter { it.contains(query, ignoreCase = true) }
        _uiState.value = _uiState.value.copy(
            selectedExchange = exchange,
            availableTickers = tickers,
            filteredTickers = filtered
        )
    }
    
    fun onSearchQueryChanged(query: String) {
        val exchange = _uiState.value.selectedExchange
        val tickers = StockConstants.tickersForExchange(exchange)
        val filtered = if (query.isBlank()) tickers
            else tickers.filter { it.contains(query, ignoreCase = true) }
        
        _uiState.value = _uiState.value.copy(
            searchQuery = query,
            filteredTickers = filtered
        )
    }
    
    fun onTickerSelected(newTicker: String) {
        if (newTicker == currentTicker) {
            onTickerSheetOpen(false)
            return
        }
        
        currentTicker = newTicker
        _uiState.value = _uiState.value.copy(
            ticker = newTicker,
            isTickerSheetOpen = false,
            // Reset chart data while loading new
            candles = emptyList(),
            selectedTimeframe = Timeframe.DAILY
        )
        loadData()
    }
    
    // ==================== Timeframe Functions ====================
    
    /**
     * Called when user selects a different timeframe.
     */
    fun onTimeframeSelected(timeframe: Timeframe) {
        if (timeframe == _uiState.value.selectedTimeframe) return
        
        _uiState.value = _uiState.value.copy(selectedTimeframe = timeframe)
        loadData()
    }
    
    /**
     * Refreshes the data for current timeframe.
     */
    fun refresh() {
        loadData()
    }
    
    // ==================== Trade Quantity Functions ====================
    
    /**
     * Increases trade quantity by 1.
     */
    fun onIncreaseQuantity() {
        val current = _uiState.value.tradeQuantity
        val max = _uiState.value.maxQuantity
        if (current < max) {
            _uiState.value = _uiState.value.copy(tradeQuantity = current + 1)
        }
    }
    
    /**
     * Decreases trade quantity by 1.
     */
    fun onDecreaseQuantity() {
        val current = _uiState.value.tradeQuantity
        val min = _uiState.value.minQuantity
        if (current > min) {
            _uiState.value = _uiState.value.copy(tradeQuantity = current - 1)
        }
    }
    
    /**
     * Sets trade quantity to a specific value.
     */
    fun onQuantityChanged(quantity: Int) {
        val min = _uiState.value.minQuantity
        val max = _uiState.value.maxQuantity
        val clamped = quantity.coerceIn(min, max)
        _uiState.value = _uiState.value.copy(tradeQuantity = clamped)
    }
    
    // ==================== Trade Action Functions ====================
    
    /**
     * Called when user taps the Buy button.
     * TODO: Integrate with trading backend.
     */
    fun onBuyClicked() {
        val state = _uiState.value
        val price = state.currentPrice ?: return
        val quantity = state.tradeQuantity
        val total = price * quantity
        
        println("🟢 AL: ${state.ticker} x $quantity @ $price ₺ = $total ₺")
        // TODO: Call trade repository
    }
    
    /**
     * Called when user taps the Sell button.
     * TODO: Integrate with trading backend.
     */
    fun onSellClicked() {
        val state = _uiState.value
        val price = state.currentPrice ?: return
        val quantity = state.tradeQuantity
        val total = price * quantity
        
        println("🔴 SAT: ${state.ticker} x $quantity @ $price ₺ = $total ₺")
        // TODO: Call trade repository
    }
    
    // ==================== Data Loading ====================
    
    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )
            
            val result = repository.getStockCandles(
                ticker = currentTicker,
                timeframe = _uiState.value.selectedTimeframe,
                limit = 1000
            )
            
            result.fold(
                onSuccess = { candles ->
                    _uiState.value = _uiState.value.copy(
                        candles = candles,
                        isLoading = false,
                        errorMessage = if (candles.isEmpty()) "Veri bulunamadı" else null
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        candles = emptyList(),
                        isLoading = false,
                        errorMessage = error.message ?: "Bilinmeyen hata"
                    )
                }
            )
        }
    }
}
