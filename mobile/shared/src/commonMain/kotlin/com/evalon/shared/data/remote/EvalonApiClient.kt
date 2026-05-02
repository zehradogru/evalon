package com.evalon.shared.data.remote

import com.evalon.shared.data.repository.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.plugin
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

expect fun createHttpClient(engine: HttpClientEngine? = null): HttpClient

fun createApiClient(
    baseUrl: String,
    tokenStorage: TokenStorage,
    engine: HttpClientEngine? = null
): HttpClient {
    val client = createHttpClient(engine).config {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                    encodeDefaults = false
                }
            )
        }

        install(Logging) {
            level = LogLevel.INFO
        }

        defaultRequest {
            url("https://$baseUrl")
            contentType(ContentType.Application.Json)
        }

        install(HttpRequestRetry) {
            retryOnServerErrors(maxRetries = 3)
            retryOnException(maxRetries = 3, retryOnTimeout = true)
            exponentialDelay()
        }
    }

    client.plugin(HttpSend).intercept { request ->
        tokenStorage.getToken()?.let { token ->
            request.headers.append(HttpHeaders.Authorization, "Bearer $token")
        }
        execute(request)
    }

    return client
}

fun HttpClientConfig<*>.config(block: HttpClientConfig<*>.() -> Unit) = block()
