package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.Strategy
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.request.url

class StrategyApi(private val client: HttpClient) {
    suspend fun getStrategies(userId: String): List<Strategy> {
        return client.get(ApiConfig.STRATEGIES) {
            url {
                parameters.append("userId", userId)
            }
        }.body()
    }

    suspend fun getStrategy(id: String): Strategy {
        return client.get(ApiConfig.STRATEGY_BY_ID.replace("{id}", id)).body()
    }

    suspend fun createStrategy(strategy: Strategy): Strategy {
        return client.post(ApiConfig.STRATEGIES) {
            setBody(strategy)
        }.body()
    }

    suspend fun updateStrategy(strategy: Strategy): Strategy {
        return client.put(ApiConfig.STRATEGY_BY_ID.replace("{id}", strategy.id)) {
            setBody(strategy)
        }.body()
    }

    suspend fun deleteStrategy(id: String) {
        client.delete(ApiConfig.STRATEGY_BY_ID.replace("{id}", id))
    }
}
