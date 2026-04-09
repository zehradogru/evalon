package com.evalon.android.chart

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Hisse senedi mum grafiği ekranı.
 *
 * Retrofit ile kullanım örneği:
 * - ViewModel'de API'den List<StockCandleDto> alınır.
 * - ChartDataMapper.mapAndToJson(candles) ile JSON string üretilir.
 * - Bu string StockChartWebView'e chartDataJson olarak verilir.
 *
 * Örnek ViewModel:
 * ```
 * val chartData = mutableStateOf<String?>(null)
 * viewModelScope.launch {
 *     val candles = api.getStockCandles(symbol) // List<StockCandleDto>
 *     chartData.value = ChartDataMapper.mapAndToJson(candles)
 * }
 * ```
 */
@Composable
fun StockChartScreen(
    modifier: Modifier = Modifier,
    chartDataJson: String? = null
) {
    StockChartWebView(
        modifier = modifier.fillMaxSize(),
        chartDataJson = chartDataJson
    )
}
