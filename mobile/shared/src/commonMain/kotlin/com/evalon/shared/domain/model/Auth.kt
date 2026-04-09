package com.evalon.shared.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val username: String,
    val fullName: String? = null
)

@Serializable
data class AuthResponse(
    val token: String,
    val refreshToken: String? = null,
    val user: UserProfile
)
