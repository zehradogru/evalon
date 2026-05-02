'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSimulatorStore } from '@/store/use-simulator-store'
import { fetchPrices } from '@/services/price.service'
import { BIST_POPULAR, BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import {
    getPortfolioValue,
    getTotalPnL,
    getTotalPnLPercent,
    getProgressPercent,
} from '@/types/simulator'
import type { PriceBar } from '@/types'
import { SimulatorChart } from './simulator-chart'
import { SimulatorOrderPanel } from './simulator-order-panel'
import { cn } from '@/lib/utils'
import {
    CalendarDays,
    SkipForward,
    FastForward,
    ChevronLast,
    TrendingUp,
    TrendingDown,
    Wallet,
    BarChart3,
    Loader2,
    Search,
    X,
} from 'lucide-react'

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTR(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

export function SimulatorGamePanel() {
    const store = useSimulatorStore()
    const {
        config,
        currentDate,
        currentDayIndex,
        totalDays,
        balance,
        positions,
        priceCache,
        selectedTicker,
        selectedTickerName,
        chartTicker,
        status,
        advanceDay,
        endSimulation,
        cachePriceData,
        setSelectedTicker,
        setChartTicker,
        updatePositionPrices,
    } = store

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const portfolioValue = getPortfolioValue(store)
    const totalPnL = getTotalPnL(store)
    const totalPnLPct = getTotalPnLPercent(store)
    const progress = getProgressPercent(store)
    const isPositive = totalPnL >= 0

    // ─── Load initial data for popular tickers ───
    useEffect(() => {
        if (Object.keys(priceCache).length > 0) {
            setInitialLoading(false)
            return
        }

        let active = true
        async function loadInitialData() {
            const tickersToLoad = BIST_POPULAR.slice(0, 8)
            await Promise.allSettled(
                tickersToLoad.map(async (ticker) => {
                    try {
                        const data = await fetchPrices({
                            ticker,
                            timeframe: '1d',
                            limit: 200000,
                            start: config.startDate,
                        })
                        if (active && data.data.length > 0) {
                            // Filter bars up to endDate
                            const endTime = new Date(config.endDate).getTime()
                            const filtered = data.data.filter(
                                (b) => new Date(b.t).getTime() <= endTime + 86400000
                            )
                            cachePriceData(ticker, filtered)
                        }
                    } catch {
                        // skip
                    }
                })
            )
            if (active) {
                setInitialLoading(false)
                updatePositionPrices()
            }
        }

        loadInitialData()
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─── Load ticker data when selected ───
    const loadTickerData = useCallback(
        async (ticker: string) => {
            if (priceCache[ticker]) return // Already cached
            setLoading(true)
            try {
                const data = await fetchPrices({
                    ticker,
                    timeframe: '1d',
                    limit: 200000,
                    start: config.startDate,
                })
                if (data.data.length > 0) {
                    const endTime = new Date(config.endDate).getTime()
                    const filtered = data.data.filter(
                        (b) => new Date(b.t).getTime() <= endTime + 86400000
                    )
                    cachePriceData(ticker, filtered)
                }
            } catch {
                // skip
            } finally {
                setLoading(false)
            }
        },
        [priceCache, config, cachePriceData]
    )

    // ─── Get current price for selected ticker ───
    const currentPrice = useMemo(() => {
        if (!chartTicker || !priceCache[chartTicker]) return 0
        const bars = priceCache[chartTicker]
        const target = new Date(currentDate).getTime()
        let best: PriceBar | null = null
        for (const bar of bars) {
            if (new Date(bar.t).getTime() <= target) best = bar
            else break
        }
        return best ? best.c : 0
    }, [chartTicker, priceCache, currentDate])

    // ─── Visible chart data (only up to currentDate) ───
    const visibleChartData = useMemo(() => {
        if (!chartTicker || !priceCache[chartTicker]) return []
        const target = new Date(currentDate).getTime()
        return priceCache[chartTicker].filter((b) => new Date(b.t).getTime() <= target)
    }, [chartTicker, priceCache, currentDate])

    // ─── Search ───
    const SEARCH_INDEX = useMemo(
        () =>
            BIST_AVAILABLE.map((t) => ({
                ticker: t,
                name: TICKER_NAMES[t] || t,
                search: `${t.toLowerCase()} ${(TICKER_NAMES[t] || '').toLowerCase()}`,
            })),
        []
    )

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return SEARCH_INDEX.slice(0, 8)
        const q = searchQuery.toLowerCase()
        return SEARCH_INDEX.filter((i) => i.search.includes(q)).slice(0, 8)
    }, [searchQuery, SEARCH_INDEX])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleSelectTicker = async (ticker: string, name: string) => {
        setSelectedTicker(ticker, name)
        setChartTicker(ticker)
        setSearchOpen(false)
        setSearchQuery('')
        await loadTickerData(ticker)
    }

    // ─── Advance handlers ───
    const handleAdvance = (days: number) => {
        if (status !== 'playing') return
        advanceDay(days)
    }

    // ─── Loading State ───
    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="animate-spin text-cyan-400" />
                    <p className="text-sm text-muted-foreground">Piyasa verileri yükleniyor...</p>
                    <p className="text-[10px] text-muted-foreground/50">
                        {config.startDate} → {config.endDate}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
            {/* ═══ Top Bar ═══ */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                {/* Date + Portfolio Value Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <CalendarDays size={18} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Simülasyon Tarihi</p>
                            <p className="text-sm font-bold text-foreground">
                                {formatDateTR(currentDate)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Portföy Değeri</p>
                            <p className="text-lg font-bold text-foreground">
                                ₺{formatCurrency(portfolioValue)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Kâr / Zarar</p>
                            <div className="flex items-center gap-1">
                                {isPositive ? (
                                    <TrendingUp size={14} className="text-emerald-400" />
                                ) : (
                                    <TrendingDown size={14} className="text-red-400" />
                                )}
                                <span
                                    className={cn(
                                        'text-sm font-bold',
                                        isPositive ? 'text-emerald-400' : 'text-red-400'
                                    )}
                                >
                                    {isPositive ? '+' : ''}
                                    {totalPnLPct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Nakit</p>
                            <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                                <Wallet size={12} className="text-muted-foreground" />₺
                                {formatCurrency(balance)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress + Controls Row */}
                <div className="flex items-center gap-3">
                    {/* Progress bar */}
                    <div className="flex-1">
                        <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Gün {currentDayIndex + 1} / {totalDays} ({progress.toFixed(0)}%)
                        </p>
                    </div>

                    {/* Time controls */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => handleAdvance(1)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
                        >
                            <SkipForward size={14} />
                            +1 Gün
                        </button>
                        <button
                            onClick={() => handleAdvance(5)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +5 Gün
                        </button>
                        <button
                            onClick={() => handleAdvance(20)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +1 Ay
                        </button>
                        <button
                            onClick={endSimulation}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-colors"
                        >
                            <ChevronLast size={14} />
                            Bitir
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Main Content ═══ */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Left: Chart + Positions */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Ticker Selector */}
                    <div ref={searchRef} className="relative">
                        <div
                            className="flex items-center gap-2 bg-card/60 border border-border rounded-xl px-3 py-2.5 cursor-pointer hover:bg-card/80 transition-colors"
                            onClick={() => {
                                setSearchOpen(!searchOpen)
                                setTimeout(() => inputRef.current?.focus(), 50)
                            }}
                        >
                            <Search size={14} className="text-muted-foreground" />
                            {chartTicker ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="font-bold text-sm text-foreground">
                                        {chartTicker}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {selectedTickerName}
                                    </span>
                                    {currentPrice > 0 && (
                                        <span className="ml-auto text-xs font-semibold text-foreground">
                                            ₺{formatCurrency(currentPrice)}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    Grafik görmek için hisse seç...
                                </span>
                            )}
                            {loading && <Loader2 size={14} className="animate-spin text-cyan-400" />}
                        </div>

                        {searchOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-2 border-b border-border flex items-center gap-2">
                                    <Search size={14} className="text-muted-foreground" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') setSearchOpen(false)
                                            if (e.key === 'Enter' && searchResults[0]) {
                                                handleSelectTicker(
                                                    searchResults[0].ticker,
                                                    searchResults[0].name
                                                )
                                            }
                                        }}
                                        placeholder="Hisse ara... (ör: THYAO)"
                                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                                    />
                                    <button onClick={() => setSearchOpen(false)}>
                                        <X size={14} className="text-muted-foreground" />
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {searchResults.map((item) => (
                                        <button
                                            key={item.ticker}
                                            onClick={() =>
                                                handleSelectTicker(item.ticker, item.name)
                                            }
                                            className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-bold text-foreground w-14 flex-shrink-0">
                                                    {item.ticker}
                                                </span>
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {item.name}
                                                </span>
                                            </div>
                                            {priceCache[item.ticker] && (
                                                <span className="text-[10px] text-emerald-400/60">
                                                    ✓ yüklü
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chart */}
                    <SimulatorChart data={visibleChartData} ticker={chartTicker} />

                    {/* Positions Table */}
                    {Object.keys(positions).length > 0 && (
                        <div className="rounded-xl border border-border bg-card/60 p-4">
                            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                                <BarChart3 size={14} className="text-cyan-400" />
                                Açık Pozisyonlar
                            </h3>
                            <div className="space-y-2">
                                {Object.values(positions).map((pos) => {
                                    const posValue = pos.shares * pos.currentPrice
                                    const posCost = pos.shares * pos.avgCost
                                    const posPnl = posValue - posCost
                                    const posPnlPct =
                                        posCost > 0 ? ((posValue - posCost) / posCost) * 100 : 0
                                    const isPosPositive = posPnl >= 0

                                    return (
                                        <div
                                            key={pos.ticker}
                                            onClick={() =>
                                                handleSelectTicker(pos.ticker, pos.tickerName)
                                            }
                                            className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <span className="font-bold text-sm text-foreground">
                                                        {pos.ticker}
                                                    </span>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {pos.shares} adet · Ort: ₺
                                                        {pos.avgCost.toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold text-foreground">
                                                    ₺{formatCurrency(posValue)}
                                                </p>
                                                <p
                                                    className={cn(
                                                        'text-[10px] font-medium',
                                                        isPosPositive
                                                            ? 'text-emerald-400'
                                                            : 'text-red-400'
                                                    )}
                                                >
                                                    {isPosPositive ? '+' : ''}
                                                    {posPnlPct.toFixed(2)}% (
                                                    {isPosPositive ? '+' : ''}₺
                                                    {formatCurrency(posPnl)})
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Order Panel */}
                <div className="w-full lg:w-[320px] lg:min-w-[320px] flex-shrink-0">
                    <SimulatorOrderPanel
                        ticker={selectedTicker}
                        tickerName={selectedTickerName}
                        currentPrice={currentPrice}
                        balance={balance}
                        position={selectedTicker ? positions[selectedTicker] || null : null}
                        onSelectTicker={() => {
                            setSearchOpen(true)
                            setTimeout(() => inputRef.current?.focus(), 50)
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
