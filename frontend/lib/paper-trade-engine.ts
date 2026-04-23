// ═══════════════════════════════════════════════════════════════
// Paper Trading — Order Matching Engine
// ═══════════════════════════════════════════════════════════════

import type {
    PaperPortfolio,
    PaperPosition,
    PaperOrder,
    PaperTrade,
    CreateOrderRequest,
    PaperTradeOrderResponse,
    PortfolioMetrics,
} from '@/types/paper-trade'
import { PAPER_TRADE_COMMISSION_RATE } from '@/types/paper-trade'
import { calculateOrderTotal } from './paper-trade-validators'

// ─── ID Generation ───
let _seq = 0
function generateId(prefix: string): string {
    _seq++
    return `${prefix}_${Date.now()}_${_seq}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Market Order Execution ───
export function executeMarketOrder(
    req: CreateOrderRequest,
    portfolio: PaperPortfolio,
    currentPrice: number
): PaperTradeOrderResponse {
    const now = new Date().toISOString()
    const orderId = generateId('ORD')
    const tradeId = generateId('TRD')
    const { subtotal, commission, total } = calculateOrderTotal(req.quantity, currentPrice)

    // Clone portfolio to avoid mutation
    const updatedPortfolio: PaperPortfolio = JSON.parse(JSON.stringify(portfolio))
    let pnl: number | null = null
    let pnlPercent: number | null = null

    if (req.side === 'buy') {
        // ─── BUY ───
        updatedPortfolio.totalTrades += 1
        updatedPortfolio.cashBalance = round2(updatedPortfolio.cashBalance - total)

        const existing = updatedPortfolio.positions[req.ticker]
        if (existing) {
            // Average cost recalculation
            const totalQty = existing.quantity + req.quantity
            const totalCost = existing.avgCost * existing.quantity + currentPrice * req.quantity
            existing.avgCost = round2(totalCost / totalQty)
            existing.quantity = totalQty
            existing.currentPrice = currentPrice
            existing.marketValue = round2(totalQty * currentPrice)
            existing.unrealizedPnL = round2(existing.marketValue - existing.avgCost * totalQty)
            existing.unrealizedPnLPercent = round2(
                (existing.unrealizedPnL / (existing.avgCost * totalQty)) * 100
            )
            existing.lastUpdated = now
        } else {
            // New position
            const newPosition: PaperPosition = {
                ticker: req.ticker,
                tickerName: req.tickerName,
                quantity: req.quantity,
                avgCost: currentPrice,
                currentPrice,
                marketValue: round2(req.quantity * currentPrice),
                unrealizedPnL: 0,
                unrealizedPnLPercent: 0,
                weight: 0,
                openedAt: now,
                lastUpdated: now,
            }
            updatedPortfolio.positions[req.ticker] = newPosition
        }
    } else {
        // ─── SELL ───
        const existing = updatedPortfolio.positions[req.ticker]
        if (!existing) throw new Error(`Position not found: ${req.ticker}`)

        pnl = round2((currentPrice - existing.avgCost) * req.quantity - commission)
        pnlPercent = round2(((currentPrice - existing.avgCost) / existing.avgCost) * 100)

        updatedPortfolio.cashBalance = round2(updatedPortfolio.cashBalance + subtotal - commission)

        if (req.quantity >= existing.quantity) {
            // Close full position
            delete updatedPortfolio.positions[req.ticker]
        } else {
            // Partial close — avgCost stays the same
            existing.quantity -= req.quantity
            existing.currentPrice = currentPrice
            existing.marketValue = round2(existing.quantity * currentPrice)
            existing.unrealizedPnL = round2(
                existing.marketValue - existing.avgCost * existing.quantity
            )
            existing.unrealizedPnLPercent = round2(
                (existing.unrealizedPnL / (existing.avgCost * existing.quantity)) * 100
            )
            existing.lastUpdated = now
        }

        // Update trade stats
        updatedPortfolio.totalTrades += 1
        if (pnl > updatedPortfolio.bestTrade) updatedPortfolio.bestTrade = pnl
        if (pnl < updatedPortfolio.worstTrade) updatedPortfolio.worstTrade = pnl
    }

    // Recalculate portfolio position weights and total value
    recalculatePortfolio(updatedPortfolio)
    updatedPortfolio.updatedAt = now

    // Build order record
    const order: PaperOrder = {
        orderId,
        ticker: req.ticker,
        tickerName: req.tickerName,
        side: req.side,
        type: 'market',
        quantity: req.quantity,
        limitPrice: null,
        stopPrice: null,
        filledQuantity: req.quantity,
        avgFillPrice: currentPrice,
        status: 'filled',
        timeInForce: req.timeInForce || 'IOC',
        stopLoss: req.stopLoss || null,
        takeProfit: req.takeProfit || null,
        commission,
        total,
        createdAt: now,
        filledAt: now,
        expiresAt: null,
    }

    // Build trade record
    const trade: PaperTrade = {
        tradeId,
        orderId,
        ticker: req.ticker,
        tickerName: req.tickerName,
        side: req.side,
        quantity: req.quantity,
        price: currentPrice,
        total: subtotal,
        commission,
        pnl,
        pnlPercent,
        balanceAfter: updatedPortfolio.cashBalance,
        createdAt: now,
    }

    const sideLabel = req.side === 'buy' ? 'Alış' : 'Satış'
    const message = pnl !== null
        ? `${sideLabel} emri gerçekleşti. P&L: ${pnl >= 0 ? '+' : ''}₺${pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
        : `${sideLabel} emri gerçekleşti. ${req.quantity} adet ${req.ticker} @ ₺${currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`

    return { order, trade, portfolio: updatedPortfolio, message }
}

// ─── Create Pending Order (Limit/Stop) ───
export function createPendingOrder(
    req: CreateOrderRequest,
    portfolio: PaperPortfolio
): { order: PaperOrder; portfolio: PaperPortfolio } {
    const now = new Date().toISOString()
    const orderId = generateId('ORD')

    const effectivePrice = req.limitPrice || req.stopPrice || 0
    const { commission, total } = calculateOrderTotal(req.quantity, effectivePrice)

    // Reserve funds for buy orders
    const updatedPortfolio: PaperPortfolio = JSON.parse(JSON.stringify(portfolio))
    if (req.side === 'buy') {
        updatedPortfolio.cashBalance = round2(updatedPortfolio.cashBalance - total)
        recalculatePortfolio(updatedPortfolio)
    }
    updatedPortfolio.updatedAt = now

    const order: PaperOrder = {
        orderId,
        ticker: req.ticker,
        tickerName: req.tickerName,
        side: req.side,
        type: req.type,
        quantity: req.quantity,
        limitPrice: req.limitPrice || null,
        stopPrice: req.stopPrice || null,
        filledQuantity: 0,
        avgFillPrice: null,
        status: 'pending',
        timeInForce: req.timeInForce || 'GTC',
        stopLoss: req.stopLoss || null,
        takeProfit: req.takeProfit || null,
        commission: 0,
        total: 0,
        createdAt: now,
        filledAt: null,
        expiresAt: null,
    }

    return { order, portfolio: updatedPortfolio }
}

// ─── Recalculate Portfolio Totals ───
export function recalculatePortfolio(portfolio: PaperPortfolio): void {
    let positionsValue = 0
    const positions = Object.values(portfolio.positions)

    for (const pos of positions) {
        pos.marketValue = round2(pos.quantity * pos.currentPrice)
        pos.unrealizedPnL = round2(pos.marketValue - pos.avgCost * pos.quantity)
        pos.unrealizedPnLPercent =
            pos.avgCost > 0
                ? round2((pos.unrealizedPnL / (pos.avgCost * pos.quantity)) * 100)
                : 0
        positionsValue += pos.marketValue
    }

    portfolio.totalValue = round2(portfolio.cashBalance + positionsValue)
    portfolio.totalPnL = round2(portfolio.totalValue - portfolio.initialBalance)
    portfolio.totalPnLPercent =
        portfolio.initialBalance > 0
            ? round2((portfolio.totalPnL / portfolio.initialBalance) * 100)
            : 0

    // Update position weights
    for (const pos of positions) {
        pos.weight =
            portfolio.totalValue > 0 ? round2((pos.marketValue / portfolio.totalValue) * 100) : 0
    }
}

// ─── Update Live Prices on Portfolio ───
export function updatePortfolioWithPrices(
    portfolio: PaperPortfolio,
    prices: Record<string, number>
): PaperPortfolio {
    const updated: PaperPortfolio = JSON.parse(JSON.stringify(portfolio))

    for (const [ticker, price] of Object.entries(prices)) {
        const pos = updated.positions[ticker]
        if (pos && price > 0) {
            pos.currentPrice = price
        }
    }

    recalculatePortfolio(updated)
    updated.updatedAt = new Date().toISOString()

    return updated
}

// ─── Calculate Win Rate ───
export function calculateWinRate(trades: PaperTrade[]): number {
    const sellTrades = trades.filter((t) => t.side === 'sell' && t.pnl !== null)
    if (sellTrades.length === 0) return 0
    const wins = sellTrades.filter((t) => (t.pnl ?? 0) > 0).length
    return round2((wins / sellTrades.length) * 100)
}

// ─── Calculate Performance Metrics ───
export function calculateMetrics(
    portfolio: PaperPortfolio,
    trades: PaperTrade[],
    dailySnapshots: { totalValue: number; date: string }[]
): PortfolioMetrics {
    const sellTrades = trades.filter((t) => t.side === 'sell' && t.pnl !== null)
    const winningTrades = sellTrades.filter((t) => (t.pnl ?? 0) > 0)
    const losingTrades = sellTrades.filter((t) => (t.pnl ?? 0) <= 0)

    const totalWin = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0))

    // Sharpe Ratio (annualized, risk-free rate = 0 for simplicity)
    let sharpeRatio = 0
    let dailyVolatility = 0
    if (dailySnapshots.length >= 2) {
        const dailyReturns: number[] = []
        for (let i = 1; i < dailySnapshots.length; i++) {
            const prevVal = dailySnapshots[i - 1].totalValue
            if (prevVal > 0) {
                dailyReturns.push((dailySnapshots[i].totalValue - prevVal) / prevVal)
            }
        }
        if (dailyReturns.length > 0) {
            const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
            const variance =
                dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / dailyReturns.length
            dailyVolatility = Math.sqrt(variance)
            sharpeRatio = dailyVolatility > 0 ? round2((avgReturn / dailyVolatility) * Math.sqrt(252)) : 0
        }
    }

    // Max drawdown
    let maxDrawdown = 0
    let maxDrawdownPercent = 0
    if (dailySnapshots.length > 0) {
        let peak = dailySnapshots[0].totalValue
        for (const snap of dailySnapshots) {
            if (snap.totalValue > peak) peak = snap.totalValue
            const drawdown = peak - snap.totalValue
            const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0
            if (drawdownPct > maxDrawdownPercent) {
                maxDrawdown = drawdown
                maxDrawdownPercent = drawdownPct
            }
        }
    }

    // Current streak
    let currentStreak = 0
    for (let i = sellTrades.length - 1; i >= 0; i--) {
        const pnl = sellTrades[i].pnl ?? 0
        if (i === sellTrades.length - 1) {
            currentStreak = pnl > 0 ? 1 : -1
        } else {
            if ((pnl > 0 && currentStreak > 0) || (pnl <= 0 && currentStreak < 0)) {
                currentStreak += currentStreak > 0 ? 1 : -1
            } else {
                break
            }
        }
    }

    return {
        totalPnL: portfolio.totalPnL,
        totalPnLPercent: portfolio.totalPnLPercent,
        winRate: sellTrades.length > 0 ? round2((winningTrades.length / sellTrades.length) * 100) : 0,
        totalTrades: sellTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        bestTrade: portfolio.bestTrade,
        worstTrade: portfolio.worstTrade,
        avgWin: winningTrades.length > 0 ? round2(totalWin / winningTrades.length) : 0,
        avgLoss: losingTrades.length > 0 ? round2(totalLoss / losingTrades.length) : 0,
        profitFactor: totalLoss > 0 ? round2(totalWin / totalLoss) : totalWin > 0 ? Infinity : 0,
        sharpeRatio,
        maxDrawdown: round2(maxDrawdown),
        maxDrawdownPercent: round2(maxDrawdownPercent),
        avgTradeDuration: 0, // would need open/close timestamps per position
        dailyVolatility: round2(dailyVolatility * 100),
        currentStreak,
    }
}

// ─── Utility ───
function round2(n: number): number {
    return Math.round(n * 100) / 100
}
