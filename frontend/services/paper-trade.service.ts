// ═══════════════════════════════════════════════════════════════
// Paper Trading — Service Layer (Firebase/Firestore)
// ═══════════════════════════════════════════════════════════════
// Data stored under users/{userId}/paper_* subcollections
// This matches existing Firestore rules: users/{userId}/{document=**}

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    orderBy,
    getDocs,
    writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
    PaperPortfolio,
    PaperOrder,
    PaperTrade,
    CreateOrderRequest,
    PaperTradeOrderResponse,
    PaperTradeHistoryResponse,
    DailySnapshot,
    LeaderboardResponse,
    PortfolioMetrics,
} from '@/types/paper-trade'
import { validateOrder, createDefaultPortfolio, calculateOrderTotal } from '@/lib/paper-trade-validators'
import {
    executeMarketOrder,
    createPendingOrder,
    recalculatePortfolio,
    calculateMetrics,
    calculateWinRate,
    updatePortfolioWithPrices,
} from '@/lib/paper-trade-engine'

// ─── Collection Paths (under users/{userId}) ───
const paths = {
    portfolio: (uid: string) => doc(db, 'users', uid, 'paper_portfolio', 'current'),
    orders: (uid: string) => collection(db, 'users', uid, 'paper_orders'),
    order: (uid: string, orderId: string) => doc(db, 'users', uid, 'paper_orders', orderId),
    trades: (uid: string) => collection(db, 'users', uid, 'paper_trades'),
    trade: (uid: string, tradeId: string) => doc(db, 'users', uid, 'paper_trades', tradeId),
    snapshots: (uid: string) => collection(db, 'users', uid, 'paper_snapshots'),
    snapshot: (uid: string, date: string) => doc(db, 'users', uid, 'paper_snapshots', date),
}

// ─── Helpers ───
function toPlain<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
}

// ─── Service ───
export const paperTradeService = {
    // ─────────────────────────────────────────────
    //  Portfolio
    // ─────────────────────────────────────────────

    async getPortfolio(userId: string, displayName: string): Promise<PaperPortfolio> {
        const docRef = paths.portfolio(userId)
        const snapshot = await getDoc(docRef)

        if (snapshot.exists()) {
            return snapshot.data() as PaperPortfolio
        }

        // Create new portfolio
        const portfolio = createDefaultPortfolio(userId, displayName)
        await setDoc(docRef, toPlain(portfolio))
        return portfolio
    },

    async savePortfolio(portfolio: PaperPortfolio): Promise<void> {
        const docRef = paths.portfolio(portfolio.userId)
        await setDoc(docRef, toPlain(portfolio))
    },

    async resetPortfolio(userId: string, displayName: string): Promise<PaperPortfolio> {
        // Get current reset count
        const docRef = paths.portfolio(userId)
        const existing = await getDoc(docRef)
        const resetCount = existing.exists() ? ((existing.data() as PaperPortfolio).resetCount || 0) + 1 : 0

        // Create fresh portfolio
        const portfolio = createDefaultPortfolio(userId, displayName)
        portfolio.resetCount = resetCount
        await setDoc(docRef, toPlain(portfolio))

        // Delete all orders
        const ordersSnap = await getDocs(paths.orders(userId))
        if (ordersSnap.docs.length > 0) {
            const batch = writeBatch(db)
            ordersSnap.docs.forEach((d) => batch.delete(d.ref))
            await batch.commit()
        }

        // Delete all trades
        const tradesSnap = await getDocs(paths.trades(userId))
        if (tradesSnap.docs.length > 0) {
            const batch = writeBatch(db)
            tradesSnap.docs.forEach((d) => batch.delete(d.ref))
            await batch.commit()
        }

        // Delete all snapshots
        const snapsSnap = await getDocs(paths.snapshots(userId))
        if (snapsSnap.docs.length > 0) {
            const batch = writeBatch(db)
            snapsSnap.docs.forEach((d) => batch.delete(d.ref))
            await batch.commit()
        }

        return portfolio
    },

    async updatePortfolioWithPrices(userId: string, prices: Record<string, number>): Promise<PaperPortfolio> {
        const docRef = paths.portfolio(userId)
        const snapshot = await getDoc(docRef)
        if (!snapshot.exists()) throw new Error('Portfolio not found')

        const portfolio = snapshot.data() as PaperPortfolio
        const updated = updatePortfolioWithPrices(portfolio, prices)
        await setDoc(docRef, toPlain(updated))
        return updated
    },

    // ─────────────────────────────────────────────
    //  Orders
    // ─────────────────────────────────────────────

    async getOrders(userId: string): Promise<PaperOrder[]> {
        const snap = await getDocs(paths.orders(userId))
        return snap.docs
            .map((d) => d.data() as PaperOrder)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },

    async getOpenOrders(userId: string): Promise<PaperOrder[]> {
        const all = await this.getOrders(userId)
        return all.filter((o) => o.status === 'pending')
    },

    async getOrderHistory(userId: string): Promise<PaperOrder[]> {
        const all = await this.getOrders(userId)
        return all.filter((o) => o.status !== 'pending')
    },

    async saveOrder(userId: string, order: PaperOrder): Promise<void> {
        const docRef = paths.order(userId, order.orderId)
        await setDoc(docRef, toPlain(order))
    },

    async cancelOrder(userId: string, orderId: string): Promise<PaperPortfolio> {
        const orderRef = paths.order(userId, orderId)
        const orderSnap = await getDoc(orderRef)
        if (!orderSnap.exists()) throw new Error('Emir bulunamadı.')

        const order = orderSnap.data() as PaperOrder
        if (order.status !== 'pending') throw new Error('Bu emir iptal edilemez.')

        // Update order status
        await updateDoc(orderRef, { status: 'cancelled' })

        // Release reserved funds for buy orders
        const portfolioRef = paths.portfolio(userId)
        const portfolioSnap = await getDoc(portfolioRef)
        const portfolio = portfolioSnap.data() as PaperPortfolio

        if (order.side === 'buy') {
            const effectivePrice = order.limitPrice || order.stopPrice || 0
            const { total } = calculateOrderTotal(order.quantity, effectivePrice)
            portfolio.cashBalance = Math.round((portfolio.cashBalance + total) * 100) / 100
            recalculatePortfolio(portfolio)
            portfolio.updatedAt = new Date().toISOString()
            await setDoc(portfolioRef, toPlain(portfolio))
        }

        return portfolio
    },

    // ─────────────────────────────────────────────
    //  Create & Execute Orders
    // ─────────────────────────────────────────────

    async submitOrder(
        userId: string,
        displayName: string,
        req: CreateOrderRequest,
        currentPrice: number
    ): Promise<PaperTradeOrderResponse> {
        const portfolio = await this.getPortfolio(userId, displayName)
        const openOrders = await this.getOpenOrders(userId)

        // Validate
        const validation = validateOrder(req, portfolio, currentPrice, openOrders.length)
        if (!validation.valid) {
            throw new Error(validation.error)
        }

        if (req.type === 'market') {
            const result = executeMarketOrder(req, portfolio, currentPrice)

            await this.savePortfolio(result.portfolio)
            await this.saveOrder(userId, result.order)
            if (result.trade) {
                await this.saveTrade(userId, result.trade)
            }

            // Update win rate
            if (result.trade?.side === 'sell') {
                const allTrades = await this.getTrades(userId)
                result.portfolio.winRate = calculateWinRate(allTrades)
                await this.savePortfolio(result.portfolio)
            }

            return result
        } else {
            const { order, portfolio: updatedPortfolio } = createPendingOrder(req, portfolio)

            await this.savePortfolio(updatedPortfolio)
            await this.saveOrder(userId, order)

            return {
                order,
                trade: null,
                portfolio: updatedPortfolio,
                message: `${req.side === 'buy' ? 'Alış' : 'Satış'} emri oluşturuldu. Fiyat hedefe ulaştığında gerçekleşecek.`,
            }
        }
    },

    // ─────────────────────────────────────────────
    //  Trades
    // ─────────────────────────────────────────────

    async getTrades(userId: string): Promise<PaperTrade[]> {
        const snap = await getDocs(paths.trades(userId))
        return snap.docs
            .map((d) => d.data() as PaperTrade)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },

    async getTradeHistory(userId: string, page = 1, pageLimit = 50): Promise<PaperTradeHistoryResponse> {
        const allTrades = await this.getTrades(userId)
        const totalTrades = allTrades.length
        const totalPages = Math.max(1, Math.ceil(totalTrades / pageLimit))
        const start = (page - 1) * pageLimit
        const trades = allTrades.slice(start, start + pageLimit)

        return {
            trades,
            page,
            totalPages,
            totalTrades,
            hasMore: page < totalPages,
        }
    },

    async saveTrade(userId: string, trade: PaperTrade): Promise<void> {
        const docRef = paths.trade(userId, trade.tradeId)
        await setDoc(docRef, toPlain(trade))
    },

    // ─────────────────────────────────────────────
    //  Performance & Snapshots
    // ─────────────────────────────────────────────

    async getSnapshots(userId: string): Promise<DailySnapshot[]> {
        const snap = await getDocs(paths.snapshots(userId))
        return snap.docs
            .map((d) => d.data() as DailySnapshot)
            .sort((a, b) => a.date.localeCompare(b.date))
    },

    async saveDailySnapshot(userId: string, portfolio: PaperPortfolio): Promise<DailySnapshot> {
        const today = new Date().toISOString().slice(0, 10)
        const snapshots = await this.getSnapshots(userId)

        const positionsValue = Object.values(portfolio.positions).reduce(
            (sum, p) => sum + p.marketValue,
            0
        )
        const prevSnapshot = snapshots[snapshots.length - 1]
        const prevValue = prevSnapshot?.totalValue || portfolio.initialBalance

        const snapshot: DailySnapshot = {
            date: today,
            totalValue: portfolio.totalValue,
            cashBalance: portfolio.cashBalance,
            positionsValue,
            dailyPnL: Math.round((portfolio.totalValue - prevValue) * 100) / 100,
            dailyPnLPercent:
                prevValue > 0
                    ? Math.round(((portfolio.totalValue - prevValue) / prevValue) * 10000) / 100
                    : 0,
            cumulativePnL: portfolio.totalPnL,
            positions: Object.fromEntries(
                Object.entries(portfolio.positions).map(([t, p]) => [
                    t,
                    { quantity: p.quantity, avgCost: p.avgCost, price: p.currentPrice },
                ])
            ),
        }

        const docRef = paths.snapshot(userId, today)
        await setDoc(docRef, toPlain(snapshot))
        return snapshot
    },

    async getMetrics(userId: string, displayName: string): Promise<PortfolioMetrics> {
        const portfolio = await this.getPortfolio(userId, displayName)
        const trades = await this.getTrades(userId)
        const snapshots = await this.getSnapshots(userId)
        return calculateMetrics(portfolio, trades, snapshots)
    },

    // ─────────────────────────────────────────────
    //  Leaderboard (placeholder)
    // ─────────────────────────────────────────────

    async getLeaderboard(): Promise<LeaderboardResponse> {
        return {
            entries: [],
            userRank: null,
            total: 0,
        }
    },
}
