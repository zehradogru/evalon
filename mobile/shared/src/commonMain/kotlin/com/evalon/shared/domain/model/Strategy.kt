package com.evalon.shared.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class Strategy(
    val id: String,
    val name: String,
    val description: String? = null,
    val rules: List<Rule>,
    val status: StrategyStatus,
    val createdAt: Instant,
    val updatedAt: Instant,
    val userId: String
)

enum class StrategyStatus {
    DRAFT,
    BACKTESTED,
    PAPER_TRADING,
    ACTIVE,
    RETIRED
}
