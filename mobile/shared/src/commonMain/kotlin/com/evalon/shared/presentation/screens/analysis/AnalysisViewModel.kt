package com.evalon.shared.presentation.screens.analysis

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AnalysisIndicator(
    val name: String,
    val value: String,
    val signal: AnalysisSignal
)

enum class AnalysisSignal { BUY, SELL, NEUTRAL }

data class AnalysisUiState(
    val isLoading: Boolean = true,
    val selectedSymbol: String = "THYAO",
    val indicators: List<AnalysisIndicator> = emptyList(),
    val summary: String = "",
    val searchQuery: String = ""
)

class AnalysisViewModel {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(AnalysisUiState())
    val uiState: StateFlow<AnalysisUiState> = _uiState.asStateFlow()

    init { loadData() }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            delay(800)
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                indicators = listOf(
                    AnalysisIndicator("RSI (14)", "58.3", AnalysisSignal.NEUTRAL),
                    AnalysisIndicator("MACD", "Pozitif Kesişim", AnalysisSignal.BUY),
                    AnalysisIndicator("Bollinger Bantları", "Orta Bant Üzeri", AnalysisSignal.BUY),
                    AnalysisIndicator("SMA 50/200", "Golden Cross", AnalysisSignal.BUY),
                    AnalysisIndicator("Stokastik", "82.5 (Aşırı Alım)", AnalysisSignal.SELL),
                    AnalysisIndicator("ADX", "28.4 (Güçlü Trend)", AnalysisSignal.BUY),
                    AnalysisIndicator("ATR", "4.23", AnalysisSignal.NEUTRAL),
                    AnalysisIndicator("OBV", "Yükselen", AnalysisSignal.BUY)
                ),
                summary = "Genel teknik görünüm ALIM yönünde. 8 göstergeden 5'i alım sinyali veriyor."
            )
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun selectSymbol(symbol: String) {
        _uiState.value = _uiState.value.copy(selectedSymbol = symbol)
        loadData()
    }
}
