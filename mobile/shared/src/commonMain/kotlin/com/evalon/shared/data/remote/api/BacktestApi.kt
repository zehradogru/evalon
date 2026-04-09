package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.BacktestResult
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.datetime.Instant

class BacktestApi(private val client: HttpClient) {
    suspend fun runBacktest(
        strategyId: String,
        startDate: Instant,
        endDate: Instant,
        initialCapital: Double
    ): BacktestResult {
        return client.post(ApiConfig.STRATEGY_BACKTEST.replace("{id}", strategyId)) {
            setBody(
                mapOf(
                    "startDate" to startDate.toString(),
                    "endDate" to endDate.toString(),
                    "initialCapital" to initialCapital
                )
            )
        }.body()
    }

    suspend fun getBacktestResult(id: String): BacktestResult {
        return client.get("${ApiConfig.STRATEGY_BACKTEST}/$id".replace("{id}", "")).body()
    }

    suspend fun getBacktestResults(strategyId: String): List<BacktestResult> {
        return client.get("${ApiConfig.STRATEGY_BACKTEST}/results".replace("{id}", strategyId)).body()
    }
}
