package com.evalon.shared.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.engine.HttpClientEngine

actual fun createHttpClient(engine: HttpClientEngine?): HttpClient {
    return HttpClient(engine ?: Android.create()) {
        // Android-specific configuration
    }
}
