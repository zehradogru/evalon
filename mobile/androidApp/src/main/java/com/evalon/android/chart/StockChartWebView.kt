package com.evalon.android.chart

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

/**
 * JSON string'i JavaScript string literal olarak güvenli hale getirir.
 * evaluateJavascript içinde tek tırnakla kullanım için.
 */
private fun escapeJsonForJs(json: String): String =
    json.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "\\r")
        .replace("\n", "\\n")

/**
 * TradingView Lightweight Charts kullanan, yerel chart.html yükleyen
 * ve dışarıdan veri alabilen WebView bileşeni.
 *
 * Kullanım:
 * - [chartDataJson] güncellendiğinde grafik evaluateJavascript ile güncellenir.
 * - Veriyi [ChartDataMapper.mapAndToJson] ile hazırlayıp buraya verebilirsiniz.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun StockChartWebView(
    modifier: Modifier = Modifier,
    chartDataJson: String? = null
) {
    val chartDataHolder = remember { mutableStateOf(chartDataJson) }
    chartDataHolder.value = chartDataJson

    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        // 2. BEKLEME YOK! Direkt Gönder
                        chartDataHolder.value?.takeIf { it.isNotBlank() }?.let { json ->
                            val escaped = escapeJsonForJs(json)
                            view?.evaluateJavascript(
                                "if(typeof updateChartData==='function'){ updateChartData('$escaped'); }",
                                null
                            )
                        }
                    }
                }
                loadUrl("file:///android_asset/chart.html")
            }
        },
        update = { webView ->
            chartDataJson?.takeIf { it.isNotBlank() }?.let { json ->
                val escaped = escapeJsonForJs(json)
                webView.evaluateJavascript(
                    "if(typeof updateChartData==='function'){ updateChartData('$escaped'); }",
                    null
                )
            }
        }
    )

}
