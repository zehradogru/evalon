package com.evalon.shared

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
expect fun PlatformChartView(
    symbol: String,
    modifier: Modifier = Modifier
)
