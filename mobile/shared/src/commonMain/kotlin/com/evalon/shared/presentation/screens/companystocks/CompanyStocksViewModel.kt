package com.evalon.shared.presentation.screens.companystocks

import com.evalon.shared.presentation.components.StockItemData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CompanyInfo(
    val name: String,
    val sector: String,
    val marketCap: String,
    val peRatio: String,
    val dividend: String,
    val description: String
)

data class CompanyStocksUiState(
    val isLoading: Boolean = true,
    val companyInfo: CompanyInfo? = null,
    val stocks: List<StockItemData> = emptyList(),
    val searchQuery: String = ""
)

class CompanyStocksViewModel(companyId: String?) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(CompanyStocksUiState())
    val uiState: StateFlow<CompanyStocksUiState> = _uiState.asStateFlow()

    init { loadData() }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            delay(800)
            _uiState.value = CompanyStocksUiState(
                isLoading = false,
                companyInfo = CompanyInfo(
                    name = "Türk Hava Yolları",
                    sector = "Havacılık",
                    marketCap = "₺403.2B",
                    peRatio = "5.8",
                    dividend = "2.3%",
                    description = "Türk Hava Yolları A.O., BIST'te en çok işlem gören havacılık şirketidir."
                ),
                stocks = listOf(
                    StockItemData("THYAO", "Türk Hava Yolları", 292.50, 2.35),
                    StockItemData("PGSUS", "Pegasus", 1125.00, -1.20),
                    StockItemData("CLEBI", "Çelebi Havacılık", 198.40, 0.85),
                    StockItemData("TAVHL", "TAV Havalimanları", 87.60, 1.10),
                    StockItemData("HATEK", "Hatek İmalat", 15.20, 3.45)
                )
            )
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }
}
