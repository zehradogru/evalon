package com.evalon.shared.data.local

import com.evalon.database.EvalonDatabase
import com.evalon.shared.domain.model.MarketItem
import com.evalon.shared.domain.model.Portfolio
import com.evalon.shared.domain.model.Position
import com.evalon.shared.domain.model.StockCandle
import com.evalon.shared.domain.model.Strategy
import com.evalon.shared.domain.model.StrategyStatus
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant

class DatabaseHelper(driverFactory: DatabaseDriverFactory) {

    private val database = EvalonDatabase(driverFactory.createDriver())
    private val queries = database.evalonDatabaseQueries

    // ─── Market data / candles ────────────────────────────────────────────

    fun cacheCandles(symbol: String, candles: List<StockCandle>) {
        database.transaction {
            // Keep last 7 days of data — prune older entries
            val cutoff = Clock.System.now().toEpochMilliseconds() - 7 * 24 * 60 * 60 * 1000L
            queries.deleteOldMarketData(symbol, cutoff)
            candles.forEach { c ->
                queries.insertOrReplaceMarketData(
                    symbol = symbol,
                    timestamp = c.time,
                    open_ = c.open,
                    high = c.high,
                    low = c.low,
                    close = c.close,
                    volume = c.volume
                )
            }
        }
    }

    fun getCachedCandles(symbol: String, limit: Long = 500): List<StockCandle> {
        return queries.selectCachedCandles(symbol, limit).executeAsList().map { row ->
            StockCandle(
                time = row.timestamp,
                open = row.open_,
                high = row.high,
                low = row.low,
                close = row.close,
                volume = row.volume
            )
        }
    }

    // ─── Portfolio cache ──────────────────────────────────────────────────

    fun cachePortfolio(portfolio: Portfolio) {
        database.transaction {
            queries.upsertPortfolioCache(
                user_id = portfolio.userId,
                total_value = portfolio.totalValue,
                cash = portfolio.cash,
                last_updated = portfolio.lastUpdated.toEpochMilliseconds()
            )
            queries.deletePositionsForUser(portfolio.userId)
            portfolio.positions.forEachIndexed { i, pos ->
                queries.insertOrReplacePosition(
                    id = "${portfolio.userId}_${pos.symbol}_$i",
                    user_id = portfolio.userId,
                    symbol = pos.symbol,
                    quantity = pos.quantity,
                    average_price = pos.averagePrice,
                    current_price = pos.currentPrice,
                    unrealized_pnl = pos.unrealizedPnL,
                    realized_pnl = pos.realizedPnL
                )
            }
        }
    }

    fun getCachedPortfolio(userId: String): Portfolio? {
        val row = queries.selectPortfolioCache(userId).executeAsOneOrNull() ?: return null
        val positions = queries.selectPositionsForUser(userId).executeAsList().map { p ->
            Position(
                symbol = p.symbol,
                quantity = p.quantity,
                averagePrice = p.average_price,
                currentPrice = p.current_price,
                unrealizedPnL = p.unrealized_pnl,
                realizedPnL = p.realized_pnl
            )
        }
        return Portfolio(
            id = "cached",
            userId = userId,
            totalValue = row.total_value,
            cash = row.cash,
            positions = positions,
            lastUpdated = Instant.fromEpochMilliseconds(row.last_updated)
        )
    }

    // ─── Strategy cache ───────────────────────────────────────────────────

    fun cacheStrategies(strategies: List<Strategy>) {
        database.transaction {
            strategies.forEach { s ->
                queries.insertOrReplaceStrategy(
                    id = s.id,
                    name = s.name,
                    description = s.description,
                    status = s.status.name,
                    created_at = s.createdAt.toEpochMilliseconds(),
                    updated_at = s.updatedAt.toEpochMilliseconds(),
                    user_id = s.userId
                )
            }
        }
    }

    fun getCachedStrategies(userId: String): List<Strategy> {
        return queries.selectAllStrategies(userId).executeAsList().map { row ->
            Strategy(
                id = row.id,
                name = row.name,
                description = row.description,
                rules = emptyList(),
                status = runCatching { StrategyStatus.valueOf(row.status) }.getOrDefault(StrategyStatus.ACTIVE),
                createdAt = Instant.fromEpochMilliseconds(row.created_at),
                updatedAt = Instant.fromEpochMilliseconds(row.updated_at),
                userId = row.user_id
            )
        }
    }

    // ─── Watchlist ────────────────────────────────────────────────────────

    fun getWatchlist(): List<String> {
        return queries.selectWatchlist().executeAsList()
    }

    fun addToWatchlist(symbol: String) {
        queries.addToWatchlist(symbol, Clock.System.now().toEpochMilliseconds())
    }

    fun removeFromWatchlist(symbol: String) {
        queries.removeFromWatchlist(symbol)
    }

    fun isInWatchlist(symbol: String): Boolean {
        return (queries.isInWatchlist(symbol).executeAsOne()) > 0
    }
}
