package com.evalon.shared.presentation.screens.backtest

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
import com.evalon.shared.util.format

@Composable
fun BacktestScreen(
    component: BacktestComponent,
    viewModel: BacktestViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Backtest Sonuçları", onBackClick = onBack)
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        if (state.isLoading) {
            EvalonLoadingState(modifier = Modifier.padding(padding))
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding).fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.results) { result ->
                    BacktestResultCard(result)
                }
            }
        }
    }
}

@Composable
private fun BacktestResultCard(result: BacktestSummary) {
    val isPositive = result.totalReturnPercent >= 0
    val returnColor = if (isPositive) EvalonGreen else EvalonRed

    EvalonCard(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text(
            text = result.strategyName,
            color = EvalonTextPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "${result.startDate} — ${result.endDate}",
            color = EvalonTextSecondary,
            fontSize = 12.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Stats grid
        Row(modifier = Modifier.fillMaxWidth()) {
            StatItem("Getiri", "${if (isPositive) "+" else ""}${result.totalReturnPercent.format(2)}%", returnColor, Modifier.weight(1f))
            StatItem("Max DD", "${result.maxDrawdown.format(1)}%", EvalonRed, Modifier.weight(1f))
            StatItem("Sharpe", result.sharpeRatio.format(2), EvalonTextPrimary, Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(modifier = Modifier.fillMaxWidth()) {
            StatItem("Kazanma", "${result.winRate.format(1)}%", EvalonGreen, Modifier.weight(1f))
            StatItem("İşlem", "${result.totalTrades}", EvalonTextPrimary, Modifier.weight(1f))
            StatItem("Kâr", "₺${result.totalReturn.format(0)}", returnColor, Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatItem(
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            color = EvalonTextSecondary,
            fontSize = 11.sp
        )
        Text(
            text = value,
            color = valueColor,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
    }
}
