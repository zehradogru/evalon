package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.BacktestResult
import kotlinx.coroutines.flow.Flow
import kotlinx.datetime.Instant

interface BacktestRepository {
    suspend fun runBacktest(
        strategyId: String,
        startDate: Instant,
        endDate: Instant,
        initialCapital: Double
    ): Result<BacktestResult>
    
    suspend fun getBacktestResult(id: String): Result<BacktestResult>
    fun getBacktestResults(strategyId: String): Flow<List<BacktestResult>>
}
