package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.BacktestResult
import com.evalon.shared.domain.repository.BacktestRepository
import kotlinx.datetime.Instant

class RunBacktestUseCase(
    private val backtestRepository: BacktestRepository
) {
    suspend operator fun invoke(
        strategyId: String,
        startDate: Instant,
        endDate: Instant,
        initialCapital: Double
    ): Result<BacktestResult> {
        return backtestRepository.runBacktest(
            strategyId = strategyId,
            startDate = startDate,
            endDate = endDate,
            initialCapital = initialCapital
        )
    }
}
