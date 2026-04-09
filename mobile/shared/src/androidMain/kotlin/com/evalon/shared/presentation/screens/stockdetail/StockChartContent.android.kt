package com.evalon.shared.presentation.screens.stockdetail

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.evalon.shared.domain.model.StockCandle
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private fun escapeJsonForJs(json: String): String =
    json.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "\\r")
        .replace("\n", "\\n")

/**
 * Converts a list of StockCandle to JSON string for the chart.
 */
private fun List<StockCandle>.toChartJson(): String {
    val array = buildJsonArray {
        this@toChartJson.forEach { candle ->
            add(
                buildJsonObject {
                    put("time", candle.time)
                    put("open", candle.open)
                    put("high", candle.high)
                    put("low", candle.low)
                    put("close", candle.close)
                }
            )
        }
    }
    return array.toString()
}

private fun injectChartData(webView: WebView, json: String) {
    val escaped = escapeJsonForJs(json)
    webView.evaluateJavascript(
        "if(typeof updateChartData==='function'){ updateChartData('$escaped'); }",
        null
    )
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
actual fun StockChartContent(uiState: StockDetailUiState) {
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var pageLoaded by remember { mutableStateOf(false) }
    
    // When candles change, update the chart
    LaunchedEffect(uiState.candles, pageLoaded) {
        if (pageLoaded && uiState.candles.isNotEmpty()) {
            webViewRef?.let { wv ->
                val limitedCandles = uiState.candles.takeLast(200)
                val json = limitedCandles.toChartJson()
                injectChartData(wv, json)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when {
            uiState.isLoading -> {
                CircularProgressIndicator(
                    modifier = Modifier
                        .size(48.dp)
                        .align(Alignment.Center)
                )
            }
            uiState.errorMessage != null -> {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Grafik Yüklenemedi",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = uiState.errorMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            else -> {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
                            settings.apply {
                                allowFileAccess = true
                                allowContentAccess = true
                                domStorageEnabled = true
                            }
                            webViewClient = object : WebViewClient() {
                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    pageLoaded = true
                                    // Inject initial data if available
                                    if (uiState.candles.isNotEmpty()) {
                                        view?.let { wv ->
                                            val limitedCandles = uiState.candles.takeLast(200)
                                            val json = limitedCandles.toChartJson()
                                            injectChartData(wv, json)
                                        }
                                    }
                                }
                            }
                            webViewRef = this
                            loadUrl("file:///android_asset/chart.html")
                        }
                    },
                    update = { webView ->
                        webViewRef = webView
                    }
                )
            }
        }
    }
}