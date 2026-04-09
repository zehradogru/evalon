package com.evalon.shared.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    val username: String,
    val fullName: String? = null,
    val createdAt: Instant,
    val investorProfile: InvestorProfile? = null
)

@Serializable
data class InvestorProfile(
    val riskTolerance: RiskTolerance,
    val tradingExperience: TradingExperience,
    val behavioralScore: Double? = null,
    val lastAnalyzed: Instant? = null
)

enum class RiskTolerance {
    CONSERVATIVE,
    MODERATE,
    AGGRESSIVE
}

enum class TradingExperience {
    BEGINNER,
    INTERMEDIATE,
    ADVANCED,
    EXPERT
}
