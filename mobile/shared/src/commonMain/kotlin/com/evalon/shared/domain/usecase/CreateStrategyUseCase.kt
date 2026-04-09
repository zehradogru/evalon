package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.repository.StrategyRepository

class CreateStrategyUseCase(
    private val strategyRepository: StrategyRepository
) {
    suspend operator fun invoke(strategy: Strategy): Result<Strategy> {
        return strategyRepository.createStrategy(strategy)
    }
}
