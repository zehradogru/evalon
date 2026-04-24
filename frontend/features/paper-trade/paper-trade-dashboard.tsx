'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/use-auth-store'
import { usePaperTradeStore } from '@/store/use-paper-trade-store'
import { fetchPrices, getLatestPrice } from '@/services/price.service'
import { PortfolioSummaryCard } from './portfolio-summary-card'
import { OrderEntryPanel } from './order-entry-panel'
import { PositionsTable } from './positions-table'
import { TradeHistoryTable } from './trade-history-table'
import { PerformanceMetrics } from './performance-metrics'
import { PortfolioChart } from './portfolio-chart'
import { OrderBookWidget } from './order-book-widget'
import { ResetPortfolioDialog } from './reset-portfolio-dialog'
import { cn } from '@/lib/utils'
import { BarChart3, Clock, TrendingUp, AlertCircle, CheckCircle2, ClipboardList, Sparkles, ArrowRight, Trophy } from 'lucide-react'
import type { CreateOrderRequest, PaperTradeTab } from '@/types/paper-trade'
import { AssetAllocationChart } from './asset-allocation-chart'

const TABS: { id: PaperTradeTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'positions', label: 'Pozisyonlar', icon: BarChart3 },
    { id: 'orders', label: 'Emirler', icon: ClipboardList },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'performance', label: 'Performans', icon: TrendingUp },
]

export function PaperTradeDashboard() {
    const { user } = useAuthStore()
    const {
        portfolio,
        portfolioLoading,
        portfolioError,
        openOrders,
        trades,
        tradesLoading,
        tradesPagination,
        metrics,
        snapshots,
        activeTab,
        selectedTicker,
        selectedTickerName,
        lastMessage,
        lastError,
        initialize,
        submitOrder,
        cancelOrder,
        loadTradeHistory,
        loadMetrics,
        loadSnapshots,
        resetPortfolio,
        updateLivePrices,
        setSelectedTicker,
        setActiveTab,
        clearMessage,
        clearError,
    } = usePaperTradeStore()

    const [resetDialogOpen, setResetDialogOpen] = useState(false)
    const [currentPrice, setCurrentPrice] = useState<number>(0)
    const [priceLoading, setPriceLoading] = useState(false)
    const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ─── Initialize ───
    useEffect(() => {
        if (user) {
            initialize(user.id, user.name || user.email)
        }
    }, [user, initialize])

    // ─── Load tab-specific data ───
    useEffect(() => {
        if (!portfolio) return
        if (activeTab === 'history') loadTradeHistory()
        if (activeTab === 'performance') {
            loadMetrics()
            loadSnapshots()
        }
    }, [activeTab, portfolio, loadTradeHistory, loadMetrics, loadSnapshots])

    // ─── Fetch price for selected ticker ───
    const fetchTickerPrice = useCallback(async (ticker: string) => {
        try {
            setPriceLoading(true)
            const data = await fetchPrices({ ticker, timeframe: '1d', limit: 1 })
            const price = getLatestPrice(data.data)
            setCurrentPrice(price)

            // Also update the portfolio's live prices
            if (price > 0) {
                updateLivePrices({ [ticker]: price })
            }
        } catch {
            // Silently fail
        } finally {
            setPriceLoading(false)
        }
    }, [updateLivePrices])

    // ─── Auto-refresh price ───
    useEffect(() => {
        if (priceIntervalRef.current) clearInterval(priceIntervalRef.current)

        if (selectedTicker) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchTickerPrice(selectedTicker)
            priceIntervalRef.current = setInterval(() => fetchTickerPrice(selectedTicker), 30_000) // 30s refresh
        }

        return () => {
            if (priceIntervalRef.current) clearInterval(priceIntervalRef.current)
        }
    }, [selectedTicker, fetchTickerPrice])

    // ─── Update all position prices periodically ───
    useEffect(() => {
        if (!portfolio || Object.keys(portfolio.positions).length === 0) return

        const updatePositionPrices = async () => {
            const tickers = Object.keys(portfolio.positions)
            const prices: Record<string, number> = {}

            await Promise.allSettled(
                tickers.map(async (ticker) => {
                    try {
                        const data = await fetchPrices({ ticker, timeframe: '1d', limit: 1 })
                        const price = getLatestPrice(data.data)
                        if (price > 0) prices[ticker] = price
                    } catch {
                        // Skip
                    }
                })
            )

            if (Object.keys(prices).length > 0) {
                updateLivePrices(prices)
            }
        }

        updatePositionPrices()
        const interval = setInterval(updatePositionPrices, 60_000) // 1 min refresh
        return () => clearInterval(interval)
    }, [portfolio?.positions ? Object.keys(portfolio.positions).join(',') : '', updateLivePrices])

    // ─── Auto-clear messages ───
    useEffect(() => {
        if (lastMessage) {
            const t = setTimeout(clearMessage, 5000)
            return () => clearTimeout(t)
        }
    }, [lastMessage, clearMessage])

    useEffect(() => {
        if (lastError) {
            const t = setTimeout(clearError, 7000)
            return () => clearTimeout(t)
        }
    }, [lastError, clearError])

    // ─── Handlers ───
    const handleSubmitOrder = useCallback(
        (req: CreateOrderRequest, price: number) => {
            submitOrder(req, price)
        },
        [submitOrder]
    )

    const handleSell = useCallback(
        (ticker: string) => {
            const pos = portfolio?.positions[ticker]
            if (pos) {
                setSelectedTicker(ticker, pos.tickerName)
            }
        },
        [portfolio, setSelectedTicker]
    )

    const handleReset = useCallback(() => {
        resetPortfolio()
        setResetDialogOpen(false)
    }, [resetPortfolio])

    // ─── Error State ───
    if (portfolioError) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
                    <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle size={24} className="text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">Failed to load portfolio</h3>
                        <p className="text-xs text-muted-foreground">{portfolioError}</p>
                    </div>
                    <button
                        onClick={() => user && initialize(user.id, user.name || user.email)}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Tekrar Dene
                    </button>
                </div>
            </div>
        )
    }

    // ─── Loading State ───
    if (portfolioLoading || !portfolio) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading portfolio...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-0 min-h-full">
            {/* ─── Main Content (Left) ─── */}
            <div className="flex-1 min-w-0 p-4 lg:p-6 space-y-5 overflow-y-auto">
                {/* Toast Messages */}
                {lastMessage && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 size={16} />
                        {lastMessage}
                    </div>
                )}
                {lastError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        {lastError}
                    </div>
                )}

                {/* Portfolio Summary */}
                <PortfolioSummaryCard
                    portfolio={portfolio}
                    onReset={() => setResetDialogOpen(true)}
                />

                {/* Time Machine Link */}
                <Link href="/paper-trade/time-machine" className="block">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 hover:border-violet-500/40 transition-all group cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <Sparkles size={16} className="text-violet-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-foreground">Historical Simulation</p>
                                <p className="text-[10px] text-muted-foreground">What if you had bought in the past?</p>
                            </div>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                </Link>

                {/* Leaderboard Link */}
                <Link href="/paper-trade/leaderboard" className="block">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all group cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                <Trophy size={16} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-foreground">Liderlik Tablosu</p>
                                <p className="text-[10px] text-muted-foreground">View community rankings</p>
                            </div>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                </Link>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-xl overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                                activeTab === tab.id
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'positions' && (
                    <div className="space-y-5">
                        <PositionsTable
                            portfolio={portfolio}
                            onSellClick={handleSell}
                            onTickerClick={(ticker) => setSelectedTicker(ticker, portfolio.positions[ticker]?.tickerName || ticker)}
                        />
                        <OrderBookWidget orders={openOrders} onCancelOrder={cancelOrder} />
                    </div>
                )}

                {activeTab === 'orders' && (
                    <OrderBookWidget orders={openOrders} onCancelOrder={cancelOrder} />
                )}

                {activeTab === 'history' && (
                    <TradeHistoryTable
                        trades={trades}
                        loading={tradesLoading}
                        hasMore={tradesPagination.hasMore}
                        onLoadMore={() => loadTradeHistory(tradesPagination.page + 1)}
                    />
                )}

                {activeTab === 'performance' && (
                    <div className="space-y-5">
                        {metrics && <PerformanceMetrics metrics={metrics} />}
                        <AssetAllocationChart portfolio={portfolio} />
                        <PortfolioChart snapshots={snapshots} initialBalance={portfolio.initialBalance} />
                    </div>
                )}
            </div>

            {/* ─── Order Entry Panel (Right, Sticky) ─── */}
            <div className="w-full lg:w-[340px] lg:min-w-[340px] border-t lg:border-t-0 lg:border-l border-border flex-shrink-0">
                <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
                    <OrderEntryPanel
                        portfolio={portfolio}
                        selectedTicker={selectedTicker}
                        selectedTickerName={selectedTickerName}
                        currentPrice={currentPrice}
                        onSubmitOrder={handleSubmitOrder}
                        onTickerChange={(ticker, name) => setSelectedTicker(ticker, name)}
                    />
                </div>
            </div>

            {/* Reset Dialog */}
            <ResetPortfolioDialog
                open={resetDialogOpen}
                resetCount={(portfolio.resetCount || 0) + 1}
                onConfirm={handleReset}
                onCancel={() => setResetDialogOpen(false)}
            />
        </div>
    )
}
