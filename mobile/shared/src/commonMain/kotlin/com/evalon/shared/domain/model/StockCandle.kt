package com.evalon.shared.domain.model

/**
 * Domain model for stock price candle data.
 * This is the clean representation used throughout the app.
 */
data class StockCandle(
    val time: Long,      // Unix timestamp in seconds
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Long
)

/**
 * Represents a timeframe for stock data.
 * 
 * @param apiValue The value sent to the API
 * @param displayLabel The label shown in the UI
 */
enum class Timeframe(val apiValue: String, val displayLabel: String) {
    MINUTE_1("1m", "1D"),      // 1 Dakikalık -> Günlük görünüm için
    MINUTE_5("5m", "5D"),      // 5 Dakikalık
    MINUTE_15("15m", "15D"),   // 15 Dakikalık
    MINUTE_30("30m", "30D"),   // 30 Dakikalık
    HOUR_1("1h", "1S"),        // Saatlik
    HOUR_4("4h", "4S"),        // 4 Saatlik
    DAILY("1d", "1G"),         // Günlük
    WEEKLY("1w", "1H"),        // Haftalık
    MONTHLY("1M", "1A"),       // Aylık
    QUARTERLY("3M", "3A"),     // 3 Aylık
    YEARLY("1y", "1Y");        // Yıllık
    
    companion object {
        fun fromString(value: String): Timeframe {
            return entries.find { it.apiValue == value } ?: DAILY
        }
        
        /**
         * Returns the default timeframes used in the UI selector.
         */
        fun selectorDefaults(): List<Timeframe> = listOf(
            DAILY,      // 1G
            WEEKLY,     // 1H
            MONTHLY,    // 1A
            QUARTERLY,  // 3A
            YEARLY      // 1Y
        )
    }
}
