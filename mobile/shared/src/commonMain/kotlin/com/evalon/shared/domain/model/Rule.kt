package com.evalon.shared.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Rule(
    val id: String,
    val type: RuleType,
    val condition: String,
    val action: RuleAction,
    val parameters: Map<String, String> = emptyMap()
)

enum class RuleType {
    INDICATOR,
    PRICE,
    VOLUME,
    TIME,
    CUSTOM
}

enum class RuleAction {
    BUY,
    SELL,
    HOLD,
    STOP_LOSS,
    TAKE_PROFIT
}
