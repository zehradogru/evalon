package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.AuthResponse
import com.evalon.shared.domain.model.LoginRequest
import com.evalon.shared.domain.repository.AuthRepository

class LoginUseCase(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(request: LoginRequest): Result<AuthResponse> {
        return authRepository.login(request)
    }
}
