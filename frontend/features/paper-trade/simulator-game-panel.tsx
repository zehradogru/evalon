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

const MAX_PRICE_FETCH_LIMIT = 200_000

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTimeTR(dateStr: string): string {
    return new Date(dateStr).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getTimeMs(value: string): number {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
}

function getSimulationFetchLimit(startAt: string, endAt: string): number {
    const spanMinutes = Math.max(0, Math.ceil((getTimeMs(endAt) - getTimeMs(startAt)) / 60_000))
    return Math.min(MAX_PRICE_FETCH_LIMIT, Math.max(10_000, spanMinutes + 1_440))
}

function normalizeSimulationBars(bars: PriceBar[], startAt: string, endAt: string): PriceBar[] {
    const startMs = getTimeMs(startAt)
    const endMs = getTimeMs(endAt)
    const deduped = new Map<number, PriceBar>()

    for (const bar of bars) {
        const barMs = getTimeMs(bar.t)
        if (barMs < startMs || barMs > endMs) continue
        deduped.set(barMs, bar)
    }

    return Array.from(deduped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, bar]) => bar)
}

function findBarForTime(bars: PriceBar[], targetTime: string): PriceBar | null {
    const targetMs = getTimeMs(targetTime)
    let best: PriceBar | null = null

    for (const bar of bars) {
        const barMs = getTimeMs(bar.t)
        if (barMs <= targetMs) {
            best = bar
            continue
        }
        break
    }

    return best
}

export function SimulatorGamePanel() {
    const store = useSimulatorStore()
    const {
        config,
        currentTime,
        currentStepIndex,
        totalSteps,
        balance,
        positions,
        priceCache,
        selectedTicker,
        selectedTickerName,
        chartTicker,
        status,
        advanceTime,
        endSimulation,
        cachePriceData,
        setSelectedTicker,
        setChartTicker,
        updatePositionPrices,
    } = store

    const [loadingTicker, setLoadingTicker] = useState<string | null>(null)
    const [initialLoading, setInitialLoading] = useState(() => Object.keys(priceCache).length === 0)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const portfolioValue = getPortfolioValue(store)
    const totalPnL = getTotalPnL(store)
    const totalPnLPct = getTotalPnLPercent(store)
    const progress = getProgressPercent(store)
    const isPositive = totalPnL >= 0
    const fetchLimit = useMemo(
        () => getSimulationFetchLimit(config.startAt, config.endAt),
        [config.endAt, config.startAt]
    )

    useEffect(() => {
        if (Object.keys(priceCache).length > 0) {
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
                            timeframe: '1m',
                            limit: fetchLimit,
                            start: config.startAt,
                            end: config.endAt,
                        })
                        if (active) {
                            cachePriceData(
                                ticker,
                                normalizeSimulationBars(data.data, config.startAt, config.endAt)
                            )
                        }
                    } catch {
                        // ignore unavailable preload tickers
                    }
                })
            )

            if (active) {
                setInitialLoading(false)
                updatePositionPrices()
            }
        }

        void loadInitialData()
        return () => {
            active = false
        }
    }, [cachePriceData, config.endAt, config.startAt, fetchLimit, priceCache, updatePositionPrices])

    const loadTickerData = useCallback(
        async (ticker: string) => {
            if (priceCache[ticker]) return

            setLoadingTicker(ticker)
            try {
                const data = await fetchPrices({
                    ticker,
                    timeframe: '1m',
                    limit: fetchLimit,
                    start: config.startAt,
                    end: config.endAt,
                })
                cachePriceData(
                    ticker,
                    normalizeSimulationBars(data.data, config.startAt, config.endAt)
                )
            } catch {
                cachePriceData(ticker, [])
            } finally {
                setLoadingTicker((current) => (current === ticker ? null : current))
            }
        },
        [cachePriceData, config.endAt, config.startAt, fetchLimit, priceCache]
    )

    const currentPrice = useMemo(() => {
        if (!chartTicker || !priceCache[chartTicker]) return 0
        const bar = findBarForTime(priceCache[chartTicker], currentTime)
        return bar ? bar.c : 0
    }, [chartTicker, currentTime, priceCache])

    const visibleChartData = useMemo(() => {
        if (!chartTicker || !priceCache[chartTicker]) return []
        const targetMs = getTimeMs(currentTime)
        return priceCache[chartTicker].filter((bar) => getTimeMs(bar.t) <= targetMs)
    }, [chartTicker, currentTime, priceCache])

    const isChartLoading = Boolean(
        chartTicker && loadingTicker === chartTicker && !priceCache[chartTicker]
    )

    const SEARCH_INDEX = useMemo(
        () =>
            BIST_AVAILABLE.map((ticker) => ({
                ticker,
                name: TICKER_NAMES[ticker] || ticker,
                search: `${ticker.toLowerCase()} ${(TICKER_NAMES[ticker] || '').toLowerCase()}`,
            })),
        []
    )

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return SEARCH_INDEX.slice(0, 8)
        const query = searchQuery.toLowerCase()
        return SEARCH_INDEX.filter((item) => item.search.includes(query)).slice(0, 8)
    }, [SEARCH_INDEX, searchQuery])

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
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

    const handleAdvance = (minutes: number) => {
        if (status !== 'playing') return
        advanceTime(minutes)
    }

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="animate-spin text-cyan-400" />
                    <p className="text-sm text-muted-foreground">1 dakikalik piyasa verileri yukleniyor...</p>
                    <p className="text-[10px] text-muted-foreground/50">
                        {config.startAt}{' -> '}{config.endAt}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <CalendarDays size={18} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Simulasyon Zamani</p>
                            <p className="text-sm font-bold text-foreground">
                                {formatDateTimeTR(currentTime)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Portfoy Degeri</p>
                            <p className="text-lg font-bold text-foreground">
                                ₺{formatCurrency(portfolioValue)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Kar / Zarar</p>
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
                                <Wallet size={12} className="text-muted-foreground" />
                                ₺{formatCurrency(balance)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="flex-1">
                        <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Adim {Math.min(currentStepIndex + 1, Math.max(totalSteps, 1))} / {Math.max(totalSteps, 1)} ({progress.toFixed(0)}%)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            onClick={() => handleAdvance(1)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
                        >
                            <SkipForward size={14} />
                            +1 Dk
                        </button>
                        <button
                            onClick={() => handleAdvance(5)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-colors"
                        >
                            <SkipForward size={14} />
                            +5 Dk
                        </button>
                        <button
                            onClick={() => handleAdvance(30)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +30 Dk
                        </button>
                        <button
                            onClick={() => handleAdvance(180)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +3 Saat
                        </button>
                        <button
                            onClick={() => handleAdvance(24 * 60)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +1 Gun
                        </button>
                        <button
                            onClick={() => handleAdvance(7 * 24 * 60)}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 text-xs font-semibold transition-colors"
                        >
                            <FastForward size={14} />
                            +1 Hafta
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

            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 min-w-0 space-y-4">
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
                                    Grafik gormek icin hisse sec...
                                </span>
                            )}
                            {isChartLoading && <Loader2 size={14} className="animate-spin text-cyan-400" />}
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
                                                void handleSelectTicker(
                                                    searchResults[0].ticker,
                                                    searchResults[0].name
                                                )
                                            }
                                        }}
                                        placeholder="Hisse ara... (or: THYAO)"
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
                                            onClick={() => void handleSelectTicker(item.ticker, item.name)}
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
                                                    yuklu
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <SimulatorChart
                        data={visibleChartData}
                        ticker={chartTicker}
                        currentTime={currentTime}
                        isLoading={isChartLoading}
                    />

                    {Object.keys(positions).length > 0 && (
                        <div className="rounded-xl border border-border bg-card/60 p-4">
                            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                                <BarChart3 size={14} className="text-cyan-400" />
                                Acik Pozisyonlar
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
                                            onClick={() => void handleSelectTicker(pos.ticker, pos.tickerName)}
                                            className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-colors"
                                        >
                                            <div>
                                                <span className="font-bold text-sm text-foreground">
                                                    {pos.ticker}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {pos.shares} adet · Ort: ₺{pos.avgCost.toFixed(2)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold text-foreground">
                                                    ₺{formatCurrency(posValue)}
                                                </p>
                                                <p
                                                    className={cn(
                                                        'text-[10px] font-medium',
                                                        isPosPositive ? 'text-emerald-400' : 'text-red-400'
                                                    )}
                                                >
                                                    {isPosPositive ? '+' : ''}
                                                    {posPnlPct.toFixed(2)}% ({isPosPositive ? '+' : ''}₺
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
