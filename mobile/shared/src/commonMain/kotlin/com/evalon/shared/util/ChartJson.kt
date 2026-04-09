package com.evalon.shared.util

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.put

/**
 * Assets'teki fiyat dosyası formatı (THYAO_prices.json).
 * price_datetime: "2026-01-21T09:55:00" gibi ISO format.
 */
@Serializable
data class AssetPriceItem(
    val price_datetime: String,
    val ticker: String? = null,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Long? = null
)

/**
 * TradingView Lightweight Charts candlestick veri formatı (time string).
 */
@Serializable
data class TradingViewCandle(
    val time: String,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double
)

/**
 * TradingView candlestick formatı, time = Unix timestamp (saniye).
 */
data class TradingViewCandleUnix(
    val time: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double
)

private val json = Json { ignoreUnknownKeys = true }

fun List<TradingViewCandle>.toChartJson(): String {
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

/** Grafik JSON'u: time sayı (Unix saniye) olarak. */
fun List<TradingViewCandleUnix>.toChartJsonUnix(): String {
    val array = buildJsonArray {
        this@toChartJsonUnix.forEach { candle ->
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

/**
 * "2026-01-21T09:55:00" gibi ISO datetime'ı Unix saniyeye çevirir (UTC kabul).
 */
fun priceDatetimeToUnixSeconds(priceDatetime: String): Long {
    val instant = kotlinx.datetime.Instant.parse(priceDatetime + "Z")
    return instant.epochSeconds
}

/**
 * Assets'ten okunan JSON string'i (THYAO_prices.json formatı) parse eder.
 */
fun parseAssetPrices(jsonString: String): List<AssetPriceItem> {
    val element = json.parseToJsonElement(jsonString)
    return element.jsonArray.map { json.decodeFromJsonElement(AssetPriceItem.serializer(), it) }
}
