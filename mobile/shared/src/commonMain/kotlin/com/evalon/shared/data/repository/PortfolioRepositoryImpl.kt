package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.PortfolioApi
import com.evalon.shared.domain.model.Portfolio
import com.evalon.shared.domain.repository.PortfolioRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class PortfolioRepositoryImpl(
    private val portfolioApi: PortfolioApi
) : PortfolioRepository {

    override fun getPortfolio(userId: String): Flow<Portfolio> = flow {
        try {
            val portfolio = portfolioApi.getPortfolio(userId)
            emit(portfolio)
        } catch (e: Exception) {
            // TODO: Handle error properly
            throw e
        }
    }

    override suspend fun refreshPortfolio(userId: String): Result<Portfolio> {
        return try {
            val portfolio = portfolioApi.getPortfolio(userId)
            Result.success(portfolio)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
