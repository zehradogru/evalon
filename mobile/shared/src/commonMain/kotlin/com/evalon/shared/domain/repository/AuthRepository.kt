package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.AuthResponse
import com.evalon.shared.domain.model.LoginRequest
import com.evalon.shared.domain.model.RegisterRequest

interface AuthRepository {
    suspend fun login(request: LoginRequest): Result<AuthResponse>
    suspend fun register(request: RegisterRequest): Result<AuthResponse>
    suspend fun logout()
    suspend fun refreshToken(): Result<String>
    fun getToken(): String?
    fun saveToken(token: String)
}
