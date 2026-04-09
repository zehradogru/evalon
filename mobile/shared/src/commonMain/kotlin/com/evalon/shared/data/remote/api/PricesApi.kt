package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.dto.PricesResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/**
 * API Service for fetching stock price data.
 * 
 * Endpoint: GET /v1/prices
 * Parameters:
 *   - ticker: Stock symbol (e.g., "THYAO")
 *   - timeframe: Time interval (e.g., "1m", "5m", "1h", "1d")
 *   - limit: Optional, number of candles to fetch
 */
class PricesApi(private val client: HttpClient) {
    
    /**
     * Fetches price candles for a given ticker and timeframe.
     * 
     * @param ticker Stock symbol (e.g., "THYAO")
     * @param timeframe Time interval (e.g., "1m", "5m", "1h", "1d")
     * @param limit Optional limit on number of candles
     * @return PricesResponseDto containing candle data
     */
    suspend fun getPrices(
        ticker: String,
        timeframe: String = "1m",
        limit: Int? = null
    ): PricesResponseDto {
        return client.get(ApiConfig.PRICES) {
            parameter("ticker", ticker)
            parameter("timeframe", timeframe)
            if (limit != null) {
                parameter("limit", limit)
            }
        }.body()
    }
}
