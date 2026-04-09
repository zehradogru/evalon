package com.evalon.shared.presentation.screens.companystocks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun CompanyStocksScreen(
    component: CompanyStocksComponent,
    viewModel: CompanyStocksViewModel,
    onStockClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Şirket Hisseleri", onBackClick = onBack)
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        if (state.isLoading) {
            EvalonLoadingState(modifier = Modifier.padding(padding))
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding).fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                // Company info card
                state.companyInfo?.let { info ->
                    item {
                        EvalonCard(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                            Text(info.name, color = EvalonTextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            Text(info.sector, color = EvalonBlue, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(modifier = Modifier.fillMaxWidth()) {
                                InfoChip("Piyasa Değeri", info.marketCap, Modifier.weight(1f))
                                InfoChip("F/K", info.peRatio, Modifier.weight(1f))
                                InfoChip("Temettü", info.dividend, Modifier.weight(1f))
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(info.description, color = EvalonTextSecondary, fontSize = 12.sp)
                        }
                    }
                }

                item {
                    EvalonSearchBar(
                        query = state.searchQuery,
                        onQueryChange = viewModel::onSearchQueryChange,
                        placeholder = "Sektör hisselerinde ara..."
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                item { SectionHeader(title = "Sektör Hisseleri") }

                items(state.stocks) { stock ->
                    StockListItem(stock = stock, onClick = { onStockClick(stock.symbol) })
                }
            }
        }
    }
}

@Composable
private fun InfoChip(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(label, color = EvalonTextSecondary, fontSize = 11.sp)
        Text(value, color = EvalonTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    }
}
