package com.evalon.shared.presentation.viewmodel

import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.domain.model.Portfolio
import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.usecase.GetPortfolioUseCase
import com.evalon.shared.domain.usecase.GetStrategiesUseCase
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class DashboardViewModel(
    private val getPortfolioUseCase: GetPortfolioUseCase,
    private val getStrategiesUseCase: GetStrategiesUseCase,
    private val dbHelper: DatabaseHelper,
    private val userId: String
) {
    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        _uiState.value = DashboardUiState.Error(
            throwable.message ?: "Dashboard verileri yüklenemedi"
        )
    }

    private val viewModelScope = CoroutineScope(
        SupervisorJob() + Dispatchers.Main + exceptionHandler
    )

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    // Intermediate state to merge portfolio + strategies independently
    private var portfolio: Portfolio? = null
    private var strategies: List<Strategy>? = null

    init {
        loadCachedData()
        loadLiveData()
    }

    /** Show cached data immediately so the screen is never blank. */
    private fun loadCachedData() {
        val cachedPortfolio = if (userId.isNotEmpty()) {
            runCatching { dbHelper.getCachedPortfolio(userId) }.getOrNull()
        } else {
            null
        }
        val cachedStrategies = if (userId.isNotEmpty()) {
            runCatching { dbHelper.getCachedStrategies(userId) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }

        if (cachedPortfolio != null) {
            portfolio = cachedPortfolio
            strategies = cachedStrategies
            pushSuccess()
        }
    }

    private fun loadLiveData() {
        if (userId.isEmpty()) {
            _uiState.value = DashboardUiState.Error("Kullanıcı oturumu bulunamadı")
            return
        }

        _uiState.value = DashboardUiState.Loading

        // Portfolio — Flow from repository
        viewModelScope.launch {
            getPortfolioUseCase(userId)
                .catch { e ->
                    val cached = dbHelper.getCachedPortfolio(userId)
                    if (cached != null) {
                        portfolio = cached
                        pushSuccess()
                    } else if (strategies != null) {
                        _uiState.value = DashboardUiState.Error(
                            e.message ?: "Portfolio yüklenemedi"
                        )
                    }
                }
                .collect { p ->
                    portfolio = p
                    runCatching { dbHelper.cachePortfolio(p) }
                    pushSuccess()
                }
        }

        // Strategies — Flow from repository
        viewModelScope.launch {
            getStrategiesUseCase(userId)
                .catch { e ->
                    val cached = dbHelper.getCachedStrategies(userId)
                    strategies = cached
                    pushSuccess()
                }
                .collect { list ->
                    strategies = list
                    if (list.isNotEmpty()) {
                        runCatching { dbHelper.cacheStrategies(list) }
                    }
                    pushSuccess()
                }
        }
    }

    private fun pushSuccess() {
        val p = portfolio ?: return
        val s = strategies ?: return
        _uiState.value = DashboardUiState.Success(p, s)
    }

    fun refresh() {
        portfolio = null
        strategies = null
        loadLiveData()
    }
}

sealed class DashboardUiState {
    data object Loading : DashboardUiState()
    data class Success(
        val portfolio: Portfolio,
        val strategies: List<Strategy>
    ) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}
