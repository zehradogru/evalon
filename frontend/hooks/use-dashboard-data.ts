'use client'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BIST_100, TICKER_NAMES } from '@/config/markets'
import { useUserWatchlist } from '@/hooks/use-user-watchlist'
import type { MarketDataMeta, MarketListItem, PaginatedListResponse } from '@/types'
import { buildMarketQueryStatus, isRetriableMarketError } from '@/lib/market-data'

// ---------------------------------------------------------------------------
// localStorage cache helpers for market-snapshot
// ---------------------------------------------------------------------------
const MOVERS_CACHE_KEY = 'evalon_market_snapshot_v1'
const MOVERS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 // 1 hour

function loadMoversCache(): MarketMoversPayload | undefined {
    try {
        const raw =
            typeof window !== 'undefined'
                ? window.localStorage.getItem(MOVERS_CACHE_KEY)
                : null
        if (!raw) return undefined
        const parsed = JSON.parse(raw) as { data: MarketMoversPayload; ts: number }
        if (Date.now() - parsed.ts > MOVERS_CACHE_MAX_AGE_MS) return undefined
        return parsed.data
    } catch {
        return undefined
    }
}

function saveMoversCache(data: MarketMoversPayload): void {
    try {
        window.localStorage.setItem(
            MOVERS_CACHE_KEY,
            JSON.stringify({ data, ts: Date.now() }),
        )
    } catch {
        // ignore QuotaExceededError or SSR
    }
}

function loadMoversCacheTimestamp(): number | undefined {
    try {
        const raw =
            typeof window !== 'undefined'
                ? window.localStorage.getItem(MOVERS_CACHE_KEY)
                : null
        if (!raw) return undefined
        return (JSON.parse(raw) as { ts: number }).ts
    } catch {
        return undefined
    }
}

export interface DashboardTicker {
    ticker: string
    name: string
    price: number
    previousPrice: number
    change: number
    changePercent: number
    high: number | null
    low: number | null
    vol: number | null
}

interface BatchResponse {
    count: number
    cached: boolean
    stale: boolean
    failedTickers: string[]
    meta?: MarketDataMeta
    data: Array<{
        ticker: string
        current: { t: string; o: number; h: number; l: number; c: number; v: number } | null
        previous: { t: string; o: number; h: number; l: number; c: number; v: number } | null
        error?: string
    }>
}

type MarketSnapshotResponse = PaginatedListResponse<MarketListItem>

interface DashboardTickerPayload {
    items: DashboardTicker[]
    meta: MarketDataMeta
}

interface MarketMoversPayload {
    topGainers: DashboardTicker[]
    topLosers: DashboardTicker[]
    all: DashboardTicker[]
    meta: MarketDataMeta
}

/**
 * Pure function to check if BIST market is currently open.
 * BIST hours: Monday-Friday, 10:00-18:00 (Turkey Time, UTC+3)
 * Used by hooks and refetchInterval callbacks.
 */
export function isMarketCurrentlyOpen(): boolean {
    const now = new Date()
    const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
    const day = turkeyTime.getDay()
    const currentMinutes = turkeyTime.getHours() * 60 + turkeyTime.getMinutes()
    const isWeekday = day >= 1 && day <= 5
    const isDuringHours = currentMinutes >= 600 && currentMinutes < 1080 // 10:00-18:00
    return isWeekday && isDuringHours
}

async function fetchDashboardData(tickers: string[]): Promise<DashboardTickerPayload> {
    if (tickers.length === 0) {
        return {
            items: [],
            meta: {
                stale: false,
                warming: false,
                partial: false,
                hasUsableData: false,
                source: 'empty',
                snapshotAgeMs: null,
            },
        }
    }

    const tickersParam = tickers.join(',')
    const url = `/api/prices/batch?tickers=${tickersParam}&timeframe=1d&limit=2` // Optimized: only last 2 bars needed

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
    }

    const result: BatchResponse = await response.json()

    const byTicker = new Map(
        result.data.map((item) => [item.ticker, item] as const)
    )

    const items = tickers.map((ticker) => {
        const item = byTicker.get(ticker)
        const currentPrice = item?.current?.c ?? 0
        const previousPrice = item?.previous?.c ?? currentPrice
        const change = currentPrice - previousPrice
        const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0

        return {
            ticker,
            name: TICKER_NAMES[ticker] || ticker,
            price: currentPrice,
            previousPrice,
            change,
            changePercent,
            high: item?.current?.h ?? null,
            low: item?.current?.l ?? null,
            vol: item?.current?.v ?? null,
        }
    }).filter((item) => item.price > 0)

    return {
        items,
        meta: {
            stale: result.meta?.stale ?? result.stale ?? false,
            warming: result.meta?.warming ?? false,
            partial: result.meta?.partial ?? result.failedTickers.length > 0,
            hasUsableData:
                result.meta?.hasUsableData ?? items.length > 0,
            source:
                result.meta?.source ??
                (items.length > 0 ? 'live' : 'error'),
            snapshotAgeMs: result.meta?.snapshotAgeMs ?? null,
            failedTickers: result.meta?.failedTickers ?? result.failedTickers,
            message: result.meta?.message,
            emptyReason: result.meta?.emptyReason,
        },
    }
}

async function fetchMarketSnapshotData(): Promise<DashboardTickerPayload> {
    const params = new URLSearchParams({
        view: 'markets',
        limit: String(BIST_100.length),
        sortBy: 'changePct',
        sortDir: 'desc',
    })
    const response = await fetch(`/api/markets/list?${params.toString()}`)
    if (!response.ok) {
        throw new Error('Failed to fetch market snapshot')
    }

    const payload: MarketSnapshotResponse = await response.json()
    const rows = payload.items || []

    const items = rows
        .map((item) => {
            const price = item.price ?? 0
            const change = item.changeVal ?? 0
            const previousPrice = price - change
            const changePercent =
                item.changePct ??
                (previousPrice > 0 ? (change / previousPrice) * 100 : 0)

            return {
                ticker: item.ticker,
                name: item.name || TICKER_NAMES[item.ticker] || item.ticker,
                price,
                previousPrice,
                change,
                changePercent,
                high: item.high ?? null,
                low: item.low ?? null,
                vol: item.vol ?? null,
            }
        })
        .filter((item) => item.price > 0)

    return {
        items,
        meta: {
            stale: payload.meta?.stale ?? payload.stale ?? false,
            warming: payload.meta?.warming ?? payload.warming ?? false,
            partial: payload.meta?.partial ?? rows.some((item) => item.price === null),
            hasUsableData: payload.meta?.hasUsableData ?? items.length > 0,
            source:
                payload.meta?.source ??
                (items.length > 0 ? 'live' : 'empty'),
            snapshotAgeMs:
                payload.meta?.snapshotAgeMs ?? payload.snapshotAgeMs ?? null,
            failedTickers: payload.meta?.failedTickers,
            message: payload.meta?.message,
            emptyReason: payload.meta?.emptyReason,
        },
    }
}

/**
 * Hook for watchlist data (user's watched tickers)
 * Uses batch endpoint to prevent rate limiting
 */
export function useDashboardWatchlist() {
    const { data: userWatchlist, isLoading: isWatchlistLoading } = useUserWatchlist()
    const watchlistTickers = userWatchlist?.tickers ?? []

    const query = useQuery({
        queryKey: ['dashboard-watchlist', watchlistTickers.join(',')],
        queryFn: () => fetchDashboardData(watchlistTickers),
        enabled: watchlistTickers.length > 0,
        staleTime: 1000 * 30, // 30 seconds
        placeholderData: keepPreviousData,
        retry: (failureCount, error) =>
            isRetriableMarketError(error) && failureCount < 2,
        refetchInterval: (query) => {
            if (query.state.data?.meta?.warming) return 8_000 // keep retrying while warming
            return isMarketCurrentlyOpen() ? 1000 * 60 : false
        },
    })

    const marketStatus = buildMarketQueryStatus({
        meta: query.data?.meta,
        hasUsableData: (query.data?.items?.length ?? 0) > 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
    })

    return {
        ...query,
        data: query.data?.items ?? [],
        isLoading: isWatchlistLoading || query.isLoading,
        marketStatus,
        ...marketStatus,
        retryNow: query.refetch,
    }
}

/**
 * Hook for market movers (top gainers & losers)
 * Fetches all available tickers and sorts by change
 */
export function useMarketMovers() {
    const query = useQuery({
        queryKey: ['market-snapshot'],
        queryFn: async (): Promise<MarketMoversPayload> => {
            const response = await fetchMarketSnapshotData()
            const data = response.items

            // Sort by changePercent
            const sorted = [...data].sort((a, b) => b.changePercent - a.changePercent)

            return {
                topGainers: sorted.slice(0, 5),
                topLosers: sorted.slice(-5).reverse(),
                all: sorted,
                meta: {
                    ...response.meta,
                    hasUsableData: sorted.length > 0,
                    source:
                        response.meta.source === 'empty' && sorted.length > 0
                            ? 'live'
                            : response.meta.source,
                },
            }
        },
        staleTime: 1000 * 60, // 1 minute
        // Show cached data immediately while re-fetching in background
        initialData: loadMoversCache,
        initialDataUpdatedAt: loadMoversCacheTimestamp,
        placeholderData: keepPreviousData,
        retry: (failureCount, error) =>
            isRetriableMarketError(error) && failureCount < 2,
        refetchInterval: (query) => {
            if (query.state.data?.meta?.warming) return 8_000 // keep retrying while warming
            return isMarketCurrentlyOpen() ? 1000 * 60 * 2 : false
        },
    })

    // Persist fresh data to localStorage for instant display on next visit
    useEffect(() => {
        if (query.data) saveMoversCache(query.data)
    }, [query.data])

    const marketStatus = buildMarketQueryStatus({
        meta: query.data?.meta,
        hasUsableData: (query.data?.all?.length ?? 0) > 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
    })

    return {
        ...query,
        marketStatus,
        ...marketStatus,
        retryNow: query.refetch,
    }
}

/**
 * Hook to manually refresh all dashboard data
 */
export function useDashboardRefresh() {
    const queryClient = useQueryClient()

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['dashboard-watchlist'] }),
            queryClient.invalidateQueries({ queryKey: ['market-snapshot'] }),
            queryClient.invalidateQueries({ queryKey: ['prices'] }),
            queryClient.invalidateQueries({ queryKey: ['backend-health'] }),
        ])
    }

    return { refresh }
}

/**
 * Check if BIST market is open
 * BIST hours: Monday-Friday, 10:00-18:00 (Turkey Time, UTC+3)
 */
export function useMarketStatus() {
    return useQuery({
        queryKey: ['market-status'],
        queryFn: () => {
            const now = new Date()
            const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))

            const day = turkeyTime.getDay()
            const hours = turkeyTime.getHours()
            const minutes = turkeyTime.getMinutes()
            const currentMinutes = hours * 60 + minutes

            const marketOpen = 10 * 60 // 10:00
            const marketClose = 18 * 60 // 18:00

            const isWeekday = day >= 1 && day <= 5
            const isDuringHours = currentMinutes >= marketOpen && currentMinutes < marketClose

            const isOpen = isWeekday && isDuringHours

            // Calculate time until next state change
            let nextChangeMinutes: number
            let nextChangeLabel: string

            if (!isWeekday) {
                // Weekend - calculate until Monday 10:00
                const daysUntilMonday = day === 0 ? 1 : 8 - day
                nextChangeMinutes = daysUntilMonday * 24 * 60 - currentMinutes + marketOpen
                nextChangeLabel = 'Opens Monday'
            } else if (currentMinutes < marketOpen) {
                // Before market open
                nextChangeMinutes = marketOpen - currentMinutes
                nextChangeLabel = 'Opens in'
            } else if (currentMinutes < marketClose) {
                // Market is open
                nextChangeMinutes = marketClose - currentMinutes
                nextChangeLabel = 'Closes in'
            } else {
                // After market close
                if (day === 5) {
                    // Friday after close
                    nextChangeMinutes = (3 * 24 * 60) - currentMinutes + marketOpen
                    nextChangeLabel = 'Opens Monday'
                } else {
                    // Other weekday after close
                    nextChangeMinutes = (24 * 60) - currentMinutes + marketOpen
                    nextChangeLabel = 'Opens tomorrow'
                }
            }

            const hours_remaining = Math.floor(nextChangeMinutes / 60)
            const mins_remaining = nextChangeMinutes % 60

            return {
                isOpen,
                nextChangeLabel,
                timeRemaining: `${hours_remaining}h ${mins_remaining}m`,
                currentTime: turkeyTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Update every minute
    })
}

export function useBackendHealth() {
    return useQuery({
        queryKey: ['backend-health'],
        queryFn: async () => {
            const response = await fetch('/api/health', {
                cache: 'no-store',
            })

            if (!response.ok) {
                throw new Error('Backend health request failed')
            }

            const payload = (await response.json()) as { status?: string }
            return {
                isHealthy: payload.status === 'ok',
                status: payload.status || 'unknown',
            }
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    })
}
