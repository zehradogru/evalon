package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.AuthApi
import com.evalon.shared.domain.model.AuthResponse
import com.evalon.shared.domain.model.LoginRequest
import com.evalon.shared.domain.model.RegisterRequest
import com.evalon.shared.domain.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthRepositoryImpl(
    private val authApi: AuthApi,
    private val tokenStorage: TokenStorage
) : AuthRepository {

    private val _token = MutableStateFlow<String?>(tokenStorage.getToken())
    val token: StateFlow<String?> = _token.asStateFlow()

    override suspend fun login(request: LoginRequest): Result<AuthResponse> {
        return try {
            val response = authApi.login(request)
            saveToken(response.token)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun register(request: RegisterRequest): Result<AuthResponse> {
        return try {
            val response = authApi.register(request)
            saveToken(response.token)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun logout() {
        tokenStorage.clearToken()
        _token.value = null
    }

    override suspend fun refreshToken(): Result<String> {
        return try {
            val refreshToken = tokenStorage.getRefreshToken()
            if (refreshToken == null) {
                return Result.failure(Exception("No refresh token available"))
            }
            val newToken = authApi.refreshToken(refreshToken)
            saveToken(newToken)
            Result.success(newToken)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getToken(): String? = tokenStorage.getToken()

    override fun saveToken(token: String) {
        tokenStorage.saveToken(token)
        _token.value = token
    }
}

// Token storage interface for platform-specific implementations
expect class TokenStorage {
    fun getToken(): String?
    fun saveToken(token: String)
    fun getRefreshToken(): String?
    fun saveRefreshToken(token: String)
    fun clearToken()
}
