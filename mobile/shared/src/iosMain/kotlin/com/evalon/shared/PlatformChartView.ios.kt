package com.evalon.shared

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
actual fun PlatformChartView(
    symbol: String,
    modifier: Modifier
) {
    PlatformWebPage(
        url = buildEvalonGraphUrl(symbol = symbol, page = EvalonGraphPage.Chart),
        modifier = modifier
    )
}
