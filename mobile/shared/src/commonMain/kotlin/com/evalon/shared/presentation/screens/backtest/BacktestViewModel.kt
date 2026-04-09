package com.evalon.shared.presentation.screens.backtest

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class BacktestSummary(
    val strategyName: String,
    val totalReturn: Double,
    val totalReturnPercent: Double,
    val maxDrawdown: Double,
    val sharpeRatio: Double,
    val winRate: Double,
    val totalTrades: Int,
    val startDate: String,
    val endDate: String
)

data class BacktestUiState(
    val isLoading: Boolean = true,
    val results: List<BacktestSummary> = emptyList()
)

class BacktestViewModel {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(BacktestUiState())
    val uiState: StateFlow<BacktestUiState> = _uiState.asStateFlow()

    init { loadData() }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            delay(800)
            _uiState.value = BacktestUiState(
                isLoading = false,
                results = listOf(
                    BacktestSummary(
                        strategyName = "MACD Kesişim Stratejisi",
                        totalReturn = 15420.0,
                        totalReturnPercent = 15.42,
                        maxDrawdown = -8.3,
                        sharpeRatio = 1.45,
                        winRate = 62.5,
                        totalTrades = 48,
                        startDate = "01.01.2025",
                        endDate = "01.02.2026"
                    ),
                    BacktestSummary(
                        strategyName = "RSI Dip Avcısı",
                        totalReturn = 8750.0,
                        totalReturnPercent = 8.75,
                        maxDrawdown = -12.1,
                        sharpeRatio = 0.98,
                        winRate = 54.2,
                        totalTrades = 72,
                        startDate = "01.01.2025",
                        endDate = "01.02.2026"
                    ),
                    BacktestSummary(
                        strategyName = "Bollinger Breakout",
                        totalReturn = -3200.0,
                        totalReturnPercent = -3.20,
                        maxDrawdown = -18.5,
                        sharpeRatio = -0.32,
                        winRate = 38.9,
                        totalTrades = 36,
                        startDate = "01.06.2025",
                        endDate = "01.02.2026"
                    )
                )
            )
        }
    }

    fun refresh() { loadData() }
}
