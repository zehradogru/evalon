package com.evalon.shared.presentation.screens.stockdetail

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
actual fun StockChartContent(uiState: StockDetailUiState) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        when {
            uiState.isLoading -> {
                CircularProgressIndicator()
            }
            uiState.errorMessage != null -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Grafik Yüklenemedi",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = uiState.errorMessage,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            else -> {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Grafik: ${uiState.ticker}",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Timeframe: ${uiState.selectedTimeframe.displayLabel}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = "${uiState.candles.size} mum verisi",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        text = "(iOS grafik desteği yakında)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
