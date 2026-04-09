package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.DataInterval
import com.evalon.shared.domain.model.MarketData
import com.evalon.shared.domain.model.MarketDataRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.datetime.Instant

interface MarketDataRepository {
    suspend fun getMarketData(request: MarketDataRequest): Result<List<MarketData>>
    suspend fun getLatestPrice(symbol: String): Result<Double>
    fun observeMarketData(symbol: String, interval: DataInterval): Flow<MarketData>
}
