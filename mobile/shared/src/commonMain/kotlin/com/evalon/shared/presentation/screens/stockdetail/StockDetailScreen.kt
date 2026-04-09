package com.evalon.shared.presentation.screens.stockdetail

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.evalon.shared.presentation.ui.theme.*

// Evalon Color Aliases
private val DarkBackground = EvalonDarkBg
private val DarkSurface = EvalonDarkSurface
private val TextPrimary = EvalonTextPrimary
private val TextSecondary = EvalonTextSecondary
private val AccentColor = EvalonBlue
private val DarkSurfaceVariant = EvalonSurfaceVariant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockDetailScreen(
    component: StockDetailComponent,
    onBack: () -> Unit
) {
    val uiState by component.viewModel.uiState.collectAsState()
    
    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                title = { 
                    Row(
                        modifier = Modifier
                            .clickable { component.viewModel.onTickerSheetOpen(true) }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = uiState.ticker, // Use state ticker instead of initial component ticker
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Icon(
                            imageVector = Icons.Default.KeyboardArrowDown,
                            contentDescription = "Hisse Seç",
                            tint = TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Geri",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkSurface,
                    titleContentColor = TextPrimary,
                    navigationIconContentColor = TextPrimary
                )
            )
        },
        bottomBar = {
            TradeActionBar(
                currentPrice = uiState.currentPrice,
                totalAmount = uiState.totalCost,
                priceChangePercent = uiState.priceChangePercent,
                isPriceUp = uiState.isPriceUp,
                quantity = uiState.tradeQuantity,
                onIncreaseQuantity = { component.viewModel.onIncreaseQuantity() },
                onDecreaseQuantity = { component.viewModel.onDecreaseQuantity() },
                onBuyClicked = { component.viewModel.onBuyClicked() },
                onSellClicked = { component.viewModel.onSellClicked() }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(DarkBackground)
                .padding(padding)
        ) {
            // Timeframe Selector
            TimeframeSelector(
                timeframes = uiState.availableTimeframes,
                selectedTimeframe = uiState.selectedTimeframe,
                onTimeframeSelected = { component.viewModel.onTimeframeSelected(it) }
            )
            
            // Chart Content
            StockChartContent(
                uiState = uiState
            )
        }
        
        if (uiState.isTickerSheetOpen) {
            ModalBottomSheet(
                onDismissRequest = { component.viewModel.onTickerSheetOpen(false) },
                containerColor = DarkSurface,
                dragHandle = { BottomSheetDefaults.DragHandle(color = TextSecondary) }
            ) {
                TickerSelectionSheet(
                    searchQuery = uiState.searchQuery,
                    onSearchQueryChanged = { component.viewModel.onSearchQueryChanged(it) },
                    selectedExchange = uiState.selectedExchange,
                    onExchangeSelected = { component.viewModel.onExchangeSelected(it) },
                    tickers = uiState.filteredTickers,
                    onTickerSelected = { component.viewModel.onTickerSelected(it) }
                )
            }
        }
    }
}

@Composable
private fun TickerSelectionSheet(
    searchQuery: String,
    onSearchQueryChanged: (String) -> Unit,
    selectedExchange: com.evalon.shared.domain.model.ExchangeCategory,
    onExchangeSelected: (com.evalon.shared.domain.model.ExchangeCategory) -> Unit,
    tickers: List<String>,
    onTickerSelected: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight(0.8f)
            .padding(horizontal = 20.dp)
    ) {
        Text(
            text = "Hisse Seç",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Exchange Category Tabs
        ExchangeTabRow(
            selectedExchange = selectedExchange,
            onExchangeSelected = onExchangeSelected
        )

        Spacer(modifier = Modifier.height(12.dp))
        
        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchQueryChanged,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            placeholder = { Text("Hisse Ara", color = TextSecondary) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = DarkSurfaceVariant,
                unfocusedContainerColor = DarkSurfaceVariant,
                focusedBorderColor = AccentColor,
                unfocusedBorderColor = Color.Transparent,
                cursorColor = AccentColor,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            )
        )
        
        // Ticker List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            items(tickers) { ticker ->
                TickerItem(
                    ticker = ticker,
                    onClick = { onTickerSelected(ticker) }
                )
            }
        }
    }
}

/**
 * Horizontal exchange category selector with animated chips.
 */
@Composable
private fun ExchangeTabRow(
    selectedExchange: com.evalon.shared.domain.model.ExchangeCategory,
    onExchangeSelected: (com.evalon.shared.domain.model.ExchangeCategory) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurfaceVariant)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        com.evalon.shared.domain.model.ExchangeCategory.entries.forEach { exchange ->
            val isSelected = exchange == selectedExchange
            val bg by animateColorAsState(
                targetValue = if (isSelected) AccentColor else Color.Transparent,
                animationSpec = tween(200),
                label = "exchangeTabBg"
            )
            val textColor by animateColorAsState(
                targetValue = if (isSelected) Color.White else TextSecondary,
                animationSpec = tween(200),
                label = "exchangeTabText"
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(bg)
                    .clickable { onExchangeSelected(exchange) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = exchange.displayName,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = textColor
                )
            }
        }
    }
}

@Composable
private fun TickerItem(
    ticker: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = ticker,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            // Optional: Add full name if available in map
        }
    }
}

/**
 * Platforma göre grafik içeriği: Android'de WebView, diğer platformlarda placeholder.
 */
@Composable
expect fun StockChartContent(uiState: StockDetailUiState)
