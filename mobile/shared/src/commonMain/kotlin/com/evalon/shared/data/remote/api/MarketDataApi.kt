package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.MarketData
import com.evalon.shared.domain.model.MarketDataRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody

class MarketDataApi(private val client: HttpClient) {
    suspend fun getMarketData(request: MarketDataRequest): List<MarketData> {
        return client.post(ApiConfig.MARKET_DATA) {
            setBody(request)
        }.body()
    }

    suspend fun getLatestPrice(symbol: String): Double {
        return client.get(ApiConfig.MARKET_DATA_LATEST.replace("{symbol}", symbol))
            .body<Map<String, Double>>()["price"] ?: throw Exception("Price not found")
    }
}
