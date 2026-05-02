package com.evalon.shared

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.createHttpClient
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.datetime.Clock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

data class FirestoreUserData(
    val watchlistSymbols: List<String> = emptyList(),
    val aiAssets: List<FirestoreAiAsset> = emptyList(),
    val communityPosts: List<FirestoreCommunityPost> = emptyList(),
    val paperOrders: List<FirestorePaperOrder> = emptyList(),
    val paperLeaderboard: List<FirestoreLeaderboardEntry> = emptyList(),
    val paperPortfolio: FirestorePaperPortfolio? = null,
    val settings: FirestoreSettings = FirestoreSettings()
)

data class FirestoreAiAsset(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val createdAt: String
)

data class FirestoreCommunityPost(
    val id: String,
    val authorId: String,
    val authorName: String,
    val tickers: List<String>,
    val tags: List<String>,
    val body: String,
    val createdAt: String,
    val editedAt: String?,
    val likeCount: Long,
    val commentCount: Long,
    val reportCount: Long,
    val viewerHasLiked: Boolean,
    val viewerHasSaved: Boolean,
    val imageUrl: String?,
    val comments: List<FirestoreCommunityComment>
)

data class FirestoreCommunityComment(
    val id: String,
    val postId: String,
    val authorId: String,
    val authorName: String,
    val body: String,
    val createdAt: String,
    val editedAt: String?
)

data class FirestorePaperOrder(
    val id: String,
    val symbol: String,
    val side: String,
    val quantity: Double,
    val orderType: String,
    val status: String,
    val createdAt: String
)

data class FirestorePaperPortfolio(
    val cash: Double,
    val totalValue: Double,
    val updatedAt: String
)

data class FirestoreLeaderboardEntry(
    val userId: String,
    val displayName: String,
    val totalValue: Double,
    val totalPnL: Double,
    val totalPnLPercent: Double,
    val totalTrades: Long,
    val winRate: Double,
    val sharpeRatio: Double,
    val updatedAt: String
)

data class FirestoreSettings(
    val pushNotifications: Boolean = true,
    val staleDataLabels: Boolean = true,
    val biometricUnlock: Boolean = false,
    val reduceMotion: Boolean = false
)

class FirebaseRestGateway(
    private val uid: String? = null,
    private val idToken: String? = null,
    private val displayName: String? = null,
    private val email: String? = null,
    private val client: HttpClient = createHttpClient().config {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = false })
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 20_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 20_000
        }
        install(HttpRequestRetry) {
            retryOnServerErrors(maxRetries = 2)
            retryOnException(maxRetries = 2, retryOnTimeout = true)
            exponentialDelay()
        }
        defaultRequest {
            contentType(ContentType.Application.Json)
        }
    }
) {
    private val firestoreBase =
        "https://firestore.googleapis.com/v1/projects/evalon-auths/databases/(default)/documents"

    suspend fun loadUserData(): FirestoreUserData {
        val isAuthenticated = hasAuthenticatedSession()
        return FirestoreUserData(
            watchlistSymbols = if (isAuthenticated) runCatching { listWatchlist() }.getOrDefault(emptyList()) else emptyList(),
            aiAssets = if (isAuthenticated) runCatching { listAiAssets() }.getOrDefault(emptyList()) else emptyList(),
            communityPosts = runCatching { listCommunityPosts() }.getOrDefault(emptyList()),
            paperOrders = if (isAuthenticated) runCatching { listPaperOrders() }.getOrDefault(emptyList()) else emptyList(),
            paperLeaderboard = runCatching { listPaperLeaderboard() }.getOrDefault(emptyList()),
            paperPortfolio = if (isAuthenticated) runCatching { getPaperPortfolio() }.getOrNull() else null,
            settings = if (isAuthenticated) runCatching { getSettings() }.getOrDefault(FirestoreSettings()) else FirestoreSettings()
        )
    }

    suspend fun saveProfile(displayName: String?, email: String?) {
        val userId = requireUid()
        setDocument(
            "users/$userId",
            mapOf(
                "uid" to stringValue(userId),
                "displayName" to stringValue(displayName.orEmpty()),
                "email" to stringValue(email.orEmpty()),
                "updatedAt" to timestampNow()
            )
        )
    }

    suspend fun saveSettings(settings: FirestoreSettings) {
        val userId = requireUid()
        setDocument(
            "users/$userId/settings/preferences",
            mapOf(
                "pushNotifications" to booleanValue(settings.pushNotifications),
                "staleDataLabels" to booleanValue(settings.staleDataLabels),
                "biometricUnlock" to booleanValue(settings.biometricUnlock),
                "reduceMotion" to booleanValue(settings.reduceMotion),
                "updatedAt" to timestampNow()
            )
        )
    }

    suspend fun listWatchlist(): List<String> {
        val userId = requireUid()
        val userDocument = runCatching { getDocument("users/$userId") }.getOrNull()
        val webWatchlist = userDocument
            ?.let(::fieldsOf)
            ?.mapField("watchlist")
            ?.arrayStringField("tickers")
            .orEmpty()
            .map { it.trim().uppercase() }
            .filter { it.isNotBlank() }
            .distinct()

        if (webWatchlist.isNotEmpty()) return webWatchlist

        return listDocuments("users/$userId/watchlist")
            .mapNotNull { document -> document["name"]?.jsonPrimitive?.content?.substringAfterLast("/") }
            .map { it.trim().uppercase() }
            .filter { it.isNotBlank() }
            .distinct()
    }

    suspend fun listAiAssets(): List<FirestoreAiAsset> {
        val userId = requireUid()
        return listDocuments("users/$userId/ai_assets").map { document ->
            val fields = fieldsOf(document)
            FirestoreAiAsset(
                id = fields.stringField("id") ?: documentId(document),
                type = fields.stringField("type") ?: "strategy",
                title = fields.stringField("title") ?: "Untitled asset",
                description = fields.stringField("description") ?: fields.stringField("payloadJson") ?: "",
                createdAt = fields.timestampField("createdAt") ?: ""
            )
        }.sortedByDescending { it.createdAt }
    }

    suspend fun listCommunityPosts(limit: Int = 20, commentLimit: Int = 3): List<FirestoreCommunityPost> {
        val userId = currentUidOrNull()
        return listDocuments(
            path = "posts",
            attachAuth = false,
            pageSize = limit,
            orderBy = "createdAt desc"
        ).mapNotNull { document ->
            runCatching {
                val fields = fieldsOf(document)
                val postId = documentId(document)
                val tickers = fields.arrayStringField("tickers")
                    .ifEmpty { listOfNotNull(fields.stringField("ticker")?.takeIf { it.isNotBlank() }) }
                    .map { it.trim().uppercase() }
                    .distinct()
                FirestoreCommunityPost(
                    id = postId,
                    authorId = fields.stringField("authorId") ?: "community",
                    authorName = fields.stringField("authorName")
                        ?: fields.stringField("displayName")
                        ?: fields.stringField("authorId")
                        ?: "Trader",
                    tickers = tickers,
                    tags = fields.arrayStringField("tags").map { it.trim().lowercase() }.distinct(),
                    body = fields.stringField("content") ?: fields.stringField("body").orEmpty(),
                    createdAt = fields.timestampField("createdAt") ?: "",
                    editedAt = fields.timestampField("editedAt"),
                    likeCount = fields.longField("likeCount") ?: 0L,
                    commentCount = fields.longField("commentCount") ?: 0L,
                    reportCount = fields.longField("reportCount") ?: 0L,
                    viewerHasLiked = userId?.let {
                        runCatching { documentExists("users/$it/likes/$postId") }.getOrDefault(false)
                    } ?: false,
                    viewerHasSaved = userId?.let {
                        runCatching { documentExists("users/$it/saves/$postId") }.getOrDefault(false)
                    } ?: false,
                    imageUrl = fields.stringField("imageUrl"),
                    comments = runCatching { listCommunityComments(postId, limit = commentLimit) }
                        .getOrDefault(emptyList())
                )
            }.getOrNull()
        }
            .sortedByDescending { it.createdAt }
    }

    suspend fun listCommunityComments(postId: String, limit: Int = 3): List<FirestoreCommunityComment> {
        return listDocuments(
            path = "posts/$postId/comments",
            attachAuth = false,
            pageSize = limit,
            orderBy = "createdAt desc"
        )
            .map { document ->
                val fields = fieldsOf(document)
                FirestoreCommunityComment(
                    id = documentId(document),
                    postId = postId,
                    authorId = fields.stringField("authorId") ?: "",
                    authorName = fields.stringField("authorName")
                        ?: fields.stringField("displayName")
                        ?: fields.stringField("authorId")
                        ?: "Trader",
                    body = fields.stringField("content") ?: fields.stringField("body").orEmpty(),
                    createdAt = fields.timestampField("createdAt") ?: "",
                    editedAt = fields.timestampField("editedAt")
                )
            }
            .sortedByDescending { it.createdAt }
            .take(limit)
            .reversed()
    }

    suspend fun listPaperOrders(): List<FirestorePaperOrder> {
        val userId = requireUid()
        return listDocuments("users/$userId/paper_orders").map { document ->
            val fields = fieldsOf(document)
            FirestorePaperOrder(
                id = fields.stringField("id") ?: documentId(document),
                symbol = fields.stringField("symbol") ?: "--",
                side = fields.stringField("side") ?: "buy",
                quantity = fields.doubleField("quantity") ?: 0.0,
                orderType = fields.stringField("orderType") ?: "market",
                status = fields.stringField("status") ?: "submitted",
                createdAt = fields.timestampField("createdAt") ?: ""
            )
        }.sortedByDescending { it.createdAt }
    }

    suspend fun listPaperLeaderboard(): List<FirestoreLeaderboardEntry> {
        return listDocuments("paper_leaderboard", attachAuth = false).map { document ->
            val fields = fieldsOf(document)
            FirestoreLeaderboardEntry(
                userId = fields.stringField("userId") ?: documentId(document),
                displayName = fields.stringField("displayName") ?: "Anonim",
                totalValue = fields.doubleField("totalValue") ?: 0.0,
                totalPnL = fields.doubleField("totalPnL") ?: 0.0,
                totalPnLPercent = fields.doubleField("totalPnLPercent") ?: 0.0,
                totalTrades = fields.longField("totalTrades") ?: 0L,
                winRate = fields.doubleField("winRate") ?: 0.0,
                sharpeRatio = fields.doubleField("sharpeRatio") ?: 0.0,
                updatedAt = fields.timestampField("updatedAt") ?: ""
            )
        }
            .sortedByDescending { it.totalPnL }
            .take(50)
    }

    suspend fun getPaperPortfolio(): FirestorePaperPortfolio {
        val userId = requireUid()
        val document = getDocument("users/$userId/paper_portfolio/current")
        val fields = fieldsOf(document)
        return FirestorePaperPortfolio(
            cash = fields.doubleField("cash") ?: fields.doubleField("cashBalance") ?: 0.0,
            totalValue = fields.doubleField("totalValue") ?: 0.0,
            updatedAt = fields.timestampField("updatedAt") ?: fields.timestampField("resetAt") ?: ""
        )
    }

    suspend fun getSettings(): FirestoreSettings {
        val userId = requireUid()
        val document = getDocument("users/$userId/settings/preferences")
        val fields = fieldsOf(document)
        return FirestoreSettings(
            pushNotifications = fields.booleanField("pushNotifications") ?: true,
            staleDataLabels = fields.booleanField("staleDataLabels") ?: true,
            biometricUnlock = fields.booleanField("biometricUnlock") ?: false,
            reduceMotion = fields.booleanField("reduceMotion") ?: false
        )
    }

    suspend fun addWatchlist(symbol: String) {
        val userId = requireUid()
        val normalized = symbol.trim().uppercase()
        if (normalized.isBlank()) return
        val current = listWatchlist()
        val next = (current + normalized).distinct().take(30)
        setDocument(
            "users/$userId",
            mapOf(
                "watchlist" to watchlistValue(next),
                "updatedAt" to timestampNow()
            )
        )
    }

    suspend fun removeWatchlist(symbol: String) {
        val userId = requireUid()
        val normalized = symbol.trim().uppercase()
        val next = listWatchlist().filterNot { it == normalized }
        setDocument(
            "users/$userId",
            mapOf(
                "watchlist" to watchlistValue(next),
                "updatedAt" to timestampNow()
            )
        )
        runCatching { deleteDocument("users/$userId/watchlist/$normalized") }
    }

    suspend fun saveAiAsset(type: String, title: String, payloadJson: String) {
        val userId = requireUid()
        val id = "asset_${nowMillis()}"
        setDocument(
            "users/$userId/ai_assets/$id",
            mapOf(
                "id" to stringValue(id),
                "type" to stringValue(type),
                "title" to stringValue(title),
                "payloadJson" to stringValue(payloadJson),
                "createdAt" to timestampNow()
            )
        )
    }

    suspend fun createCommunityPost(body: String, ticker: String? = null) {
        val userId = requireUid()
        val id = "post_${nowMillis()}"
        val normalizedBody = body.trim()
        val normalizedTicker = ticker?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
        val author = resolvedAuthorName()
        setDocument(
            "posts/$id",
            mapOf(
                "content" to stringValue(normalizedBody),
                "tickers" to arrayValue(listOfNotNull(normalizedTicker).map(::stringValue)),
                "tags" to emptyArrayValue(),
                "authorId" to stringValue(userId),
                "authorName" to stringValue(author),
                "likeCount" to integerValue(0),
                "commentCount" to integerValue(0),
                "reportCount" to integerValue(0),
                "imageUrl" to nullValue(),
                "imagePath" to nullValue(),
                "imageWidth" to nullValue(),
                "imageHeight" to nullValue(),
                "createdAt" to timestampNow(),
                "editedAt" to nullValue()
            )
        )
        setDocument(
            "users/$userId",
            mapOf("lastPostAt" to timestampNow())
        )
    }

    suspend fun likePost(postId: String) {
        val userId = requireUid()
        val postFields = fieldsOf(getDocument("posts/$postId"))
        val currentlyLiked = documentExists("users/$userId/likes/$postId")
        val nextLikeCount = if (currentlyLiked) {
            (postFields.longField("likeCount") ?: 0L).minus(1L).coerceAtLeast(0L)
        } else {
            (postFields.longField("likeCount") ?: 0L) + 1L
        }
        if (currentlyLiked) {
            deleteDocument("users/$userId/likes/$postId")
        } else {
            setDocument(
                "users/$userId/likes/$postId",
                mapOf(
                    "createdAt" to timestampNow()
                )
            )
        }
        setDocument(
            "posts/$postId",
            mapOf(
                "likeCount" to integerValue(nextLikeCount),
                "editedAt" to nullValue()
            )
        )
    }

    suspend fun savePost(postId: String) {
        val userId = requireUid()
        val currentlySaved = documentExists("users/$userId/saves/$postId")
        if (currentlySaved) {
            deleteDocument("users/$userId/saves/$postId")
        } else {
            setDocument(
                "users/$userId/saves/$postId",
                mapOf(
                    "createdAt" to timestampNow()
                )
            )
        }
    }

    suspend fun reportPost(postId: String, reason: String) {
        val userId = requireUid()
        if (documentExists("posts/$postId/reports/$userId")) return
        setDocument(
            "posts/$postId/reports/$userId",
            mapOf(
                "reason" to stringValue(reason),
                "createdAt" to timestampNow()
            )
        )
        val current = fieldsOf(getDocument("posts/$postId")).longField("reportCount") ?: 0L
        setDocument(
            "posts/$postId",
            mapOf(
                "reportCount" to integerValue(current + 1L)
            )
        )
    }

    suspend fun addComment(postId: String, body: String) {
        val userId = requireUid()
        val id = "comment_${nowMillis()}"
        val author = resolvedAuthorName()
        setDocument(
            "posts/$postId/comments/$id",
            mapOf(
                "authorId" to stringValue(userId),
                "authorName" to stringValue(author),
                "content" to stringValue(body.trim()),
                "createdAt" to timestampNow(),
                "editedAt" to nullValue()
            )
        )
        val current = fieldsOf(getDocument("posts/$postId")).longField("commentCount") ?: 0L
        setDocument(
            "posts/$postId",
            mapOf(
                "commentCount" to integerValue(current + 1L)
            )
        )
    }

    suspend fun createPaperOrder(symbol: String, side: String, quantity: Double, orderType: String = "market") {
        val userId = requireUid()
        val id = "order_${nowMillis()}"
        val normalized = symbol.trim().uppercase()
        val normalizedSide = side.trim().lowercase()
        val normalizedType = orderType.trim().lowercase().ifBlank { "market" }
        val latestPrice = if (normalizedType == "market") getLatestPrice(normalized) else null
        val existingPortfolio = runCatching { getPaperPortfolio() }.getOrElse {
            resetPaperPortfolio()
            getPaperPortfolio()
        }
        val grossAmount = (latestPrice ?: 0.0) * quantity
        val nextCash = when {
            latestPrice == null -> existingPortfolio.cash
            normalizedSide == "buy" -> (existingPortfolio.cash - grossAmount).coerceAtLeast(0.0)
            normalizedSide == "sell" -> existingPortfolio.cash + grossAmount
            else -> existingPortfolio.cash
        }
        val nextTotal = if (latestPrice == null) existingPortfolio.totalValue else nextCash
        val status = if (latestPrice == null) "submitted" else "filled"
        setDocument(
            "users/$userId/paper_orders/$id",
            mapOf(
                "id" to stringValue(id),
                "orderId" to stringValue(id),
                "userId" to stringValue(userId),
                "symbol" to stringValue(normalized),
                "side" to stringValue(normalizedSide),
                "type" to stringValue(normalizedType),
                "orderType" to stringValue(normalizedType),
                "quantity" to doubleValue(quantity),
                "price" to doubleValue(latestPrice ?: 0.0),
                "executedPrice" to doubleValue(latestPrice ?: 0.0),
                "status" to stringValue(status),
                "createdAt" to timestampNow(),
                "updatedAt" to timestampNow()
            )
        )
        savePaperPortfolio(nextCash, nextTotal)
        updateLeaderboard(nextTotal, totalTradesDelta = 1L)
    }

    suspend fun resetPaperPortfolio(initialCash: Double = 100_000.0) {
        savePaperPortfolio(initialCash, initialCash, reset = true)
        updateLeaderboard(initialCash, totalTradesDelta = 0L)
    }

    fun close() {
        client.close()
    }

    private suspend fun savePaperPortfolio(cash: Double, totalValue: Double, reset: Boolean = false) {
        val userId = requireUid()
        setDocument(
            "users/$userId/paper_portfolio/current",
            mapOf(
                "userId" to stringValue(userId),
                "cash" to doubleValue(cash),
                "cashBalance" to doubleValue(cash),
                "totalValue" to doubleValue(totalValue),
                "totalPnL" to doubleValue(totalValue - 100_000.0),
                "totalPnLPercent" to doubleValue(((totalValue - 100_000.0) / 100_000.0) * 100.0),
                "resetAt" to timestampNow(),
                "updatedAt" to timestampNow()
            )
        )
    }

    private suspend fun updateLeaderboard(totalValue: Double, totalTradesDelta: Long) {
        val userId = requireUid()
        val existing = runCatching { fieldsOf(getDocument("paper_leaderboard/$userId")) }.getOrNull()
        val totalTrades = (existing?.longField("totalTrades") ?: 0L) + totalTradesDelta
        val totalPnL = totalValue - 100_000.0
        val totalPnLPercent = (totalPnL / 100_000.0) * 100.0
        setDocument(
            "paper_leaderboard/$userId",
            mapOf(
                "userId" to stringValue(userId),
                "displayName" to stringValue(existing?.stringField("displayName") ?: "Anonim"),
                "totalValue" to doubleValue(totalValue),
                "totalPnL" to doubleValue(totalPnL),
                "totalPnLPercent" to doubleValue(totalPnLPercent),
                "totalTrades" to integerValue(totalTrades),
                "winRate" to doubleValue(existing?.doubleField("winRate") ?: 0.0),
                "sharpeRatio" to doubleValue(existing?.doubleField("sharpeRatio") ?: 0.0),
                "updatedAt" to timestampNow()
            )
        )
    }

    private suspend fun getLatestPrice(symbol: String): Double? {
        val payload: JsonObject = readWithRetry {
            client.get("https://${ApiConfig.BASE_URL}${ApiConfig.PRICES}") {
                parameter("ticker", symbol)
                parameter("timeframe", "1d")
                parameter("limit", 1)
            }.body()
        }
        return payload["data"]
            ?.jsonArray
            ?.lastOrNull()
            ?.jsonObject
            ?.doubleFieldValue("c")
    }

    private suspend fun setDocument(path: String, fields: Map<String, JsonElement>) {
        client.patch("$firestoreBase/$path") {
            attachRequiredAuth()
            contentType(ContentType.Application.Json)
            fields.keys.forEach { fieldPath -> parameter("updateMask.fieldPaths", fieldPath) }
            setBody(buildJsonObject { put("fields", JsonObject(fields)) })
        }
    }

    private suspend fun deleteDocument(path: String) {
        client.delete("$firestoreBase/$path") {
            attachRequiredAuth()
        }
    }

    private suspend fun getDocument(path: String, attachAuth: Boolean = true): JsonObject {
        return readWithRetry {
            client.get("$firestoreBase/$path") {
                if (attachAuth) {
                    attachRequiredAuth()
                }
            }.body()
        }
    }

    private suspend fun listDocuments(
        path: String,
        attachAuth: Boolean = true,
        pageSize: Int? = null,
        orderBy: String? = null
    ): List<JsonObject> {
        val payload: JsonObject = readWithRetry {
            client.get("$firestoreBase/$path") {
                if (attachAuth) {
                    attachRequiredAuth()
                }
                pageSize?.let { parameter("pageSize", it) }
                orderBy?.takeIf { it.isNotBlank() }?.let { parameter("orderBy", it) }
            }.body()
        }

        return payload["documents"]
            ?.jsonArray
            ?.mapNotNull { it.jsonObject }
            .orEmpty()
    }

    private suspend fun documentExists(path: String): Boolean {
        return runCatching { getDocument(path) }.isSuccess
    }

    private fun hasAuthenticatedSession(): Boolean {
        return currentUidOrNull() != null && currentIdTokenOrNull() != null
    }

    private suspend fun <T> readWithRetry(
        maxAttempts: Int = 3,
        initialDelayMs: Long = 600L,
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

    private fun currentUidOrNull(): String? {
        return uid?.takeIf { it.isNotBlank() }
    }

    private fun currentIdTokenOrNull(): String? {
        return idToken?.takeIf { it.isNotBlank() }
    }

    private fun requireUid(): String {
        return currentUidOrNull() ?: error("Firebase kullanici kimligi bulunamadi.")
    }

    private fun requireIdToken(): String {
        return currentIdTokenOrNull() ?: error("Firebase ID token bulunamadi.")
    }

    private fun HttpRequestBuilder.attachRequiredAuth() {
        header(HttpHeaders.Authorization, "Bearer ${requireIdToken()}")
    }

    private fun stringValue(value: String): JsonElement = buildJsonObject {
        put("stringValue", value)
    }

    private fun integerValue(value: Long): JsonElement = buildJsonObject {
        put("integerValue", value.toString())
    }

    private fun doubleValue(value: Double): JsonElement = buildJsonObject {
        put("doubleValue", value)
    }

    private fun booleanValue(value: Boolean): JsonElement = buildJsonObject {
        put("booleanValue", value)
    }

    private fun arrayValue(values: List<JsonElement>): JsonElement = buildJsonObject {
        put("arrayValue", buildJsonObject {
            put("values", buildJsonArray { values.forEach(::add) })
        })
    }

    private fun mapValue(fields: Map<String, JsonElement>): JsonElement = buildJsonObject {
        put("mapValue", buildJsonObject {
            put("fields", JsonObject(fields))
        })
    }

    private fun emptyArrayValue(): JsonElement = arrayValue(emptyList())

    private fun nullValue(): JsonElement = buildJsonObject {
        put("nullValue", "NULL_VALUE")
    }

    private fun watchlistValue(tickers: List<String>): JsonElement {
        return mapValue(
            mapOf(
                "tickers" to arrayValue(tickers.map(::stringValue)),
                "updatedAt" to timestampNow()
            )
        )
    }

    private fun timestampNow(): JsonElement = buildJsonObject {
        put("timestampValue", currentIsoTimestamp())
    }

    private fun nowMillis(): Long = Clock.System.now().toEpochMilliseconds()

    private fun currentIsoTimestamp(): String = Clock.System.now().toString()

    private fun resolvedAuthorName(): String {
        val normalizedDisplayName = displayName?.trim().orEmpty()
        if (normalizedDisplayName.isNotBlank()) return normalizedDisplayName

        val normalizedEmail = email?.substringBefore("@")?.trim().orEmpty()
        if (normalizedEmail.isNotBlank()) return normalizedEmail

        return "Trader"
    }

    private fun fieldsOf(document: JsonObject): JsonObject {
        return document["fields"]?.jsonObject ?: JsonObject(emptyMap())
    }

    private fun documentId(document: JsonObject): String {
        return document["name"]?.jsonPrimitive?.contentOrNull?.substringAfterLast("/").orEmpty()
    }

    private fun JsonObject.stringField(name: String): String? {
        return this[name]?.jsonObject?.get("stringValue")?.jsonPrimitive?.contentOrNull
    }

    private fun JsonObject.timestampField(name: String): String? {
        return this[name]?.jsonObject?.get("timestampValue")?.jsonPrimitive?.contentOrNull
    }

    private fun JsonObject.longField(name: String): Long? {
        val field = this[name]?.jsonObject ?: return null
        return field["integerValue"]?.jsonPrimitive?.longOrNull
            ?: field["doubleValue"]?.jsonPrimitive?.doubleOrNull?.toLong()
    }

    private fun JsonObject.doubleField(name: String): Double? {
        val field = this[name]?.jsonObject ?: return null
        return field["doubleValue"]?.jsonPrimitive?.doubleOrNull
            ?: field["integerValue"]?.jsonPrimitive?.longOrNull?.toDouble()
    }

    private fun JsonObject.booleanField(name: String): Boolean? {
        return this[name]?.jsonObject?.get("booleanValue")?.jsonPrimitive?.booleanOrNull
    }

    private fun JsonObject.mapField(name: String): JsonObject? {
        return this[name]
            ?.jsonObject
            ?.get("mapValue")
            ?.jsonObject
            ?.get("fields")
            ?.jsonObject
    }

    private fun JsonObject.arrayStringField(name: String): List<String> {
        return this[name]
            ?.jsonObject
            ?.get("arrayValue")
            ?.jsonObject
            ?.get("values")
            ?.jsonArray
            ?.mapNotNull { it.jsonObject["stringValue"]?.jsonPrimitive?.contentOrNull }
            .orEmpty()
    }

    private fun JsonObject.doubleFieldValue(name: String): Double? {
        return this[name]?.jsonPrimitive?.doubleOrNull
    }
}
