package com.evalon.android.chart

import com.google.gson.Gson
import com.google.gson.GsonBuilder

/**
 * Backend API verisini TradingView Lightweight Charts formatına çevirir
 * ve JSON String olarak döndürür.
 *
 * Sayı formatlama gerekiyorsa shared modüldeki [com.evalon.shared.util.format] (Double.format(digits)) kullanın.
 */
object ChartDataMapper {

    /** Grafik verisi için kompakt JSON (WebView'e gönderim). */
    private val gson: Gson by lazy { Gson() }

    /**
     * API'den gelen [StockCandleDto] listesini TradingView formatına çevirir.
     * Backend'deki "date" alanı TradingView'de "time" olarak kullanılır (yyyy-mm-dd).
     *
     * @param apiCandles Backend'den gelen mum verisi listesi
     * @return TradingView'in kabul ettiği formatta JSON string
     */
    fun toTradingViewJson(apiCandles: List<StockCandleDto>): String {
        val tradingViewCandles = apiCandles.map { dto ->
            TradingViewCandle(
                time = dto.date,
                open = dto.open,
                high = dto.high,
                low = dto.low,
                close = dto.close
            )
        }
        return gson.toJson(tradingViewCandles)
    }

    /**
     * API response listesini doğrudan JSON string'e çevirmek için kullanılır.
     * Retrofit/API'den gelen List<StockCandleDto> ile uyumludur.
     */
    fun mapAndToJson(apiCandles: List<StockCandleDto>): String =
        toTradingViewJson(apiCandles)
}
