package com.evalon.shared.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.darwin.Darwin

actual fun createHttpClient(engine: HttpClientEngine?): HttpClient {
    val resolvedEngine = engine ?: Darwin.create()
    return HttpClient(resolvedEngine)
}
