package com.evalon.shared.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * API Response DTO for /v1/prices endpoint.
 * 
 * Example Response:
 * {
 *   "ticker": "THYAO",
 *   "timeframe": "1m",
 *   "rows": 1000,
 *   "data": [...]
 * }
 */
@Serializable
data class PricesResponseDto(
    val ticker: String,
    val timeframe: String,
    val rows: Int,
    val data: List<CandleDto>
)

/**
 * Single candle data from API.
 * Uses short field names as returned by the API.
 */
@Serializable
data class CandleDto(
    @SerialName("t") val time: String,      // Time (ISO String: "2026-01-21T10:00:00")
    @SerialName("o") val open: Double,       // Open price
    @SerialName("h") val high: Double,       // High price
    @SerialName("l") val low: Double,        // Low price
    @SerialName("c") val close: Double,      // Close price
    @SerialName("v") val volume: Long        // Volume
)
