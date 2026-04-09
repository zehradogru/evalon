package com.evalon.shared.presentation.screens.trending

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun TrendingScreen(
    component: TrendingComponent,
    viewModel: TrendingViewModel,
    onStockClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Günün Popülerleri", onBackClick = onBack)
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
                // Category filter
                item {
                    val categories = listOf("Tümü", "En Çok İşlem", "En Çok Yükselen", "En Çok Düşen", "Kripto")
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(categories) { cat ->
                            FilterChip(
                                selected = state.selectedCategory == cat,
                                onClick = { viewModel.setCategory(cat) },
                                label = { Text(cat, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = EvalonBlue,
                                    selectedLabelColor = EvalonTextPrimary,
                                    containerColor = EvalonSurfaceVariant.copy(alpha = 0.3f),
                                    labelColor = EvalonTextSecondary
                                )
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                items(viewModel.getFilteredStocks()) { trendingStock ->
                    TrendingStockRow(trendingStock, onClick = { onStockClick(trendingStock.stock.symbol) })
                }
            }
        }
    }
}

@Composable
private fun TrendingStockRow(data: TrendingStockData, onClick: () -> Unit) {
    val isPositive = data.stock.changePercent >= 0
    val changeColor = if (isPositive) EvalonGreen else EvalonRed

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Trend score fire icon
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(EvalonOrange.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.LocalFireDepartment,
                contentDescription = null,
                tint = EvalonOrange,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(data.stock.symbol, color = EvalonTextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.width(6.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(EvalonOrange.copy(alpha = 0.2f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("🔥 ${data.trendScore}", color = EvalonOrange, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            Text(data.stock.companyName, color = EvalonTextSecondary, fontSize = 12.sp)
            Text("${data.mentions} bahsedilme • ${data.category}", color = EvalonTextSecondary, fontSize = 11.sp)
        }

        Column(horizontalAlignment = Alignment.End) {
            Text("₺${String.format("%.2f", data.stock.price)}", color = EvalonTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(
                "${if (isPositive) "+" else ""}${String.format("%.2f", data.stock.changePercent)}%",
                color = changeColor, fontWeight = FontWeight.Medium, fontSize = 13.sp
            )
        }
    }
}
