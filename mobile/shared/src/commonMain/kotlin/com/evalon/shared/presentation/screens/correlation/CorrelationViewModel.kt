package com.evalon.shared.presentation.screens.correlation

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CorrelationPair(
    val symbol1: String,
    val symbol2: String,
    val correlation: Double,
    val period: String
)

data class CorrelationUiState(
    val isLoading: Boolean = true,
    val pairs: List<CorrelationPair> = emptyList(),
    val searchQuery: String = ""
)

class CorrelationViewModel {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(CorrelationUiState())
    val uiState: StateFlow<CorrelationUiState> = _uiState.asStateFlow()

    init { loadData() }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            delay(800)
            _uiState.value = CorrelationUiState(
                isLoading = false,
                pairs = listOf(
                    CorrelationPair("THYAO", "PGSUS", 0.87, "1Y"),
                    CorrelationPair("GARAN", "AKBNK", 0.92, "1Y"),
                    CorrelationPair("ASELS", "TUSAS", 0.78, "1Y"),
                    CorrelationPair("EREGL", "KRDMD", 0.85, "1Y"),
                    CorrelationPair("BIMAS", "MGROS", 0.74, "1Y"),
                    CorrelationPair("SISE", "TRKCM", 0.81, "1Y"),
                    CorrelationPair("THYAO", "BIST100", 0.65, "1Y"),
                    CorrelationPair("AAPL", "MSFT", 0.72, "1Y"),
                    CorrelationPair("BTC", "ETH", 0.88, "6M"),
                    CorrelationPair("GARAN", "ISCTR", 0.91, "1Y")
                )
            )
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun getFilteredPairs(): List<CorrelationPair> {
        val query = _uiState.value.searchQuery.lowercase()
        if (query.isEmpty()) return _uiState.value.pairs
        return _uiState.value.pairs.filter {
            it.symbol1.lowercase().contains(query) || it.symbol2.lowercase().contains(query)
        }
    }
}
