package com.evalon.shared.presentation.screens.strategy

import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.di.CurrentSession
import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.usecase.GetStrategiesUseCase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

data class StrategyUiState(
    val isLoading: Boolean = true,
    val strategies: List<Strategy> = emptyList(),
    val selectedStrategy: Strategy? = null,
    val error: String? = null
)

class StrategyViewModel(
    private val strategyId: String?,
    private val getStrategiesUseCase: GetStrategiesUseCase,
    private val dbHelper: DatabaseHelper,
    private val currentSession: CurrentSession
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(StrategyUiState())
    val uiState: StateFlow<StrategyUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val userId = currentSession.userId
        if (userId.isEmpty()) {
            _uiState.value = StrategyUiState(isLoading = false, error = "Oturum bulunamadı")
            return
        }

        // Show cache immediately
        val cached = dbHelper.getCachedStrategies(userId)
        if (cached.isNotEmpty()) {
            _uiState.value = StrategyUiState(
                isLoading = false,
                strategies = cached,
                selectedStrategy = strategyId?.let { id -> cached.find { it.id == id } }
            )
        } else {
            _uiState.value = StrategyUiState(isLoading = true)
        }

        // Fetch live data
        viewModelScope.launch {
            getStrategiesUseCase(userId)
                .catch { e ->
                    if (_uiState.value.strategies.isEmpty()) {
                        _uiState.value = StrategyUiState(
                            isLoading = false,
                            error = e.message ?: "Stratejiler yüklenemedi"
                        )
                    }
                }
                .collect { list ->
                    if (list.isNotEmpty()) dbHelper.cacheStrategies(list)
                    _uiState.value = StrategyUiState(
                        isLoading = false,
                        strategies = list,
                        selectedStrategy = strategyId?.let { id -> list.find { it.id == id } }
                    )
                }
        }
    }

    fun selectStrategy(strategy: Strategy) {
        _uiState.value = _uiState.value.copy(selectedStrategy = strategy)
    }
}
