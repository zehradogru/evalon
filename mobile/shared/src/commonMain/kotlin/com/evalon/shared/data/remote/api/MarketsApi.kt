package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.dto.MarketListResponseDto
import com.evalon.shared.data.remote.dto.MarketOverviewResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

class MarketsApi(private val client: HttpClient) {

    /**
     * Fetches the market snapshot list for a given exchange.
     * Response may include warming:true when server cache is cold.
     */
    suspend fun getMarketList(
        exchange: String = "BIST",
        limit: Int = 50,
        cursor: String? = null,
        sortBy: String = "changePct",
        sortDir: String = "desc",
        query: String? = null
    ): MarketListResponseDto {
        return client.get(ApiConfig.MARKET_LIST) {
            parameter("view", if (exchange.equals("SCREENER", ignoreCase = true)) "screener" else "markets")
            parameter("limit", limit)
            parameter("sortBy", sortBy)
            parameter("sortDir", sortDir)
            if (cursor != null) parameter("cursor", cursor)
            if (!query.isNullOrBlank()) parameter("q", query)
        }.body()
    }

    suspend fun getMarketOverview(): MarketOverviewResponseDto {
        return client.get(ApiConfig.MARKET_OVERVIEW).body()
    }
}
