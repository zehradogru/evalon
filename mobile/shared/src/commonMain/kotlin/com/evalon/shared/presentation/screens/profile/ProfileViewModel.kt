package com.evalon.shared.presentation.screens.profile

import com.evalon.shared.di.CurrentSession
import com.evalon.shared.domain.model.RiskTolerance
import com.evalon.shared.domain.model.TradingExperience
import com.evalon.shared.domain.usecase.GetUserProfileUseCase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

data class ProfileData(
    val fullName: String,
    val email: String,
    val username: String,
    val memberSince: String,
    val riskTolerance: String,
    val experience: String,
    val totalTrades: Int,
    val winRate: Double,
    val portfolioValue: String,
    val avatarInitials: String
)

data class ProfileUiState(
    val isLoading: Boolean = true,
    val profile: ProfileData? = null,
    val error: String? = null
)

class ProfileViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val currentSession: CurrentSession
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val userId = currentSession.userId
        if (userId.isEmpty()) {
            _uiState.value = ProfileUiState(isLoading = false, error = "Oturum bulunamadı")
            return
        }

        _uiState.value = ProfileUiState(isLoading = true)
        viewModelScope.launch {
            getUserProfileUseCase(userId)
                .catch { e ->
                    _uiState.value = ProfileUiState(
                        isLoading = false,
                        error = e.message ?: "Profil yüklenemedi"
                    )
                }
                .collect { profile ->
                    val initials = buildString {
                        profile.fullName?.split(" ")?.take(2)?.forEach { append(it.first()) }
                            ?: append(profile.username.take(2).uppercase())
                    }
                    _uiState.value = ProfileUiState(
                        isLoading = false,
                        profile = ProfileData(
                            fullName = profile.fullName ?: profile.username,
                            email = profile.email,
                            username = profile.username,
                            memberSince = profile.createdAt.toString().take(7),
                            riskTolerance = when (profile.investorProfile?.riskTolerance) {
                                RiskTolerance.CONSERVATIVE -> "Düşük Risk"
                                RiskTolerance.MODERATE -> "Orta Risk"
                                RiskTolerance.AGGRESSIVE -> "Yüksek Risk"
                                null -> "-"
                            },
                            experience = when (profile.investorProfile?.tradingExperience) {
                                TradingExperience.BEGINNER -> "Başlangıç"
                                TradingExperience.INTERMEDIATE -> "Orta Seviye"
                                TradingExperience.ADVANCED -> "İleri Seviye"
                                TradingExperience.EXPERT -> "Uzman"
                                null -> "-"
                            },
                            totalTrades = 0,
                            winRate = 0.0,
                            portfolioValue = "-",
                            avatarInitials = initials.uppercase()
                        )
                    )
                }
        }
    }
}
