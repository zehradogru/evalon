package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.MarketItem
import kotlinx.coroutines.flow.Flow

interface MarketListRepository {
    /**
     * Returns a Flow that emits cached data immediately (if available),
     * then fetches fresh data in the background (stale-while-revalidate).
     * Emits an empty list with isWarming=true when server cache is being built.
     */
    fun observeMarketList(exchange: String): Flow<MarketListResult>

    /** Force a refresh, bypassing cache TTL. */
    suspend fun refresh(exchange: String)
}

data class MarketListResult(
    val items: List<MarketItem>,
    val isWarming: Boolean = false,
    val isStale: Boolean = false
)
