package com.evalon.shared.presentation.viewmodel

import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.usecase.CreateStrategyUseCase
import com.evalon.shared.domain.usecase.GetStrategiesUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class StrategyViewModel(
    private val getStrategiesUseCase: GetStrategiesUseCase,
    private val createStrategyUseCase: CreateStrategyUseCase,
    private val userId: String
) {
    private val _uiState = MutableStateFlow<StrategyUiState>(StrategyUiState.Loading)
    val uiState: StateFlow<StrategyUiState> = _uiState.asStateFlow()

    init {
        loadStrategies()
    }

    private fun loadStrategies() {
        // TODO: Collect from use case flow
        _uiState.value = StrategyUiState.Loading
    }

    suspend fun createStrategy(strategy: Strategy) {
        _uiState.value = StrategyUiState.Loading
        val result = createStrategyUseCase(strategy)
        _uiState.value = result.fold(
            onSuccess = { StrategyUiState.Success(listOf(it)) },
            onFailure = { StrategyUiState.Error(it.message ?: "Failed to create strategy") }
        )
    }

    fun refresh() {
        loadStrategies()
    }
}

sealed class StrategyUiState {
    data object Loading : StrategyUiState()
    data class Success(val strategies: List<Strategy>) : StrategyUiState()
    data class Error(val message: String) : StrategyUiState()
}
