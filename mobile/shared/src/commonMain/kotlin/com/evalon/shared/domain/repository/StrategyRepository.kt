package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.model.StrategyStatus
import kotlinx.coroutines.flow.Flow

interface StrategyRepository {
    fun getStrategies(userId: String): Flow<List<Strategy>>
    suspend fun getStrategy(id: String): Result<Strategy>
    suspend fun createStrategy(strategy: Strategy): Result<Strategy>
    suspend fun updateStrategy(strategy: Strategy): Result<Strategy>
    suspend fun deleteStrategy(id: String): Result<Unit>
    suspend fun updateStrategyStatus(id: String, status: StrategyStatus): Result<Strategy>
}
