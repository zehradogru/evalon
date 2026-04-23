// ═══════════════════════════════════════════════════════════════
// Paper Trading — Zustand Store (Firebase/Firestore)
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type {
    PaperPortfolio,
    PaperOrder,
    PaperTrade,
    CreateOrderRequest,
    PaperTradeOrderResponse,
    PaperTradeHistoryResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    PortfolioMetrics,
    DailySnapshot,
    PaperTradeTab,
} from '@/types/paper-trade'
import { paperTradeService } from '@/services/paper-trade.service'

interface PaperTradeState {
    // ─── Portfolio ───
    portfolio: PaperPortfolio | null
    portfolioLoading: boolean
    portfolioError: string | null

    // ─── Orders ───
    openOrders: PaperOrder[]
    orderHistory: PaperOrder[]
    ordersLoading: boolean

    // ─── Trades ───
    trades: PaperTrade[]
    tradesLoading: boolean
    tradesPagination: { page: number; hasMore: boolean; total: number }

    // ─── Metrics ───
    metrics: PortfolioMetrics | null

    // ─── Snapshots ───
    snapshots: DailySnapshot[]

    // ─── Leaderboard ───
    leaderboard: LeaderboardEntry[]
    leaderboardLoading: boolean
    userRank: number | null

    // ─── UI State ───
    selectedTicker: string | null
    selectedTickerName: string
    activeTab: PaperTradeTab
    orderEntryVisible: boolean
    lastMessage: string | null
    lastError: string | null

    // ─── Actions ───
    initialize: (userId: string, displayName: string) => Promise<void>
    submitOrder: (req: CreateOrderRequest, currentPrice: number) => Promise<PaperTradeOrderResponse | null>
    cancelOrder: (orderId: string) => Promise<void>
    loadTradeHistory: (page?: number) => Promise<void>
    loadMetrics: () => Promise<void>
    loadSnapshots: () => Promise<void>
    resetPortfolio: () => Promise<void>
    updateLivePrices: (prices: Record<string, number>) => Promise<void>
    setSelectedTicker: (ticker: string, name?: string) => void
    setActiveTab: (tab: PaperTradeTab) => void
    setOrderEntryVisible: (visible: boolean) => void
    clearMessage: () => void
    clearError: () => void
}

export const usePaperTradeStore = create<PaperTradeState>((set, get) => ({
    // ─── Initial State ───
    portfolio: null,
    portfolioLoading: false,
    portfolioError: null,
    openOrders: [],
    orderHistory: [],
    ordersLoading: false,
    trades: [],
    tradesLoading: false,
    tradesPagination: { page: 1, hasMore: false, total: 0 },
    metrics: null,
    snapshots: [],
    leaderboard: [],
    leaderboardLoading: false,
    userRank: null,
    selectedTicker: null,
    selectedTickerName: '',
    activeTab: 'positions',
    orderEntryVisible: true,
    lastMessage: null,
    lastError: null,

    // ─── Initialize ───
    initialize: async (userId: string, displayName: string) => {
        try {
            set({ portfolioLoading: true, portfolioError: null })
            const portfolio = await paperTradeService.getPortfolio(userId, displayName)

            // Recount totalTrades from actual trade history (fixes stale counters)
            try {
                const allTrades = await paperTradeService.getTrades(userId)
                if (allTrades.length !== portfolio.totalTrades) {
                    portfolio.totalTrades = allTrades.length
                    await paperTradeService.savePortfolio(portfolio)
                }
            } catch { /* non-critical */ }

            set({
                portfolio,
                portfolioLoading: false,
            })

            // Sync to leaderboard (backfill for existing users)
            try {
                await paperTradeService.updateLeaderboard(userId, portfolio)
            } catch { /* non-critical */ }

            // Load orders lazily
            try {
                const openOrders = await paperTradeService.getOpenOrders(userId)
                const orderHistory = await paperTradeService.getOrderHistory(userId)
                set({ openOrders, orderHistory })
            } catch {
                set({ openOrders: [], orderHistory: [] })
            }
        } catch (err) {
            set({ portfolioError: (err as Error).message, portfolioLoading: false })
        }
    },

    // ─── Submit Order ───
    submitOrder: async (req: CreateOrderRequest, currentPrice: number) => {
        const { portfolio } = get()
        if (!portfolio) {
            set({ lastError: 'Portföy bulunamadı. Lütfen sayfayı yenileyin.' })
            return null
        }

        try {
            const result = await paperTradeService.submitOrder(
                portfolio.userId,
                portfolio.displayName,
                req,
                currentPrice
            )
            const openOrders = await paperTradeService.getOpenOrders(portfolio.userId)
            const orderHistory = await paperTradeService.getOrderHistory(portfolio.userId)
            set({
                portfolio: result.portfolio,
                openOrders,
                orderHistory,
                lastMessage: result.message,
                lastError: null,
            })
            return result
        } catch (err) {
            set({ lastError: (err as Error).message })
            return null
        }
    },

    // ─── Cancel Order ───
    cancelOrder: async (orderId: string) => {
        const { portfolio } = get()
        if (!portfolio) return

        try {
            const updatedPortfolio = await paperTradeService.cancelOrder(portfolio.userId, orderId)
            const openOrders = await paperTradeService.getOpenOrders(portfolio.userId)
            const orderHistory = await paperTradeService.getOrderHistory(portfolio.userId)
            set({
                portfolio: updatedPortfolio,
                openOrders,
                orderHistory,
                lastMessage: 'Emir başarıyla iptal edildi.',
                lastError: null,
            })
        } catch (err) {
            set({ lastError: (err as Error).message })
        }
    },

    // ─── Load Trade History ───
    loadTradeHistory: async (page = 1) => {
        const { portfolio } = get()
        if (!portfolio) return

        set({ tradesLoading: true })
        try {
            const result = await paperTradeService.getTradeHistory(portfolio.userId, page)
            set({
                trades: page === 1 ? result.trades : [...get().trades, ...result.trades],
                tradesLoading: false,
                tradesPagination: {
                    page: result.page,
                    hasMore: result.hasMore,
                    total: result.totalTrades,
                },
            })
        } catch {
            set({ tradesLoading: false })
        }
    },

    // ─── Load Metrics ───
    loadMetrics: async () => {
        const { portfolio } = get()
        if (!portfolio) return

        try {
            const metrics = await paperTradeService.getMetrics(portfolio.userId, portfolio.displayName)
            set({ metrics })
        } catch {
            // Silently fail
        }
    },

    // ─── Load Snapshots ───
    loadSnapshots: async () => {
        const { portfolio } = get()
        if (!portfolio) return

        try {
            const snapshots = await paperTradeService.getSnapshots(portfolio.userId)
            set({ snapshots })
        } catch {
            // Silently fail
        }
    },

    // ─── Reset Portfolio ───
    resetPortfolio: async () => {
        const { portfolio } = get()
        if (!portfolio) return

        try {
            const newPortfolio = await paperTradeService.resetPortfolio(portfolio.userId, portfolio.displayName)
            set({
                portfolio: newPortfolio,
                openOrders: [],
                orderHistory: [],
                trades: [],
                tradesPagination: { page: 1, hasMore: false, total: 0 },
                metrics: null,
                snapshots: [],
                lastMessage: 'Portföy başarıyla sıfırlandı. Yeni bakiye: ₺100.000',
                lastError: null,
            })
        } catch (err) {
            set({ lastError: (err as Error).message })
        }
    },

    // ─── Update Live Prices ───
    updateLivePrices: async (prices: Record<string, number>) => {
        const { portfolio } = get()
        if (!portfolio || Object.keys(portfolio.positions).length === 0) return

        try {
            const updated = await paperTradeService.updatePortfolioWithPrices(portfolio.userId, prices)
            set({ portfolio: updated })
        } catch {
            // Ignore price update errors
        }
    },

    // ─── UI Actions ───
    setSelectedTicker: (ticker: string, name?: string) =>
        set({ selectedTicker: ticker, selectedTickerName: name || ticker }),
    setActiveTab: (tab: PaperTradeTab) => set({ activeTab: tab }),
    setOrderEntryVisible: (visible: boolean) => set({ orderEntryVisible: visible }),
    clearMessage: () => set({ lastMessage: null }),
    clearError: () => set({ lastError: null }),
}))
