package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.dto.MarketListResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

class MarketsApi(private val client: HttpClient) {

    /**
     * Fetches the market snapshot list for a given exchange.
     * Response may include warming:true when server cache is cold.
     */
    suspend fun getMarketList(exchange: String = "BIST"): MarketListResponseDto {
        return client.get(ApiConfig.MARKET_LIST) {
            parameter("exchange", exchange)
        }.body()
    }
}
