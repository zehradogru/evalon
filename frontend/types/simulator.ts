// ═══════════════════════════════════════════════════════════════
// Trading Simulator — Type Definitions
// ═══════════════════════════════════════════════════════════════

import type { PriceBar } from '@/types'

export type SimulatorStatus = 'idle' | 'setup' | 'playing' | 'finished'

export interface SimPosition {
    ticker: string
    tickerName: string
    shares: number
    avgCost: number
    currentPrice: number
}

export interface SimTrade {
    id: string
    ticker: string
    tickerName: string
    side: 'buy' | 'sell'
    shares: number
    price: number
    date: string
    total: number
}

export interface SimSnapshot {
    date: string
    value: number
}

export interface SimulatorConfig {
    startDate: string
    endDate: string
    initialBalance: number
}

export interface SimulatorState {
    // Status
    status: SimulatorStatus

    // Config
    config: SimulatorConfig

    // Game state
    currentDate: string
    currentDayIndex: number
    totalDays: number
    balance: number
    positions: Record<string, SimPosition>
    tradeHistory: SimTrade[]

    // Performance tracking
    portfolioSnapshots: SimSnapshot[]
    peakValue: number

    // Data cache — all price data for the simulation range, keyed by ticker
    priceCache: Record<string, PriceBar[]>

    // UI
    selectedTicker: string | null
    selectedTickerName: string
    chartTicker: string | null
}

export interface SimulatorActions {
    // Lifecycle
    startSimulation: (config: SimulatorConfig) => void
    advanceDay: (days: number) => void
    endSimulation: () => void
    resetSimulation: () => void

    // Trading
    buyStock: (ticker: string, tickerName: string, shares: number, price: number) => void
    sellStock: (ticker: string, shares: number, price: number) => void

    // Data
    cachePriceData: (ticker: string, bars: PriceBar[]) => void
    updatePositionPrices: () => void

    // UI
    setSelectedTicker: (ticker: string, name: string) => void
    setChartTicker: (ticker: string) => void
}

export type SimulatorStore = SimulatorState & SimulatorActions

// ─── Computed Helpers ───
export function getPortfolioValue(state: SimulatorState): number {
    const positionsValue = Object.values(state.positions).reduce(
        (sum, pos) => sum + pos.shares * pos.currentPrice,
        0
    )
    return state.balance + positionsValue
}

export function getPositionsValue(state: SimulatorState): number {
    return Object.values(state.positions).reduce(
        (sum, pos) => sum + pos.shares * pos.currentPrice,
        0
    )
}

export function getTotalPnL(state: SimulatorState): number {
    return getPortfolioValue(state) - state.config.initialBalance
}

export function getTotalPnLPercent(state: SimulatorState): number {
    const initial = state.config.initialBalance
    if (initial <= 0) return 0
    return ((getPortfolioValue(state) - initial) / initial) * 100
}

export function getProgressPercent(state: SimulatorState): number {
    if (state.totalDays <= 0) return 0
    return Math.min(100, (state.currentDayIndex / state.totalDays) * 100)
}
