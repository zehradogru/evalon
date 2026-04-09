package com.evalon.shared.data.repository

import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.data.mapper.StockCandleMapper
import com.evalon.shared.data.remote.api.PricesApi
import com.evalon.shared.domain.model.StockCandle
import com.evalon.shared.domain.model.Timeframe
import com.evalon.shared.domain.repository.StockPriceRepository

/**
 * Fetches candles from the remote API and caches them via SQLDelight.
 * Falls back to cached data when the network is unavailable.
 */
class StockPriceRepositoryImpl(
    private val pricesApi: PricesApi,
    private val dbHelper: DatabaseHelper
) : StockPriceRepository {

    override suspend fun getStockCandles(
        ticker: String,
        timeframe: Timeframe,
        limit: Int?
    ): Result<List<StockCandle>> {
        return try {
            val response = pricesApi.getPrices(
                ticker = ticker,
                timeframe = timeframe.apiValue,
                limit = limit
            )
            val candles = StockCandleMapper.mapToDomain(response)
            // Persist to local cache in the background
            if (candles.isNotEmpty()) {
                dbHelper.cacheCandles("${ticker}_${timeframe.apiValue}", candles)
            }
            Result.success(candles)
        } catch (e: Exception) {
            // Network failure — try local cache
            val cacheKey = "${ticker}_${timeframe.apiValue}"
            val cached = dbHelper.getCachedCandles(cacheKey, (limit ?: 500).toLong())
            if (cached.isNotEmpty()) {
                Result.success(cached)
            } else {
                Result.failure(e)
            }
        }
    }
}
