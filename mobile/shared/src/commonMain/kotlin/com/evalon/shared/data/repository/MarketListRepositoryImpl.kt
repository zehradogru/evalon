package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.MarketsApi
import com.evalon.shared.domain.model.MarketItem
import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.domain.repository.MarketListResult
import com.evalon.shared.util.currentTimeMillis
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
        val now = currentTimeMillis()
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

                val responseItems = if (response.items.isNotEmpty()) response.items else response.data

                if (response.warming || responseItems.isEmpty()) {
                    attempt++
                    if (attempt >= maxAttempts) {
                        return MarketListResult(
                            items = cache[exchange]?.items ?: emptyList(),
                            isWarming = true
                        )
                    }
                    // Short delay before next poll
                    delay(3_000L)
                    continue
                }

                val items = responseItems.map { dto ->
                    val symbol = dto.ticker.ifBlank { dto.symbol }
                    MarketItem(
                        symbol = symbol,
                        name = dto.name.ifBlank { symbol },
                        price = dto.price ?: 0.0,
                        changePercent = dto.changePct ?: dto.changePercent ?: 0.0,
                        volume = dto.volume ?: dto.vol?.toString() ?: ""
                    )
                }

                cache[exchange] = CacheEntry(items = items, fetchedAt = currentTimeMillis())
                return MarketListResult(items = items, isStale = response.stale || response.meta?.stale == true)

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
