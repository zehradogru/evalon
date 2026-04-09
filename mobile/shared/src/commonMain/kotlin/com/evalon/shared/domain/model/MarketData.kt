package com.evalon.shared.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class MarketData(
    val symbol: String,
    val timestamp: Instant,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Long
)

@Serializable
data class MarketDataRequest(
    val symbol: String,
    val startDate: Instant,
    val endDate: Instant,
    val interval: DataInterval = DataInterval.DAILY
)

enum class DataInterval {
    MINUTE_1,
    MINUTE_5,
    MINUTE_15,
    MINUTE_30,
    HOUR_1,
    DAILY,
    WEEKLY,
    MONTHLY
}
