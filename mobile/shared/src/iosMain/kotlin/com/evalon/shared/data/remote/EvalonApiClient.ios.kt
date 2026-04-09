package com.evalon.shared.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import io.ktor.client.engine.HttpClientEngine

actual fun createHttpClient(engine: HttpClientEngine?): HttpClient {
    return HttpClient(engine ?: Darwin.create()) {
        // iOS-specific configuration
    }
}
