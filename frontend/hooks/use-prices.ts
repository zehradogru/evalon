'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
    fetchPrices,
    fetchMultipleTickers,
    calculateChange,
    getLatestPrice,
    TICKER_NAMES,
    Timeframe,
} from '@/services/price.service'
import { WatchlistItem } from '@/types'
import { isMarketCurrentlyOpen } from '@/hooks/use-dashboard-data'
import { useUserWatchlist } from '@/hooks/use-user-watchlist'
import { buildMarketQueryStatus, isRetriableMarketError } from '@/lib/market-data'

/**
 * Hook to fetch price data for a single ticker
 */
export function usePrices(ticker: string, timeframe: Timeframe, limit: number = 100) {
    const query = useQuery({
        queryKey: ['prices', ticker, timeframe, limit],
        queryFn: () => fetchPrices({ ticker, timeframe, limit }),
        staleTime: 1000 * 60, // 1 minute
        placeholderData: keepPreviousData,
        retry: (failureCount, error) =>
            isRetriableMarketError(error) && failureCount < 2,
        retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 4000),
        refetchInterval: () => isMarketCurrentlyOpen() ? 1000 * 60 * 5 : false, // 5 min when open, stop when closed
    })

    const marketStatus = buildMarketQueryStatus({
        meta: query.data?.meta,
        hasUsableData: (query.data?.data?.length ?? 0) > 0,
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
 * Hook to fetch portfolio chart data
 * Timeframe mapping:
 * - 1D: 1h timeframe, 24 bars
 * - 1W: 1h timeframe, 168 bars
 * - 1M: 1d timeframe, 30 bars
 */
export function usePortfolioChart(period: '1D' | '1W' | '1M' = '1D') {
    const config = {
        '1D': { timeframe: '5m' as Timeframe, limit: 100 },  // ~8 saat = tek iÅŸlem gÃ¼nÃ¼
        '1W': { timeframe: '1h' as Timeframe, limit: 40 },   // 5 gÃ¼n Ã— 8 saat = gerÃ§ek 1 hafta
        '1M': { timeframe: '1d' as Timeframe, limit: 30 },
    }

    const { timeframe, limit } = config[period]

    // Using THYAO as representative ticker for portfolio chart (demo)
    return useQuery({
        queryKey: ['portfolio-chart', period],
        queryFn: () => fetchPrices({ ticker: 'THYAO', timeframe, limit }),
        staleTime: 1000 * 60, // 1 minute
        placeholderData: keepPreviousData,
    })
}

/**
 * Hook to fetch watchlist data with mini charts
 * Uses 5m timeframe for more up-to-date prices
 */
export function useWatchlist() {
    const { data: userWatchlist, isLoading: isWatchlistLoading } = useUserWatchlist()
    const tickers = userWatchlist?.tickers ?? []

    const watchlistQuery = useQuery({
        queryKey: ['watchlist', tickers.join(',')],
        queryFn: async (): Promise<WatchlistItem[]> => {
            if (tickers.length === 0) {
                return []
            }

            // Use 5m timeframe with enough bars for a full trading day (~100 bars)
            const priceMap = await fetchMultipleTickers(tickers, '5m', 100)

            return tickers.map((ticker) => {
                const priceHistory = priceMap.get(ticker) || []
                const { change, changePercent } = calculateChange(priceHistory)
                const price = getLatestPrice(priceHistory)

                return {
                    ticker,
                    name: TICKER_NAMES[ticker] || ticker,
                    price,
                    change,
                    changePercent,
                    priceHistory,
                }
            }).filter((item) => item.price > 0 || item.priceHistory.length > 0)
        },
        enabled: tickers.length > 0,
        staleTime: 1000 * 30, // 30 seconds for more frequent updates
        placeholderData: keepPreviousData,
        retry: (failureCount, error) =>
            isRetriableMarketError(error) && failureCount < 2,
        refetchInterval: () => isMarketCurrentlyOpen() ? 1000 * 60 : false, // 1 min when open, stop when closed
    })

    const marketStatus = buildMarketQueryStatus({
        hasUsableData: (watchlistQuery.data?.length ?? 0) > 0,
        isLoading: watchlistQuery.isLoading,
        isFetching: watchlistQuery.isFetching,
        error: watchlistQuery.error,
    })

    return {
        ...watchlistQuery,
        data: watchlistQuery.data ?? [],
        isLoading: isWatchlistLoading || watchlistQuery.isLoading,
        marketStatus,
        ...marketStatus,
        retryNow: watchlistQuery.refetch,
    }
}



