package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.Portfolio
import kotlinx.coroutines.flow.Flow

interface PortfolioRepository {
    fun getPortfolio(userId: String): Flow<Portfolio>
    suspend fun refreshPortfolio(userId: String): Result<Portfolio>
}
