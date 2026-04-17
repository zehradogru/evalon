import { TICKER_NAMES } from '@/config/markets'
import { getRecentFetchParams } from '@/lib/evalon'
import { FetchPricesParams, PriceBar, PriceResponse, Timeframe } from '@/types'

export type { Timeframe }
export { TICKER_NAMES }

export async function fetchPrices({
    ticker,
    timeframe,
    limit = 100,
    start,
}: FetchPricesParams): Promise<PriceResponse> {
    const params = start
        ? { start, fetchLimit: limit }
        : getRecentFetchParams(timeframe, limit)

    const url = `/api/prices?ticker=${ticker}&timeframe=${timeframe}&limit=${params.fetchLimit}&start=${params.start}`
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Failed to fetch prices for ${ticker}: ${response.statusText}`)
    }

    const data: PriceResponse = await response.json()

    if (data.data && data.data.length > 0) {
        data.data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
        if (data.data.length > limit) {
            data.data = data.data.slice(-limit)
        }
        data.rows = data.data.length
    }

    return data
}

export async function fetchMultipleTickers(
    tickers: string[],
    timeframe: Timeframe,
    limit = 24
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

export function calculateChange(data: PriceBar[]): {
    change: number
    changePercent: number
} {
    if (data.length < 2) {
        return { change: 0, changePercent: 0 }
    }

    const firstPrice = data[0].c
    const lastPrice = data[data.length - 1].c
    const change = lastPrice - firstPrice
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0

    return { change, changePercent }
}

export function getLatestPrice(data: PriceBar[]): number {
    if (data.length === 0) return 0
    return data[data.length - 1].c
}
