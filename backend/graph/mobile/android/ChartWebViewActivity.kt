package com.graph.chart

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

/**
 * ChartWebViewActivity — Android native wrapper for the chart-client WebView.
 * Loads the chart web app and provides the ChartBridge JavaScript interface
 * for bidirectional communication.
 */
class ChartWebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val CHART_URL = "https://chart.yourdomain.com" // or local dev URL

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mediaPlaybackRequiresUserGesture = false

            // Disable zoom controls (chart handles its own zoom)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false

            // Performance optimizations
            setLayerType(LAYER_TYPE_HARDWARE, null)

            // Bridge: Web → Native
            addJavascriptInterface(ChartBridgeInterface(), "ChartBridgeNative")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    // Chart is loaded, send initial commands if needed
                }
            }
        }

        setContentView(webView)
        webView.loadUrl(CHART_URL)
    }

    // ─── Native → Web Commands ─────────────────────────────────────

    fun setSymbol(symbol: String) {
        sendCommand("setSymbol", JSONObject().put("symbol", symbol))
    }

    fun setTimeframe(tf: String) {
        sendCommand("setTimeframe", JSONObject().put("tf", tf))
    }

    fun toggleLayer(layer: String, visible: Boolean) {
        sendCommand("toggleLayer", JSONObject().put("layer", layer).put("visible", visible))
    }

    fun loadBacktest(runId: String) {
        sendCommand("loadBacktest", JSONObject().put("runId", runId))
    }

    fun setStrategy(strategyId: String, params: JSONObject) {
        sendCommand("setStrategy", JSONObject().put("strategyId", strategyId).put("params", params))
    }

    fun setTheme(theme: String) {
        sendCommand("setTheme", JSONObject().put("theme", theme))
    }

    private fun sendCommand(type: String, payload: JSONObject) {
        val msg = JSONObject().apply {
            put("id", "cmd_${System.currentTimeMillis()}")
            put("type", type)
            put("payload", payload)
            put("ts", System.currentTimeMillis())
        }
        val js = "window.ChartBridge.receive(${msg})"
        webView.evaluateJavascript(js, null)
    }

    // ─── Web → Native Bridge Interface ─────────────────────────────

    inner class ChartBridgeInterface {
        @JavascriptInterface
        fun postMessage(json: String) {
            try {
                val msg = JSONObject(json)
                val type = msg.getString("type")
                val payload = msg.getJSONObject("payload")

                runOnUiThread {
                    handleBridgeEvent(type, payload)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun handleBridgeEvent(type: String, payload: JSONObject) {
        when (type) {
            "ready" -> {
                val version = payload.getString("version")
                // Chart is ready, can now send commands
            }
            "markerClicked" -> {
                val markerId = payload.getString("markerId")
                val markerType = payload.getString("markerType")
                // Show trade detail dialog, navigate, etc.
            }
            "drawingCreated" -> {
                // Sync drawing state if needed
            }
            "drawingUpdated" -> {
                // Sync drawing state if needed
            }
            "drawingDeleted" -> {
                // Sync drawing state if needed
            }
            "selectionChanged" -> {
                // Update native UI based on selection
            }
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
