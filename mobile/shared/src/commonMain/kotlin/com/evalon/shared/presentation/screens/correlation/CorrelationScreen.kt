package com.evalon.shared.presentation.screens.correlation

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
fun CorrelationScreen(
    component: CorrelationComponent,
    viewModel: CorrelationViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Korelasyon", onBackClick = onBack)
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
                item {
                    EvalonSearchBar(
                        query = state.searchQuery,
                        onQueryChange = viewModel::onSearchQueryChange,
                        placeholder = "Hisse kodu ile ara..."
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                item {
                    SectionHeader(title = "Yüksek Korelasyonlu Hisseler")
                }

                items(viewModel.getFilteredPairs()) { pair ->
                    CorrelationRow(pair)
                }
            }
        }
    }
}

@Composable
private fun CorrelationRow(pair: CorrelationPair) {
    val correlationColor = when {
        pair.correlation >= 0.8 -> EvalonGreen
        pair.correlation >= 0.5 -> EvalonOrange
        else -> EvalonRed
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Symbol pair
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(EvalonBlue.copy(alpha = 0.15f))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(
                    text = pair.symbol1,
                    color = EvalonBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }

            Text(
                text = " ↔ ",
                color = EvalonTextSecondary,
                fontSize = 14.sp
            )

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(EvalonOrange.copy(alpha = 0.15f))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(
                    text = pair.symbol2,
                    color = EvalonOrange,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = String.format("%.2f", pair.correlation),
                color = correlationColor,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Text(
                text = pair.period,
                color = EvalonTextSecondary,
                fontSize = 11.sp
            )
        }
    }
}
