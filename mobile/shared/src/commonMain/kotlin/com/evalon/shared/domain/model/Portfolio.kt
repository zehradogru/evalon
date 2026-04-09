package com.evalon.shared.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class Portfolio(
    val id: String,
    val userId: String,
    val totalValue: Double,
    val cash: Double,
    val positions: List<Position>,
    val lastUpdated: Instant
)

@Serializable
data class Position(
    val symbol: String,
    val quantity: Double,
    val averagePrice: Double,
    val currentPrice: Double,
    val unrealizedPnL: Double,
    val realizedPnL: Double = 0.0
)
