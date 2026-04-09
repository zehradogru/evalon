package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.Portfolio
import com.evalon.shared.domain.repository.PortfolioRepository
import kotlinx.coroutines.flow.Flow

class GetPortfolioUseCase(
    private val portfolioRepository: PortfolioRepository
) {
    operator fun invoke(userId: String): Flow<Portfolio> {
        return portfolioRepository.getPortfolio(userId)
    }
}
