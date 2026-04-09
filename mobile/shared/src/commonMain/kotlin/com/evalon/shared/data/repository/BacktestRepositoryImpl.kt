package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.BacktestApi
import com.evalon.shared.domain.model.BacktestResult
import com.evalon.shared.domain.repository.BacktestRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.datetime.Instant

class BacktestRepositoryImpl(
    private val backtestApi: BacktestApi
) : BacktestRepository {

    override suspend fun runBacktest(
        strategyId: String,
        startDate: Instant,
        endDate: Instant,
        initialCapital: Double
    ): Result<BacktestResult> {
        return try {
            Result.success(
                backtestApi.runBacktest(strategyId, startDate, endDate, initialCapital)
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getBacktestResult(id: String): Result<BacktestResult> {
        return try {
            Result.success(backtestApi.getBacktestResult(id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getBacktestResults(strategyId: String): Flow<List<BacktestResult>> = flow {
        try {
            val results = backtestApi.getBacktestResults(strategyId)
            emit(results)
        } catch (e: Exception) {
            emit(emptyList())
        }
    }
}
