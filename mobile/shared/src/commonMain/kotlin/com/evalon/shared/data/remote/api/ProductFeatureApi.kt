package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

class ProductFeatureApi(private val client: HttpClient) {
    suspend fun getIndicatorCatalog(): JsonElement {
        return client.get(ApiConfig.INDICATORS_CATALOG).body()
    }

    suspend fun getIndicators(
        ticker: String,
        timeframe: String,
        strategy: String,
        params: Map<String, String> = emptyMap()
    ): JsonElement {
        return client.get(ApiConfig.INDICATORS) {
            parameter("ticker", ticker)
            parameter("timeframe", timeframe)
            parameter("strategy", strategy)
            params.forEach { (key, value) -> parameter(key, value) }
        }.body()
    }

    suspend fun getScreenerTickers(query: String? = null, sector: String? = null): JsonElement {
        return client.get(ApiConfig.SCREENER_TICKERS) {
            if (!query.isNullOrBlank()) parameter("q", query)
            if (!sector.isNullOrBlank()) parameter("sector", sector)
        }.body()
    }

    suspend fun scanScreener(body: JsonObject): JsonElement {
        return client.post(ApiConfig.SCREENER_SCAN) {
            setBody(body)
        }.body()
    }

    suspend fun getBacktestRules(): JsonElement {
        return client.get(ApiConfig.BACKTEST_RULES).body()
    }

    suspend fun getBacktestPresets(): JsonElement {
        return client.get(ApiConfig.BACKTEST_PRESETS).body()
    }

    suspend fun runBacktest(body: JsonObject): JsonElement {
        return client.post(ApiConfig.BACKTEST_RUN) {
            setBody(body)
        }.body()
    }

    suspend fun startBacktest(body: JsonObject): JsonElement {
        return client.post(ApiConfig.BACKTEST_START) {
            setBody(body)
        }.body()
    }

    suspend fun getBacktestStatus(runId: String): JsonElement {
        return client.get(ApiConfig.BACKTEST_STATUS.replace("{runId}", runId)).body()
    }

    suspend fun getBacktestEvents(runId: String): JsonElement {
        return client.get(ApiConfig.BACKTEST_EVENTS.replace("{runId}", runId)).body()
    }

    suspend fun getBacktestPortfolioCurve(runId: String): JsonElement {
        return client.get(ApiConfig.BACKTEST_PORTFOLIO_CURVE.replace("{runId}", runId)).body()
    }

    suspend fun getAiTools(): JsonElement {
        return client.get(ApiConfig.AI_TOOLS).body()
    }

    suspend fun getAiSessions(userId: String? = null): JsonElement {
        return client.get(ApiConfig.AI_SESSIONS) {
            if (!userId.isNullOrBlank()) parameter("userId", userId)
        }.body()
    }

    suspend fun getAiSession(id: String): JsonElement {
        return client.get(ApiConfig.AI_SESSION_BY_ID.replace("{id}", id)).body()
    }

    suspend fun sendAiMessage(id: String, body: JsonObject): JsonElement {
        return client.post(ApiConfig.AI_SESSION_MESSAGES.replace("{id}", id)) {
            setBody(body)
        }.body()
    }

    suspend fun getAiAssets(userId: String? = null): JsonElement {
        return client.get(ApiConfig.AI_ASSETS) {
            if (!userId.isNullOrBlank()) parameter("userId", userId)
        }.body()
    }

    suspend fun saveAiStrategy(body: JsonObject): JsonElement {
        return client.post(ApiConfig.AI_STRATEGIES) {
            setBody(body)
        }.body()
    }

    suspend fun saveAiRule(body: JsonObject): JsonElement {
        return client.post(ApiConfig.AI_RULES) {
            setBody(body)
        }.body()
    }

    suspend fun saveAiIndicator(body: JsonObject): JsonElement {
        return client.post(ApiConfig.AI_INDICATORS) {
            setBody(body)
        }.body()
    }
}
