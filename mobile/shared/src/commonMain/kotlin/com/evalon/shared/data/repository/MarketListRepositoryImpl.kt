package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.MarketsApi
import com.evalon.shared.domain.model.MarketItem
import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.domain.repository.MarketListResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

private data class CacheEntry(
    val items: List<MarketItem>,
    val fetchedAt: Long  // epoch millis
)

/** In-memory Stale-While-Revalidate cache with warming support. */
class MarketListRepositoryImpl(
    private val marketsApi: MarketsApi
) : MarketListRepository {

    private val cache = mutableMapOf<String, CacheEntry>()
    private val cacheTtlMs = 5 * 60 * 1000L  // 5 minutes

    override fun observeMarketList(exchange: String): Flow<MarketListResult> = flow {
        val now = System.currentTimeMillis()
        val cached = cache[exchange]

        // Emit stale cache immediately so UI is never blank
        if (cached != null) {
            val isStale = (now - cached.fetchedAt) > cacheTtlMs
            emit(MarketListResult(items = cached.items, isStale = isStale))
            if (!isStale) return@flow
        }

        // Fetch fresh data from API
        val result = fetchWithWarmingHandling(exchange)
        emit(result)
    }

    override suspend fun refresh(exchange: String) {
        cache.remove(exchange)
        fetchWithWarmingHandling(exchange)
    }

    /**
     * Handles the server warming pattern:
     * - If warming:true is returned, poll every 3 seconds until data arrives
     * - Otherwise store in cache and return
     */
    private suspend fun fetchWithWarmingHandling(exchange: String): MarketListResult {
        val maxAttempts = 10
        var attempt = 0

        while (attempt < maxAttempts) {
            try {
                val response = marketsApi.getMarketList(exchange)

                if (response.warming || response.data.isEmpty()) {
                    attempt++
                    if (attempt >= maxAttempts) {
                        return MarketListResult(
                            items = cache[exchange]?.items ?: emptyList(),
                            isWarming = true
                        )
                    }
                    // Server is still warming — notify UI and retry
                    val staleItems = cache[exchange]?.items ?: emptyList()
                    // Short delay before next poll
                    delay(3_000L)
                    continue
                }

                val items = response.data.map { dto ->
                    MarketItem(
                        symbol = dto.symbol,
                        name = dto.name,
                        price = dto.price,
                        changePercent = dto.changePercent,
                        volume = dto.volume ?: ""
                    )
                }

                cache[exchange] = CacheEntry(items = items, fetchedAt = System.currentTimeMillis())
                return MarketListResult(items = items)

            } catch (e: Exception) {
                val staleItems = cache[exchange]?.items ?: emptyList()
                return MarketListResult(
                    items = staleItems,
                    isWarming = false,
                    isStale = true
                )
            }
        }

        return MarketListResult(
            items = cache[exchange]?.items ?: emptyList(),
            isWarming = true
        )
    }
}
