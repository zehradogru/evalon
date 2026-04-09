package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.StockCandle
import com.evalon.shared.domain.model.Timeframe

/**
 * Repository interface for fetching stock price data.
 * Following Clean Architecture, this interface is in the domain layer.
 */
interface StockPriceRepository {
    
    /**
     * Fetches stock candles for the given ticker and timeframe.
     * 
     * @param ticker Stock symbol (e.g., "THYAO")
     * @param timeframe Time interval for candles
     * @param limit Optional limit on number of candles
     * @return Result containing list of StockCandle or error
     */
    suspend fun getStockCandles(
        ticker: String,
        timeframe: Timeframe = Timeframe.MINUTE_1,
        limit: Int? = null
    ): Result<List<StockCandle>>
}
