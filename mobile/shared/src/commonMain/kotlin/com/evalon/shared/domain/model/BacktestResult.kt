package com.evalon.shared.domain.model

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
data class BacktestResult(
    val id: String,
    val strategyId: String,
    val startDate: Instant,
    val endDate: Instant,
    val initialCapital: Double,
    val finalCapital: Double,
    val totalReturn: Double,
    val totalReturnPercent: Double,
    val maxDrawdown: Double,
    val maxDrawdownPercent: Double,
    val sharpeRatio: Double? = null,
    val winRate: Double,
    val totalTrades: Int,
    val winningTrades: Int,
    val losingTrades: Int,
    val averageWin: Double,
    val averageLoss: Double,
    val trades: List<Trade>,
    val createdAt: Instant
)

@Serializable
data class Trade(
    val id: String,
    val symbol: String,
    val action: TradeAction,
    val quantity: Double,
    val price: Double,
    val timestamp: Instant,
    val pnl: Double? = null
)

enum class TradeAction {
    BUY,
    SELL
}
