package com.evalon.android.chart

import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Hisse senedi mum verisi için Retrofit API interface örneği.
 * Backend endpoint'inize göre path ve parametreleri güncelleyin.
 */
interface StockChartApi {

    /**
     * Örnek: GET /api/chart/candles?symbol=AAPL
     * Response: List<StockCandleDto>
     */
    @GET("api/chart/candles")
    suspend fun getCandles(@Query("symbol") symbol: String): List<StockCandleDto>
}
