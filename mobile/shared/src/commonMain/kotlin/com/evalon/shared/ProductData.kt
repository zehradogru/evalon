package com.evalon.shared

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.createHttpClient
import com.evalon.shared.data.remote.dto.MarketDataMetaDto
import com.evalon.shared.data.remote.dto.MarketItemDto
import com.evalon.shared.data.remote.dto.MarketOverviewCardDto
import com.evalon.shared.data.remote.dto.MarketListResponseDto
import com.evalon.shared.data.remote.dto.MarketOverviewResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.URLProtocol
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

data class ProductSnapshot(
    val overview: MarketOverviewResponseDto? = null,
    val marketList: MarketListResponseDto? = null,
    val news: NewsResponseDto? = null,
    val loaded: Boolean = false,
    val errorMessage: String? = null
)

private val homeFallbackTickers = listOf(
    "EREGL", "SISE", "ISCTR", "BIMAS", "YKBNK", "GARAN", "THYAO", "AKBNK", "ASELS", "KCHOL", "TUPRS", "FROTO"
)

private val tickerNames = mapOf(
    "THYAO" to "Turk Hava Yollari",
    "AKBNK" to "Akbank",
    "EREGL" to "Erdemir",
    "ASELS" to "Aselsan",
    "SISE" to "Sisecam",
    "KCHOL" to "Koc Holding",
    "ISCTR" to "Turkiye Is Bankasi",
    "BIMAS" to "BIM",
    "YKBNK" to "Yapi ve Kredi Bankasi",
    "GARAN" to "Garanti BBVA",
    "TUPRS" to "Tupras",
    "FROTO" to "Ford Otosan"
)

class ProductApiClient(
    private val client: HttpClient = createHttpClient().config {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                    encodeDefaults = false
                }
            )
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 25_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 25_000
        }
        install(HttpRequestRetry) {
            retryOnServerErrors(maxRetries = 2)
            retryOnException(maxRetries = 2, retryOnTimeout = true)
            exponentialDelay()
        }
        defaultRequest {
            url {
                protocol = URLProtocol.HTTPS
                host = ApiConfig.BASE_URL
            }
            contentType(ContentType.Application.Json)
        }
    }
) {
    suspend fun loadSnapshot(): ProductSnapshot {
        val overviewResult = runCatching { getMarketOverview() }
        val marketsResult = runCatching { getMarketList(limit = 60) }
        val newsResult = runCatching { getNews(limit = 20) }
        val firstError = if (overviewResult.isFailure && marketsResult.isFailure) {
            listOf(overviewResult, marketsResult)
                .firstOrNull { it.isFailure }
                ?.exceptionOrNull()
                ?.toProductUserFacingMessage()
        } else {
            null
        }

        return ProductSnapshot(
            overview = overviewResult.getOrNull(),
            marketList = marketsResult.getOrNull(),
            news = newsResult.getOrNull(),
            loaded = true,
            errorMessage = firstError
        )
    }

    suspend fun getMarketOverview(): MarketOverviewResponseDto {
        return readWithRetry {
            client.get(ApiConfig.MARKET_OVERVIEW).body<MarketOverviewResponseDto>()
        }
    }

    suspend fun getMarketList(
        limit: Int = 60,
        cursor: String? = null,
        sortBy: String = "changePct",
        sortDir: String = "desc",
        query: String? = null
    ): MarketListResponseDto {
        return runCatching {
            readWithRetry {
                client.get(ApiConfig.MARKET_LIST) {
                    parameter("limit", limit)
                    parameter("sortBy", sortBy)
                    parameter("sortDir", sortDir)
                    if (cursor != null) parameter("cursor", cursor)
                    if (!query.isNullOrBlank()) parameter("q", query)
                }.body<MarketListResponseDto>()
            }
        }.mapCatching { response ->
            if (response.items.isNotEmpty() || response.data.isNotEmpty()) {
                response
            } else {
                getPriceBatchMarketList(limit = limit, query = query)
            }
        }.getOrElse {
            runCatching { getScreenerTickerMarketList(limit = limit, query = query) }
                .mapCatching { response ->
                    if (response.items.isNotEmpty() || response.data.isNotEmpty()) {
                        response
                    } else {
                        getPriceBatchMarketList(limit = limit, query = query)
                    }
                }
                .getOrElse { getPriceBatchMarketList(limit = limit, query = query) }
        }
    }

    suspend fun getNews(limit: Int = 20): NewsResponseDto {
        return readWithRetry {
            client.get(ApiConfig.NEWS) {
                parameter("limit", limit)
            }.body()
        }
    }

    private suspend fun getScreenerTickerMarketList(limit: Int, query: String?): MarketListResponseDto {
        val payload: JsonObject = readWithRetry {
            client.get(ApiConfig.SCREENER_TICKERS) {
                if (!query.isNullOrBlank()) parameter("q", query)
            }.body()
        }
        val items = payload["tickers"]
            ?.jsonArray
            ?.take(limit)
            ?.mapNotNull { raw ->
                val item = raw.jsonObject
                val ticker = item.string("ticker") ?: return@mapNotNull null
                MarketItemDto(
                    ticker = ticker,
                    symbol = ticker,
                    name = item.string("sector") ?: ticker,
                    sector = item.string("sector")
                )
            }
            .orEmpty()
        return MarketListResponseDto(
            stale = true,
            items = items,
            total = payload.int("count") ?: items.size,
            meta = MarketDataMetaDto(
                stale = true,
                hasUsableData = items.isNotEmpty(),
                source = "screener-tickers",
                message = "Cloud backend henuz /v1/markets/list endpoint'ini yayinlamadigi icin /v1/screener/tickers canli katalogu kullanildi."
            )
        )
    }

    private suspend fun getPriceBatchMarketList(limit: Int, query: String?): MarketListResponseDto {
        val normalizedQuery = query?.trim()?.uppercase().orEmpty()
        val tickers = homeFallbackTickers
            .filter { normalizedQuery.isBlank() || it.contains(normalizedQuery) || tickerNames[it].orEmpty().uppercase().contains(normalizedQuery) }
            .take(limit.coerceAtLeast(1))
            .ifEmpty { homeFallbackTickers.take(limit.coerceAtLeast(1)) }

        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.PRICES_BATCH) {
                setBody(
                    buildJsonObject {
                        put("tickers", buildJsonArray { tickers.forEach(::add) })
                        put("timeframe", "1d")
                        put("limit", 2)
                    }
                )
            }.body()
        }

        val items = payload["data"]
            ?.jsonArray
            ?.mapNotNull { raw ->
                val row = raw.jsonObject
                val ticker = row.string("ticker") ?: return@mapNotNull null
                val current = row["current"]?.jsonObject ?: return@mapNotNull null
                val previous = row["previous"]?.jsonObject
                val close = current.double("c") ?: return@mapNotNull null
                val previousClose = previous?.double("c")
                val changePct = if (previousClose != null && previousClose > 0.0) {
                    ((close - previousClose) / previousClose) * 100.0
                } else {
                    null
                }
                MarketItemDto(
                    ticker = ticker,
                    symbol = ticker,
                    name = tickerNames[ticker] ?: ticker,
                    price = close,
                    changePct = changePct,
                    changeVal = previousClose?.let { close - it },
                    high = current.double("h"),
                    low = current.double("l"),
                    vol = current.double("v"),
                    rating = if ((changePct ?: 0.0) >= 0.0) "Buy" else "Neutral",
                    sector = "BIST"
                )
            }
            .orEmpty()
            .sortedByDescending { it.changePct ?: -999.0 }

        return MarketListResponseDto(
            stale = payload["stale"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: false,
            items = items,
            total = items.size,
            meta = MarketDataMetaDto(
                stale = payload["stale"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: false,
                hasUsableData = items.isNotEmpty(),
                source = "prices-batch",
                message = "Market list endpoint'i gecici olarak kullanilamadigi icin fiyat batch endpoint'iyle dolduruldu."
            )
        )
    }

    suspend fun runScreenerScan(
        tickers: List<String> = listOf("THYAO", "AKBNK", "EREGL", "ASELS", "SISE", "KCHOL")
    ): ScreenerScanResult {
        val normalizedTickers = tickers
            .map { it.trim().uppercase() }
            .filter { it.isNotBlank() }
            .distinct()
            .take(25)
            .ifEmpty { listOf("THYAO", "AKBNK", "EREGL", "ASELS", "SISE", "KCHOL") }
        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.SCREENER_SCAN) {
                setBody(
                    buildJsonObject {
                        put("tickers", buildJsonArray {
                            normalizedTickers.forEach(::add)
                        })
                        put("timeframe", "1d")
                        put("lookback_bars", 120)
                        put("filters", JsonArray(emptyList()))
                        put("logic", "AND")
                        put("limit", 12)
                        put("sort_by", "change_pct")
                        put("sort_dir", "desc")
                    }
                )
            }.body()
        }

        val rows = payload["rows"]
            ?.jsonArray
            ?.mapNotNull { raw ->
                val row = raw.jsonObject
                val ticker = row.string("ticker") ?: return@mapNotNull null
                ScreenerScanRow(
                    ticker = ticker,
                    sector = row.string("sector") ?: "Piyasa",
                    close = row.double("close") ?: 0.0,
                    changePct = row.double("change_pct") ?: 0.0,
                    volume = row.double("volume") ?: 0.0,
                    matchedFilters = row["matched_filters"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty()
                )
            }
            .orEmpty()

        return ScreenerScanResult(
            scannedAt = payload.string("scanned_at") ?: "",
            totalScanned = payload.int("total_scanned") ?: rows.size,
            matched = payload.int("matched") ?: rows.size,
            elapsedMs = payload.double("elapsed_ms") ?: 0.0,
            rows = rows
        )
    }

    suspend fun loadIndicatorLab(
        ticker: String = "THYAO",
        timeframe: String = "1d",
        strategy: String = "rsi",
        period: Int = 14
    ): IndicatorLabResult {
        val payload: JsonObject = readWithRetry {
            client.get(ApiConfig.INDICATORS) {
                parameter("ticker", ticker)
                parameter("timeframe", timeframe)
                parameter("strategy", strategy)
                parameter("period", period)
                parameter("limit", 180)
            }.body()
        }

        val lines = payload["indicators"]
            ?.jsonArray
            ?.mapNotNull { raw ->
                val item = raw.jsonObject
                val name = item.string("name") ?: return@mapNotNull null
                val latest = item["data"]
                    ?.jsonArray
                    ?.lastOrNull()
                    ?.jsonObject
                    ?.double("value")
                IndicatorValue(
                    name = name,
                    value = latest ?: 0.0,
                    pointCount = item["data"]?.jsonArray?.size ?: 0
                )
            }
            .orEmpty()

        return IndicatorLabResult(
            ticker = payload.string("ticker") ?: ticker,
            timeframe = payload.string("timeframe") ?: timeframe,
            strategy = payload.string("strategy") ?: strategy,
            values = lines
        )
    }

    suspend fun startBacktest(): BacktestRunResult {
        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.BACKTEST_START) {
                setBody(defaultBacktestBlueprint())
            }.body()
        }
        return parseBacktestRun(payload)
    }

    suspend fun runBacktestNow(): BacktestRunResult {
        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.BACKTEST_RUN) {
                setBody(defaultBacktestBlueprint())
            }.body()
        }
        return parseBacktestRun(payload)
    }

    suspend fun getPriceSeries(
        ticker: String,
        timeframe: String = "1d",
        limit: Int = 120
    ): PriceSeriesResult {
        val payload: JsonObject = readWithRetry {
            client.get(ApiConfig.PRICES) {
                parameter("ticker", ticker.trim().uppercase())
                parameter("timeframe", timeframe)
                parameter("limit", limit)
            }.body()
        }

        val points = payload["data"]
            ?.jsonArray
            ?.mapNotNull { raw ->
                val item = raw.jsonObject
                PricePoint(
                    time = item.string("t") ?: return@mapNotNull null,
                    open = item.double("o"),
                    high = item.double("h"),
                    low = item.double("l"),
                    close = item.double("c") ?: return@mapNotNull null,
                    volume = item.double("v")
                )
            }
            .orEmpty()

        return PriceSeriesResult(
            ticker = payload.string("ticker") ?: ticker,
            timeframe = payload.string("timeframe") ?: timeframe,
            points = points
        )
    }

    suspend fun createAiSession(userId: String, title: String = "Mobile session"): String {
        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.AI_SESSIONS) {
                setBody(
                    buildJsonObject {
                        put("userId", userId)
                        put("title", title)
                    }
                )
            }.body()
        }
        return payload.string("sessionId") ?: error("AI session id donmedi.")
    }

    suspend fun sendAiMessage(sessionId: String, prompt: String, userId: String): AiReplyResult {
        val payload: JsonObject = readWithRetry(maxAttempts = 4) {
            client.post(ApiConfig.AI_SESSION_MESSAGES.replace("{id}", sessionId)) {
                setBody(
                    buildJsonObject {
                        put("content", prompt)
                        put(
                            "context",
                            buildJsonObject {
                                put("user_id", userId)
                                put("ticker", "THYAO")
                                put("timeframe", "1d")
                                put("indicator_id", "rsi")
                                put("selected_symbols", buildJsonArray {
                                    add("THYAO")
                                    add("AKBNK")
                                })
                                put("auto_save_drafts", true)
                            }
                        )
                    }
                )
            }.body()
        }

        val message = payload["message"]?.jsonObject
        return AiReplyResult(
            sessionId = payload.string("sessionId") ?: sessionId,
            content = message?.string("content") ?: "AI yaniti bos dondu.",
            toolResultsCount = payload["toolResults"]?.jsonArray?.size ?: 0,
            savedAssetsCount = payload["savedAssets"]?.jsonArray?.size ?: 0
        )
    }

    fun close() {
        client.close()
    }

    private suspend fun <T> readWithRetry(
        maxAttempts: Int = 4,
        initialDelayMs: Long = 800L,
        block: suspend () -> T
    ): T {
        var nextDelayMs = initialDelayMs
        repeat(maxAttempts - 1) {
            try {
                return block()
            } catch (error: Throwable) {
                if (error is CancellationException) throw error
            }
            delay(nextDelayMs)
            nextDelayMs *= 2
        }
        return block()
    }

    private fun parseBacktestRun(payload: JsonObject): BacktestRunResult {
        val result = payload["result"]?.jsonObject
        val metrics = result?.get("metrics")?.jsonObject
        val summary = result?.get("summary")?.jsonObject
        val topSummary = payload["summary"]?.jsonObject
        return BacktestRunResult(
            runId = payload.string("runId") ?: "",
            status = payload.string("status") ?: "started",
            eventsCount = payload.int("eventsCount") ?: topSummary?.int("totalTrades") ?: 0,
            totalReturnPct = metrics?.double("totalReturnPct")
                ?: metrics?.double("total_return_pct")
                ?: summary?.double("totalReturnPct")
                ?: summary?.double("total_return_pct")
                ?: summary?.double("totalPnlPct")
                ?: topSummary?.double("totalPnl"),
            maxDrawdownPct = metrics?.double("maxDrawdownPct")
                ?: metrics?.double("max_drawdown_pct")
                ?: summary?.double("maxDrawdownPct")
                ?: summary?.double("max_drawdown_pct")
                ?: topSummary?.double("maxDrawdown"),
            totalTrades = summary?.int("totalTrades") ?: topSummary?.int("totalTrades") ?: 0,
            winRate = summary?.double("winRate") ?: topSummary?.double("winRate"),
            finalBalance = result?.get("portfolioCurve")?.jsonObject?.double("finalBalance")
                ?: summary?.double("finalBalance"),
            equityCurve = result
                ?.get("portfolioCurve")
                ?.jsonObject
                ?.get("points")
                ?.jsonArray
                ?.mapNotNull { it.jsonObject.double("balance")?.toFloat() }
                .orEmpty(),
            message = payload["progress"]?.jsonObject?.string("message")
                ?: payload.string("message")
                ?: summary?.let { "Backtest tamamlandi." }
                ?: "Backtest istegi backend tarafina gonderildi."
        )
    }

    private fun defaultBacktestBlueprint(): JsonObject = buildJsonObject {
        put("symbol", "THYAO")
        put("symbols", buildJsonArray {
            add("THYAO")
            add("AKBNK")
        })
        put("stageThreshold", 1)
        put("direction", "long")
        put("testWindowDays", 180)
        put(
            "portfolio",
            buildJsonObject {
                put("initialCapital", 100_000.0)
                put("positionSize", 10_000.0)
                put("commissionPct", 0.05)
            }
        )
        put(
            "risk",
            buildJsonObject {
                put("stopPct", 4.0)
                put("targetPct", 8.0)
                put("maxBars", 30)
            }
        )
        put(
            "stages",
            buildJsonObject {
                put("trend", backtestStage("trend", "1d", false, emptyList()))
                put(
                    "setup",
                    backtestStage(
                        key = "setup",
                        timeframe = "1d",
                        required = true,
                        rules = listOf(
                            buildJsonObject {
                                put("id", "support-hold")
                                put("required", true)
                                put(
                                    "params",
                                    buildJsonObject {
                                        put("lookback", 25.0)
                                        put("tolerance", 1.0)
                                    }
                                )
                            }
                        )
                    )
                )
                put("trigger", backtestStage("trigger", "1d", false, emptyList()))
            }
        )
    }

    private fun backtestStage(
        key: String,
        timeframe: String,
        required: Boolean,
        rules: List<JsonObject>
    ): JsonObject = buildJsonObject {
        put("key", key)
        put("timeframe", timeframe)
        put("required", required)
        put("minOptionalMatches", if (rules.isEmpty()) 0 else 1)
        put("rules", buildJsonArray { rules.forEach(::add) })
    }
}

data class ScreenerScanResult(
    val scannedAt: String,
    val totalScanned: Int,
    val matched: Int,
    val elapsedMs: Double,
    val rows: List<ScreenerScanRow>
)

data class ScreenerScanRow(
    val ticker: String,
    val sector: String,
    val close: Double,
    val changePct: Double,
    val volume: Double,
    val matchedFilters: List<String>
)

data class IndicatorLabResult(
    val ticker: String,
    val timeframe: String,
    val strategy: String,
    val values: List<IndicatorValue>
)

data class IndicatorValue(
    val name: String,
    val value: Double,
    val pointCount: Int
)

data class BacktestRunResult(
    val runId: String,
    val status: String,
    val eventsCount: Int,
    val totalReturnPct: Double?,
    val maxDrawdownPct: Double?,
    val totalTrades: Int,
    val winRate: Double?,
    val finalBalance: Double?,
    val equityCurve: List<Float>,
    val message: String
)

data class PriceSeriesResult(
    val ticker: String,
    val timeframe: String,
    val points: List<PricePoint>
)

data class PricePoint(
    val time: String,
    val open: Double?,
    val high: Double?,
    val low: Double?,
    val close: Double,
    val volume: Double?
)

data class AiReplyResult(
    val sessionId: String,
    val content: String,
    val toolResultsCount: Int,
    val savedAssetsCount: Int
)

internal fun Throwable.toProductUserFacingMessage(
    fallback: String = "Canli veri istegi tamamlanamadi."
): String {
    val raw = message.orEmpty()
    return when {
        raw.contains("NSURLErrorDomain Code=-1005", ignoreCase = true) ||
            raw.contains("The network connection was lost", ignoreCase = true) ->
            "Baglanti gecici olarak kesildi. Tekrar dene."
        raw.contains("timed out", ignoreCase = true) ->
            "Istek zaman asimina ugradi. Tekrar dene."
        raw.contains("Unable to resolve host", ignoreCase = true) ||
            raw.contains("Could not connect", ignoreCase = true) ->
            "Backend servisine ulasilamadi. Internet baglantisini kontrol et."
        raw.isBlank() ->
            fallback
        else ->
            raw.lineSequence().firstOrNull { it.isNotBlank() }?.take(160) ?: fallback
    }
}

@Serializable
data class NewsResponseDto(
    val items: List<NewsItemDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20
)

@Serializable
data class NewsItemDto(
    val id: Long,
    val symbol: String? = null,
    val news_source: String? = null,
    val title: String,
    val summary: String? = null,
    val sentiment: String? = null,
    val sentiment_score: Double? = null,
    val news_url: String? = null,
    val author: String? = null,
    val published_at: String? = null
)

private fun JsonObject.string(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull

private fun JsonObject.double(key: String): Double? = this[key]?.jsonPrimitive?.doubleOrNull

private fun JsonObject.int(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
