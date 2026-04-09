package com.evalon.shared.data.remote

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.headers
import io.ktor.http.HttpHeaders

class AuthInterceptor(
    private val tokenProvider: () -> String?
) {
    fun HttpRequestBuilder.addAuthHeader() {
        tokenProvider()?.let { token ->
            headers {
                append(HttpHeaders.Authorization, "Bearer $token")
            }
        }
    }
}
