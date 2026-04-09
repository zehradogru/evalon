package com.evalon.shared.presentation.screens.exchange

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun ExchangeScreen(
    component: ExchangeComponent,
    viewModel: ExchangeViewModel,
    onStockClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = state.exchangeName, onBackClick = onBack)
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
                // Index hero card
                item {
                    val isPositive = state.indexChange >= 0
                    val gradientColors = if (isPositive) {
                        listOf(EvalonGreenDark, EvalonGreen)
                    } else {
                        listOf(EvalonRedDark, EvalonRed)
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.horizontalGradient(gradientColors))
                            .padding(20.dp)
                    ) {
                        Column {
                            Text(state.exchangeName, color = EvalonTextPrimary.copy(alpha = 0.8f), fontSize = 14.sp)
                            Text(
                                text = state.indexValue,
                                color = EvalonTextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 28.sp
                            )
                            Text(
                                text = "${if (isPositive) "+" else ""}${String.format("%.2f", state.indexChange)}%",
                                color = EvalonTextPrimary.copy(alpha = 0.9f),
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }

                // Filter chips
                item {
                    val filters = listOf("Tümü", "Yükselenler", "Düşenler", "En Hacimli")
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filters) { filter ->
                            FilterChip(
                                selected = state.selectedFilter == filter,
                                onClick = { viewModel.setFilter(filter) },
                                label = { Text(filter, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = EvalonBlue,
                                    selectedLabelColor = EvalonTextPrimary,
                                    containerColor = EvalonSurfaceVariant.copy(alpha = 0.3f),
                                    labelColor = EvalonTextSecondary
                                )
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                item {
                    EvalonSearchBar(
                        query = state.searchQuery,
                        onQueryChange = viewModel::onSearchQueryChange,
                        placeholder = "Hisse ara..."
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Warming banner
                if (state.isWarming) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(EvalonBlue.copy(alpha = 0.12f))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp,
                                color = EvalonBlue
                            )
                            Text(
                                text = "Piyasa verileri yükleniyor...",
                                color = EvalonBlue,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

                item { SectionHeader(title = "Hisseler") }

                items(viewModel.getFilteredStocks()) { stock ->
                    StockListItem(stock = stock, onClick = { onStockClick(stock.symbol) })
                }
            }
        }
    }
}
