package com.evalon.shared.presentation.screens.analysis

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
fun AnalysisScreen(
    component: AnalysisComponent,
    viewModel: AnalysisViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Teknik Analiz", onBackClick = onBack)
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
                // Symbol header
                item {
                    EvalonCard(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text(
                            text = state.selectedSymbol,
                            color = EvalonTextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = state.summary,
                            color = EvalonTextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }

                item {
                    SectionHeader(title = "Teknik Göstergeler")
                }

                items(state.indicators) { indicator ->
                    IndicatorRow(indicator)
                }
            }
        }
    }
}

@Composable
private fun IndicatorRow(indicator: AnalysisIndicator) {
    val signalColor = when (indicator.signal) {
        AnalysisSignal.BUY -> EvalonGreen
        AnalysisSignal.SELL -> EvalonRed
        AnalysisSignal.NEUTRAL -> EvalonOrange
    }
    val signalText = when (indicator.signal) {
        AnalysisSignal.BUY -> "AL"
        AnalysisSignal.SELL -> "SAT"
        AnalysisSignal.NEUTRAL -> "NÖTR"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = indicator.name,
                color = EvalonTextPrimary,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
            Text(
                text = indicator.value,
                color = EvalonTextSecondary,
                fontSize = 12.sp
            )
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(signalColor.copy(alpha = 0.15f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = signalText,
                color = signalColor,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }
    }
}
