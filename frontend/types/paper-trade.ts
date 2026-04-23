// ═══════════════════════════════════════════════════════════════
// Paper Trading (Sanal Borsa) — Type Definitions
// ═══════════════════════════════════════════════════════════════

// ─── Constants ───
export const PAPER_TRADE_INITIAL_BALANCE = 100_000
export const PAPER_TRADE_COMMISSION_RATE = 0.001 // ‰1 BIST standard
export const PAPER_TRADE_MAX_POSITION_WEIGHT = 0.40 // %40 max tek hisse
export const PAPER_TRADE_MAX_OPEN_ORDERS = 20
export const PAPER_TRADE_MAX_QUANTITY = 10_000
export const PAPER_TRADE_MIN_QUANTITY = 1

// ─── Enums / Unions ───
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'cancelled' | 'expired'
export type TimeInForce = 'GTC' | 'DAY' | 'IOC'

// ─── Position ───
export interface PaperPosition {
    ticker: string
    tickerName: string
    quantity: number
    avgCost: number
    currentPrice: number
    marketValue: number
    unrealizedPnL: number
    unrealizedPnLPercent: number
    weight: number
    openedAt: string
    lastUpdated: string
}

// ─── Portfolio ───
export interface PaperPortfolio {
    userId: string
    displayName: string
    initialBalance: number
    cashBalance: number
    totalValue: number
    totalPnL: number
    totalPnLPercent: number
    totalTrades: number
    winRate: number
    bestTrade: number
    worstTrade: number
    maxDrawdown: number
    sharpeRatio: number
    positions: Record<string, PaperPosition>
    createdAt: string
    updatedAt: string
    resetCount: number
}

// ─── Order ───
export interface PaperOrder {
    orderId: string
    ticker: string
    tickerName: string
    side: OrderSide
    type: OrderType
    quantity: number
    limitPrice: number | null
    stopPrice: number | null
    filledQuantity: number
    avgFillPrice: number | null
    status: OrderStatus
    timeInForce: TimeInForce
    stopLoss: number | null
    takeProfit: number | null
    commission: number
    total: number
    createdAt: string
    filledAt: string | null
    expiresAt: string | null
}

// ─── Create Order Request ───
export interface CreateOrderRequest {
    ticker: string
    tickerName: string
    side: OrderSide
    type: OrderType
    quantity: number
    limitPrice?: number | null
    stopPrice?: number | null
    stopLoss?: number | null
    takeProfit?: number | null
    timeInForce?: TimeInForce
}

// ─── Trade ───
export interface PaperTrade {
    tradeId: string
    orderId: string
    ticker: string
    tickerName: string
    side: OrderSide
    quantity: number
    price: number
    total: number
    commission: number
    pnl: number | null
    pnlPercent: number | null
    balanceAfter: number
    createdAt: string
}

// ─── Daily Snapshot ───
export interface DailySnapshot {
    date: string
    totalValue: number
    cashBalance: number
    positionsValue: number
    dailyPnL: number
    dailyPnLPercent: number
    cumulativePnL: number
    positions: Record<string, { quantity: number; avgCost: number; price: number }>
}

// ─── Leaderboard ───
export interface LeaderboardEntry {
    userId: string
    displayName: string
    photoURL: string | null
    totalPnL: number
    totalPnLPercent: number
    totalTrades: number
    winRate: number
    sharpeRatio: number
    rank: number
    streak: number
    updatedAt: string
}

// ─── Performance Metrics ───
export interface PortfolioMetrics {
    totalPnL: number
    totalPnLPercent: number
    winRate: number
    totalTrades: number
    winningTrades: number
    losingTrades: number
    bestTrade: number
    worstTrade: number
    avgWin: number
    avgLoss: number
    profitFactor: number
    sharpeRatio: number
    maxDrawdown: number
    maxDrawdownPercent: number
    avgTradeDuration: number // minutes
    dailyVolatility: number
    currentStreak: number // positive = winning, negative = losing
}

// ─── Trade Decision Analysis ───
export interface TradeScore {
    overall: number // 0-100
    entryTiming: number
    exitTiming: number
    riskReward: number
    notes: string[]
}

export interface OpportunityCost {
    tradeId: string
    ticker: string
    sellPrice: number
    priceAfter1h: number | null
    priceAfter1d: number | null
    priceAfter1w: number | null
    verdict: 'too_early' | 'good_timing' | 'too_late'
}

// ─── API Response Types ───
export interface PaperTradeOrderResponse {
    order: PaperOrder
    trade: PaperTrade | null
    portfolio: PaperPortfolio
    message: string
}

export interface PaperTradeHistoryResponse {
    trades: PaperTrade[]
    page: number
    totalPages: number
    totalTrades: number
    hasMore: boolean
}

export interface LeaderboardResponse {
    entries: LeaderboardEntry[]
    userRank: number | null
    total: number
}

// ─── UI State ───
export type PaperTradeTab = 'positions' | 'orders' | 'history' | 'performance' | 'timemachine'
export type LeaderboardSortBy = 'pnl' | 'winRate' | 'sharpe' | 'trades' | 'totalValue'
export type LeaderboardTimeFilter = 'weekly' | 'monthly' | 'all'
export type PortfolioChartRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
