package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.repository.StrategyRepository
import kotlinx.coroutines.flow.Flow

class GetStrategiesUseCase(
    private val strategyRepository: StrategyRepository
) {
    operator fun invoke(userId: String): Flow<List<Strategy>> {
        return strategyRepository.getStrategies(userId)
    }
}
