package com.evalon.android.chart

import com.google.gson.annotations.SerializedName

/**
 * Backend REST API'den gelen mum (candlestick) verisi modeli.
 * JSON formatı ile birebir uyumludur.
 *
 * Örnek JSON:
 * {
 *   "date": "2023-10-25",
 *   "open": 150.50,
 *   "high": 155.20,
 *   "low": 149.80,
 *   "close": 153.40
 * }
 */
data class StockCandleDto(
    @SerializedName("date") val date: String,
    @SerializedName("open") val open: Double,
    @SerializedName("high") val high: Double,
    @SerializedName("low") val low: Double,
    @SerializedName("close") val close: Double
)
