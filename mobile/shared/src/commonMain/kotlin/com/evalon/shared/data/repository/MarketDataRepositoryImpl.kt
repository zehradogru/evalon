package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.MarketDataApi
import com.evalon.shared.domain.model.DataInterval
import com.evalon.shared.domain.model.MarketData
import com.evalon.shared.domain.model.MarketDataRequest
import com.evalon.shared.domain.repository.MarketDataRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class MarketDataRepositoryImpl(
    private val marketDataApi: MarketDataApi
) : MarketDataRepository {

    override suspend fun getMarketData(request: MarketDataRequest): Result<List<MarketData>> {
        return try {
            Result.success(marketDataApi.getMarketData(request))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getLatestPrice(symbol: String): Result<Double> {
        return try {
            Result.success(marketDataApi.getLatestPrice(symbol))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun observeMarketData(symbol: String, interval: DataInterval): Flow<MarketData> = flow {
        // TODO: Implement real-time market data observation
        // For now, just fetch latest price periodically
        while (true) {
            try {
                val price = marketDataApi.getLatestPrice(symbol)
                // Create a MarketData object with latest price
                // This is a simplified version
                kotlinx.coroutines.delay(1000) // Poll every second
            } catch (e: Exception) {
                kotlinx.coroutines.delay(5000) // Retry after 5 seconds on error
            }
        }
    }
}
