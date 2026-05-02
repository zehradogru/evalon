package com.evalon.shared

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

const val EVALON_GRAPH_WEB_BASE_URL =
    "https://evalon-graph-web-474112640179.europe-west1.run.app"

enum class EvalonGraphPage(val path: String) {
    Chart("chart"),
    Backtest("backtest"),
    Ai("ai")
}

fun buildEvalonGraphUrl(
    symbol: String,
    timeframe: String = "1d",
    page: EvalonGraphPage = EvalonGraphPage.Chart,
    embed: Boolean = true
): String {
    val normalizedSymbol = symbol.trim().uppercase().ifBlank { "THYAO" }
    val normalizedTimeframe = timeframe.trim().ifBlank { "1d" }
    val embedPart = if (embed) "&embed=1" else ""

    return "$EVALON_GRAPH_WEB_BASE_URL/${page.path}?symbol=$normalizedSymbol&tf=$normalizedTimeframe$embedPart"
}

@Composable
expect fun PlatformWebPage(
    url: String,
    modifier: Modifier = Modifier
)
