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

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function findBarForTime(bars: PriceBar[], targetTime: string): PriceBar | null {
    if (!bars.length) return null

    const targetMs = new Date(targetTime).getTime()
    let best: PriceBar | null = null

    for (const bar of bars) {
        const barMs = new Date(bar.t).getTime()
        if (barMs <= targetMs) {
            best = bar
            continue
        }
        break
    }

    return best
}

function getTimeMs(value: string): number {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
}

function formatLocalDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getSimulationStepCount(startAt: string, endAt: string): number {
    const startMs = getTimeMs(startAt)
    const endMs = getTimeMs(endAt)
    if (endMs <= startMs) return 0
    return Math.floor((endMs - startMs) / 60_000)
}

function getSimulationStepIndex(startAt: string, currentTime: string, endAt: string): number {
    const startMs = getTimeMs(startAt)
    const currentMs = getTimeMs(currentTime)
    const totalSteps = getSimulationStepCount(startAt, endAt)

    if (currentMs <= startMs) return 0
    return Math.min(totalSteps, Math.floor((currentMs - startMs) / 60_000))
}

function advanceSimulationClock(
    currentTime: string,
    endAt: string,
    minutes: number
): { newTime: string; isFinished: boolean } {
    const currentMs = getTimeMs(currentTime)
    const endMs = getTimeMs(endAt)

    if (endMs <= currentMs) {
        return { newTime: currentTime, isFinished: true }
    }

    const nextMs = Math.min(endMs, currentMs + minutes * 60_000)
    return {
        newTime: formatLocalDateTime(new Date(nextMs)),
        isFinished: nextMs >= endMs,
    }
}

const INITIAL_STATE: SimulatorState = {
    status: 'idle',
    config: { startAt: '', endAt: '', initialBalance: 100_000 },
    currentTime: '',
    currentStepIndex: 0,
    totalSteps: 0,
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

export const useSimulatorStore = create<SimulatorStore>()(
    persist(
        (set, get) => ({
            ...INITIAL_STATE,

            startSimulation: (config: SimulatorConfig) => {
                set({
                    status: 'playing',
                    config,
                    currentTime: config.startAt,
                    currentStepIndex: 0,
                    totalSteps: getSimulationStepCount(config.startAt, config.endAt),
                    balance: config.initialBalance,
                    positions: {},
                    tradeHistory: [],
                    portfolioSnapshots: [{ date: config.startAt, value: config.initialBalance }],
                    peakValue: config.initialBalance,
                    priceCache: {},
                    selectedTicker: null,
                    selectedTickerName: '',
                    chartTicker: null,
                })
            },

            advanceTime: (minutes: number) => {
                const state = get()
                if (state.status !== 'playing') return

                const { newTime, isFinished } = advanceSimulationClock(
                    state.currentTime,
                    state.config.endAt,
                    minutes
                )

                const updatedPositions: Record<string, SimPosition> = {}
                for (const [ticker, pos] of Object.entries(state.positions)) {
                    const bar = findBarForTime(state.priceCache[ticker] || [], newTime)
                    updatedPositions[ticker] = {
                        ...pos,
                        currentPrice: bar ? bar.c : pos.currentPrice,
                    }
                }

                const positionsValue = Object.values(updatedPositions).reduce(
                    (sum, pos) => sum + pos.shares * pos.currentPrice,
                    0
                )
                const totalValue = state.balance + positionsValue

                set({
                    currentTime: newTime,
                    currentStepIndex: getSimulationStepIndex(
                        state.config.startAt,
                        newTime,
                        state.config.endAt
                    ),
                    positions: updatedPositions,
                    portfolioSnapshots: [
                        ...state.portfolioSnapshots,
                        { date: newTime, value: totalValue },
                    ],
                    peakValue: Math.max(state.peakValue, totalValue),
                    status: isFinished ? 'finished' : 'playing',
                })
            },

            endSimulation: () => {
                set({ status: 'finished' })
            },

            resetSimulation: () => {
                set({ ...INITIAL_STATE, status: 'setup' })
            },

            buyStock: (ticker: string, tickerName: string, shares: number, price: number) => {
                const state = get()
                const total = shares * price

                if (total > state.balance || shares <= 0) return

                const existing = state.positions[ticker]
                const newPos: SimPosition = existing
                    ? {
                          ...existing,
                          shares: existing.shares + shares,
                          avgCost:
                              (existing.shares * existing.avgCost + total) /
                              (existing.shares + shares),
                          currentPrice: price,
                      }
                    : {
                          ticker,
                          tickerName,
                          shares,
                          avgCost: price,
                          currentPrice: price,
                      }

                const trade: SimTrade = {
                    id: generateId(),
                    ticker,
                    tickerName,
                    side: 'buy',
                    shares,
                    price,
                    date: state.currentTime,
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
                    date: state.currentTime,
                    total: shares * price,
                }

                set({
                    balance: state.balance + shares * price,
                    positions: updatedPositions,
                    tradeHistory: [...state.tradeHistory, trade],
                })
            },

            cachePriceData: (ticker: string, bars: PriceBar[]) => {
                set((state) => ({
                    priceCache: { ...state.priceCache, [ticker]: bars },
                }))
            },

            updatePositionPrices: () => {
                const state = get()
                const updatedPositions: Record<string, SimPosition> = {}

                for (const [ticker, pos] of Object.entries(state.positions)) {
                    const bar = findBarForTime(state.priceCache[ticker] || [], state.currentTime)
                    updatedPositions[ticker] = {
                        ...pos,
                        currentPrice: bar ? bar.c : pos.currentPrice,
                    }
                }

                set({ positions: updatedPositions })
            },

            setSelectedTicker: (ticker: string, name: string) => {
                set({ selectedTicker: ticker, selectedTickerName: name })
            },

            setChartTicker: (ticker: string) => {
                set({ chartTicker: ticker })
            },
        }),
        {
            name: 'evalon-simulator',
            version: 2,
            migrate: () => ({
                ...INITIAL_STATE,
                status: 'setup',
            }),
            partialize: (state) => ({
                status: state.status,
                config: state.config,
                currentTime: state.currentTime,
                currentStepIndex: state.currentStepIndex,
                totalSteps: state.totalSteps,
                balance: state.balance,
                positions: state.positions,
                tradeHistory: state.tradeHistory,
                portfolioSnapshots: state.portfolioSnapshots,
                peakValue: state.peakValue,
                priceCache: {},
                selectedTicker: null,
                selectedTickerName: '',
                chartTicker: null,
            }),
        }
    )
)
