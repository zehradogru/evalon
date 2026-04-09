package com.evalon.shared.presentation.screens.strategy

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.model.StrategyStatus
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun StrategyScreen(
    component: StrategyComponent,
    viewModel: StrategyViewModel,
    onBacktestClick: () -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Stratejiler", onBackClick = onBack)
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* TODO: create strategy */ },
                containerColor = EvalonBlue,
                contentColor = EvalonTextPrimary
            ) {
                Icon(Icons.Default.Add, "Yeni Strateji")
            }
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        if (state.isLoading) {
            EvalonLoadingState(modifier = Modifier.padding(padding))
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding).fillMaxSize(),
                contentPadding = PaddingValues(bottom = 80.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { SectionHeader(title = "Aktif Stratejiler") }

                items(state.strategies) { strategy ->
                    StrategyCard(strategy, onClick = { viewModel.selectStrategy(strategy) }, onBacktestClick = onBacktestClick)
                }
            }
        }
    }
}

@Composable
private fun StrategyCard(strategy: Strategy, onClick: () -> Unit, onBacktestClick: () -> Unit) {
    val statusColor = when (strategy.status) {
        StrategyStatus.ACTIVE -> EvalonGreen
        StrategyStatus.BACKTESTED -> EvalonBlue
        StrategyStatus.PAPER_TRADING -> EvalonOrange
        StrategyStatus.DRAFT -> EvalonTextSecondary
        StrategyStatus.RETIRED -> EvalonRed
    }
    val statusText = when (strategy.status) {
        StrategyStatus.ACTIVE -> "Aktif"
        StrategyStatus.BACKTESTED -> "Test Edildi"
        StrategyStatus.PAPER_TRADING -> "Kağıt İşlem"
        StrategyStatus.DRAFT -> "Taslak"
        StrategyStatus.RETIRED -> "Pasif"
    }

    EvalonCard(
        onClick = onClick,
        modifier = Modifier.padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(strategy.name, color = EvalonTextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                strategy.description?.let {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(it, color = EvalonTextSecondary, fontSize = 13.sp, maxLines = 2)
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(statusColor.copy(alpha = 0.15f))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(statusText, color = statusColor, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onBacktestClick,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = EvalonBlue),
                modifier = Modifier.height(32.dp),
                contentPadding = PaddingValues(horizontal = 12.dp)
            ) {
                Text("Backtest", fontSize = 12.sp)
            }
        }
    }
}
