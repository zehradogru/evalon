package com.evalon.shared.presentation.screens.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.*

data class MenuItem(
    val title: String,
    val icon: ImageVector,
    val color: Color,
    val route: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuScreen(
    component: MenuComponent,
    onTrendingClick: () -> Unit = {},
    onStrategyClick: () -> Unit = {},
    onAnalysisClick: () -> Unit = {},
    onCorrelationClick: () -> Unit = {},
    onCompanyStocksClick: () -> Unit = {},
    onBacktestClick: () -> Unit = {},
    onLLMClick: () -> Unit = {},
    onWatchlistClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {}
) {
    val menuItems = listOf(
        MenuItem("Trendler", Icons.Filled.TrendingUp, EvalonGreen, "trending"),
        MenuItem("Stratejiler", Icons.Filled.Assessment, EvalonBlue, "strategy"),
        MenuItem("Analiz", Icons.Filled.Analytics, EvalonOrange, "analysis"),
        MenuItem("Korelasyon", Icons.Filled.BubbleChart, Color(0xFF9C27B0), "correlation"),
        MenuItem("Şirketler", Icons.Filled.Business, Color(0xFF00BCD4), "companystocks"),
        MenuItem("Backtest", Icons.Filled.History, Color(0xFFFF7043), "backtest"),
        MenuItem("AI Asistan", Icons.Filled.SmartToy, Color(0xFF7C4DFF), "llm"),
        MenuItem("İzleme Listesi", Icons.Filled.Star, Color(0xFFFFD600), "watchlist"),
        MenuItem("Ayarlar", Icons.Filled.Settings, EvalonTextSecondary, "settings")
    )

    Scaffold(
        containerColor = EvalonDarkBg,
        topBar = {
            Surface(
                color = EvalonDarkSurface,
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Menü",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = EvalonTextPrimary
                    )
                }
            }
        }
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(menuItems) { item ->
                MenuCard(
                    item = item,
                    onClick = {
                        when (item.route) {
                            "trending" -> onTrendingClick()
                            "strategy" -> onStrategyClick()
                            "analysis" -> onAnalysisClick()
                            "correlation" -> onCorrelationClick()
                            "companystocks" -> onCompanyStocksClick()
                            "backtest" -> onBacktestClick()
                            "llm" -> onLLMClick()
                            "watchlist" -> onWatchlistClick()
                            "settings" -> onSettingsClick()
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun MenuCard(
    item: MenuItem,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = EvalonSurfaceVariant)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(item.color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = item.icon,
                    contentDescription = item.title,
                    tint = item.color,
                    modifier = Modifier.size(26.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = item.title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = EvalonTextPrimary,
                textAlign = TextAlign.Center,
                maxLines = 2,
                lineHeight = 14.sp
            )
        }
    }
}
