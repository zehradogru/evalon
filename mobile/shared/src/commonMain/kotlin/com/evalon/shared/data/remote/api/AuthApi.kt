package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.AuthResponse
import com.evalon.shared.domain.model.LoginRequest
import com.evalon.shared.domain.model.RegisterRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody

class AuthApi(private val client: HttpClient) {
    suspend fun login(request: LoginRequest): AuthResponse {
        return client.post(ApiConfig.AUTH_LOGIN) {
            setBody(request)
        }.body()
    }

    suspend fun register(request: RegisterRequest): AuthResponse {
        return client.post(ApiConfig.AUTH_REGISTER) {
            setBody(request)
        }.body()
    }

    suspend fun refreshToken(refreshToken: String): String {
        return client.post(ApiConfig.AUTH_REFRESH) {
            setBody(mapOf("refreshToken" to refreshToken))
        }.body<Map<String, String>>()["token"] ?: throw Exception("Token not found")
    }
}
