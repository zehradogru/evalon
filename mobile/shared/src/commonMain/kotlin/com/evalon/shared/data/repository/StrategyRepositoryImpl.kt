package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.StrategyApi
import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.model.StrategyStatus
import com.evalon.shared.domain.repository.StrategyRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class StrategyRepositoryImpl(
    private val strategyApi: StrategyApi
) : StrategyRepository {

    override fun getStrategies(userId: String): Flow<List<Strategy>> = flow {
        try {
            val strategies = strategyApi.getStrategies(userId)
            emit(strategies)
        } catch (e: Exception) {
            emit(emptyList())
        }
    }

    override suspend fun getStrategy(id: String): Result<Strategy> {
        return try {
            Result.success(strategyApi.getStrategy(id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun createStrategy(strategy: Strategy): Result<Strategy> {
        return try {
            Result.success(strategyApi.createStrategy(strategy))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateStrategy(strategy: Strategy): Result<Strategy> {
        return try {
            Result.success(strategyApi.updateStrategy(strategy))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteStrategy(id: String): Result<Unit> {
        return try {
            strategyApi.deleteStrategy(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateStrategyStatus(id: String, status: StrategyStatus): Result<Strategy> {
        return try {
            val strategy = strategyApi.getStrategy(id)
            val updatedStrategy = strategy.copy(status = status)
            Result.success(strategyApi.updateStrategy(updatedStrategy))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
