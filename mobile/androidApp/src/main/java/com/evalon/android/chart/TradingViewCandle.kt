package com.evalon.android.chart

import com.google.gson.annotations.SerializedName

/**
 * TradingView Lightweight Charts kütüphanesinin beklediği candlestick veri formatı.
 * HTML/JS tarafında updateChartData(jsonData) ile kullanılır.
 */
data class TradingViewCandle(
    @SerializedName("time") val time: String,
    @SerializedName("open") val open: Double,
    @SerializedName("high") val high: Double,
    @SerializedName("low") val low: Double,
    @SerializedName("close") val close: Double
)
