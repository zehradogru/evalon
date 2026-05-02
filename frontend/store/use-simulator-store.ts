// ═══════════════════════════════════════════════════════════════
// Trading Simulator — Zustand Store (localStorage persisted)
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PriceBar } from '@/types'
import type {
    SimulatorStore,
    SimulatorState,
    SimulatorConfig,
    SimPosition,
    SimTrade,
} from '@/types/simulator'

// ─── Helpers ───

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Find the bar whose date is <= targetDate. Returns the closest match. */
function findBarForDate(bars: PriceBar[], targetDate: string): PriceBar | null {
    if (!bars || bars.length === 0) return null
    const target = new Date(targetDate).getTime()
    let best: PriceBar | null = null
    for (const bar of bars) {
        const barTime = new Date(bar.t).getTime()
        if (barTime <= target) {
            best = bar
        } else {
            break // bars are sorted ascending
        }
    }
    return best
}

/** Get unique trading dates from cached price data */
function getTradingDates(priceCache: Record<string, PriceBar[]>): string[] {
    const dateSet = new Set<string>()
    for (const bars of Object.values(priceCache)) {
        for (const bar of bars) {
            dateSet.add(new Date(bar.t).toISOString().slice(0, 10))
        }
    }
    return Array.from(dateSet).sort()
}

/** Advance to the next N trading days from the cached data */
function advanceTradingDays(
    tradingDates: string[],
    currentDate: string,
    days: number
): { newDate: string; newIndex: number } {
    const currentIdx = tradingDates.findIndex((d) => d >= currentDate)
    if (currentIdx === -1) {
        return { newDate: tradingDates[tradingDates.length - 1], newIndex: tradingDates.length - 1 }
    }
    const targetIdx = Math.min(currentIdx + days, tradingDates.length - 1)
    return { newDate: tradingDates[targetIdx], newIndex: targetIdx }
}

// ─── Initial State ───

const INITIAL_STATE: SimulatorState = {
    status: 'idle',
    config: { startDate: '', endDate: '', initialBalance: 100_000 },
    currentDate: '',
    currentDayIndex: 0,
    totalDays: 0,
    balance: 100_000,
    positions: {},
    tradeHistory: [],
    portfolioSnapshots: [],
    peakValue: 100_000,
    priceCache: {},
    selectedTicker: null,
    selectedTickerName: '',
    chartTicker: null,
}

// ─── Store ───

export const useSimulatorStore = create<SimulatorStore>()(
    persist(
        (set, get) => ({
            ...INITIAL_STATE,

            // ─── Lifecycle ───

            startSimulation: (config: SimulatorConfig) => {
                set({
                    status: 'playing',
                    config,
                    currentDate: config.startDate,
                    currentDayIndex: 0,
                    totalDays: 0, // will be set when price data is cached
                    balance: config.initialBalance,
                    positions: {},
                    tradeHistory: [],
                    portfolioSnapshots: [
                        { date: config.startDate, value: config.initialBalance },
                    ],
                    peakValue: config.initialBalance,
                    priceCache: {},
                    selectedTicker: null,
                    selectedTickerName: '',
                    chartTicker: null,
                })
            },

            advanceDay: (days: number) => {
                const state = get()
                if (state.status !== 'playing') return

                const tradingDates = getTradingDates(state.priceCache)
                if (tradingDates.length === 0) return

                const { newDate, newIndex } = advanceTradingDays(
                    tradingDates,
                    state.currentDate,
                    days
                )

                // Update position prices
                const updatedPositions: Record<string, SimPosition> = {}
                for (const [ticker, pos] of Object.entries(state.positions)) {
                    const bar = findBarForDate(state.priceCache[ticker] || [], newDate)
                    updatedPositions[ticker] = {
                        ...pos,
                        currentPrice: bar ? bar.c : pos.currentPrice,
                    }
                }

                // Calculate portfolio value
                const positionsValue = Object.values(updatedPositions).reduce(
                    (sum, pos) => sum + pos.shares * pos.currentPrice,
                    0
                )
                const totalValue = state.balance + positionsValue
                const newPeak = Math.max(state.peakValue, totalValue)

                // Check if finished
                const isFinished = newDate >= state.config.endDate || newIndex >= tradingDates.length - 1

                set({
                    currentDate: newDate,
                    currentDayIndex: newIndex,
                    positions: updatedPositions,
                    portfolioSnapshots: [
                        ...state.portfolioSnapshots,
                        { date: newDate, value: totalValue },
                    ],
                    peakValue: newPeak,
                    status: isFinished ? 'finished' : 'playing',
                })
            },

            endSimulation: () => {
                set({ status: 'finished' })
            },

            resetSimulation: () => {
                set({ ...INITIAL_STATE, status: 'setup' })
            },

            // ─── Trading ───

            buyStock: (ticker: string, tickerName: string, shares: number, price: number) => {
                const state = get()
                const total = shares * price

                if (total > state.balance) return
                if (shares <= 0) return

                const existing = state.positions[ticker]
                let newPos: SimPosition

                if (existing) {
                    const totalShares = existing.shares + shares
                    const totalCost = existing.shares * existing.avgCost + total
                    newPos = {
                        ...existing,
                        shares: totalShares,
                        avgCost: totalCost / totalShares,
                        currentPrice: price,
                    }
                } else {
                    newPos = {
                        ticker,
                        tickerName,
                        shares,
                        avgCost: price,
                        currentPrice: price,
                    }
                }

                const trade: SimTrade = {
                    id: generateId(),
                    ticker,
                    tickerName,
                    side: 'buy',
                    shares,
                    price,
                    date: state.currentDate,
                    total,
                }

                set({
                    balance: state.balance - total,
                    positions: { ...state.positions, [ticker]: newPos },
                    tradeHistory: [...state.tradeHistory, trade],
                })
            },

            sellStock: (ticker: string, shares: number, price: number) => {
                const state = get()
                const existing = state.positions[ticker]
                if (!existing || shares <= 0 || shares > existing.shares) return

                const total = shares * price
                const remainingShares = existing.shares - shares

                const updatedPositions = { ...state.positions }
                if (remainingShares <= 0) {
                    delete updatedPositions[ticker]
                } else {
                    updatedPositions[ticker] = {
                        ...existing,
                        shares: remainingShares,
                        currentPrice: price,
                    }
                }

                const trade: SimTrade = {
                    id: generateId(),
                    ticker,
                    tickerName: existing.tickerName,
                    side: 'sell',
                    shares,
                    price,
                    date: state.currentDate,
                    total,
                }

                set({
                    balance: state.balance + total,
                    positions: updatedPositions,
                    tradeHistory: [...state.tradeHistory, trade],
                })
            },

            // ─── Data ───

            cachePriceData: (ticker: string, bars: PriceBar[]) => {
                const state = get()
                const newCache = { ...state.priceCache, [ticker]: bars }
                const tradingDates = getTradingDates(newCache)

                set({
                    priceCache: newCache,
                    totalDays: tradingDates.length,
                })
            },

            updatePositionPrices: () => {
                const state = get()
                const updatedPositions: Record<string, SimPosition> = {}
                for (const [ticker, pos] of Object.entries(state.positions)) {
                    const bar = findBarForDate(state.priceCache[ticker] || [], state.currentDate)
                    updatedPositions[ticker] = {
                        ...pos,
                        currentPrice: bar ? bar.c : pos.currentPrice,
                    }
                }
                set({ positions: updatedPositions })
            },

            // ─── UI ───

            setSelectedTicker: (ticker: string, name: string) => {
                set({ selectedTicker: ticker, selectedTickerName: name })
            },

            setChartTicker: (ticker: string) => {
                set({ chartTicker: ticker })
            },
        }),
        {
            name: 'evalon-simulator',
            partialize: (state) => ({
                status: state.status,
                config: state.config,
                currentDate: state.currentDate,
                currentDayIndex: state.currentDayIndex,
                totalDays: state.totalDays,
                balance: state.balance,
                positions: state.positions,
                tradeHistory: state.tradeHistory,
                portfolioSnapshots: state.portfolioSnapshots,
                peakValue: state.peakValue,
                // priceCache is NOT persisted (too large) — will be re-fetched on load
            }),
        }
    )
)
