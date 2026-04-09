import { PriceResponse, PriceBar, Timeframe, FetchPricesParams } from '@/types'
import { TICKER_NAMES } from '@/config/markets'

export type { Timeframe }

// Re-export from central config for backward compatibility
export { TICKER_NAMES }

/**
 * Calculate start date and fetch limit to get recent data
 * The API returns data FROM the start date, so we fetch extra data to ensure we get the most recent
 */
function getRecentFetchParams(timeframe: Timeframe, requestedLimit: number): { start: string; fetchLimit: number } {
    const now = new Date()
    let daysBack: number
    let fetchLimit: number

    // Always fetch more than requested to ensure we get the most recent data
    switch (timeframe) {
        case '1m':
            daysBack = 3 // 3 days (covers weekends)
            fetchLimit = Math.max(1500, requestedLimit) // ~3 trading days × 480 bars
            break
        case '5m':
            daysBack = 7 // 1 week
            fetchLimit = Math.max(500, requestedLimit) // ~5 trading days × 96 bars
            break
        case '1h':
            daysBack = 14 // 2 weeks
            fetchLimit = Math.max(200, requestedLimit) // At least 200 bars
            break
        case '1d':
            daysBack = Math.max(30, requestedLimit + 14) // At least 30 days or limit + 2 weeks buffer
            fetchLimit = Math.max(50, requestedLimit + 10) // Extra buffer for gaps
            break
        case '1w':
            daysBack = Math.max(180, requestedLimit * 7 + 30) // ~6 months or more
            fetchLimit = Math.max(30, requestedLimit + 5)
            break
        case '1M':
            daysBack = Math.max(365, requestedLimit * 30 + 60) // ~1 year or more
            fetchLimit = Math.max(20, requestedLimit + 3)
            break
        default:
            daysBack = 30
            fetchLimit = requestedLimit
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return { 
        start: startDate.toISOString().split('T')[0],
        fetchLimit
    }
}

/**
 * Fetch price data for a single ticker
 * Uses local API proxy to avoid CORS issues
 */
export async function fetchPrices({
    ticker,
    timeframe,
    limit = 100,
    start,
}: FetchPricesParams): Promise<PriceResponse> {
    // Calculate optimal params if start not provided
    const params = start 
        ? { start, fetchLimit: limit }
        : getRecentFetchParams(timeframe, limit)
    
    const url = `/api/prices?ticker=${ticker}&timeframe=${timeframe}&limit=${params.fetchLimit}&start=${params.start}`

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Failed to fetch prices for ${ticker}: ${response.statusText}`)
    }

    const data: PriceResponse = await response.json()
    
    // Sort by time and take the last 'limit' bars to ensure we return most recent data
    if (data.data && data.data.length > 0) {
        data.data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
        // Only trim if we fetched more than requested
        if (data.data.length > limit) {
            data.data = data.data.slice(-limit)
        }
    }
    
    return data
}

/**
 * Fetch price data for multiple tickers in parallel
 */
export async function fetchMultipleTickers(
    tickers: string[],
    timeframe: Timeframe,
    limit: number = 24
): Promise<Map<string, PriceBar[]>> {
    const results = await Promise.allSettled(
        tickers.map((ticker) => fetchPrices({ ticker, timeframe, limit }))
    )

    const priceMap = new Map<string, PriceBar[]>()

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            priceMap.set(tickers[index], result.value.data)
        } else {
            console.error(`Failed to fetch ${tickers[index]}:`, result.reason)
            priceMap.set(tickers[index], [])
        }
    })

    return priceMap
}

/**
 * Calculate price change from price history
 */
export function calculateChange(data: PriceBar[]): { change: number; changePercent: number } {
    if (data.length < 2) {
        return { change: 0, changePercent: 0 }
    }

    const firstPrice = data[0].c
    const lastPrice = data[data.length - 1].c
    const change = lastPrice - firstPrice
    const changePercent = (change / firstPrice) * 100

    return { change, changePercent }
}

/**
 * Get latest price from price history
 */
export function getLatestPrice(data: PriceBar[]): number {
    if (data.length === 0) return 0
    return data[data.length - 1].c
}
