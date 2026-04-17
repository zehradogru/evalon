import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_EVALON_API_URL } from '@/lib/evalon'
import { PriceBar } from '@/types'

const EVALON_API_URL =
    process.env.NEXT_PUBLIC_EVALON_API_URL || DEFAULT_EVALON_API_URL

interface TickerResult {
    ticker: string
    current: PriceBar | null
    previous: PriceBar | null
    error?: string
}

interface BatchResponsePayload {
    count: number
    successCount: number
    failedCount: number
    data: TickerResult[]
    failedTickers: string[]
}

interface BatchApiResponse extends BatchResponsePayload {
    cached: boolean
    stale: boolean
}

interface CacheEntry {
    data: BatchResponsePayload
    timestamp: number
}

const cache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<BatchApiResponse>>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_STALE_TTL = 30 * 60 * 1000 // 30 minutes

function getCached(key: string): { data: BatchResponsePayload; isStale: boolean } | null {
    const entry = cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age < CACHE_TTL) {
        return { data: entry.data, isStale: false }
    }
    if (age < CACHE_STALE_TTL) {
        return { data: entry.data, isStale: true }
    }
    cache.delete(key)
    return null
}

function setCache(key: string, data: BatchResponsePayload): void {
    cache.set(key, { data, timestamp: Date.now() })
}

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        return response
    } catch (e) {
        clearTimeout(timeoutId)
        throw e
    }
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const tickersParam = searchParams.get('tickers')
    const timeframe = searchParams.get('timeframe') || '1d'
    const limit = searchParams.get('limit') || '2' // Optimized: only fetch last 2 bars for current + previous
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!tickersParam) {
        return NextResponse.json(
            { error: 'Missing required parameter: tickers (comma-separated)' },
            { status: 400 }
        )
    }

    const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean)
    
    if (tickers.length === 0) {
        return NextResponse.json(
            { error: 'No valid tickers provided' },
            { status: 400 }
        )
    }

    if (tickers.length > 150) {
        return NextResponse.json(
            { error: 'Too many tickers (max 150)' },
            { status: 400 }
        )
    }

    const CACHE_ENABLED = true
    const sortedTickers = [...tickers].sort()
    const cacheKey = `batch:${timeframe}:${limit}:${sortedTickers.join(',')}`

    if (forceRefresh) {
        cache.delete(cacheKey)
    }

    const cached = CACHE_ENABLED ? getCached(cacheKey) : null
    if (cached && !cached.isStale) {
        return NextResponse.json({ ...cached.data, cached: true, stale: false })
    }

    const inFlightKey = forceRefresh ? `${cacheKey}:refresh` : cacheKey
    const existingRequest = inFlightRequests.get(inFlightKey)
    if (existingRequest) {
        const sharedResponse = await existingRequest
        return NextResponse.json(sharedResponse)
    }

    const fetchBatchPromise: Promise<BatchApiResponse> = (async () => {
        const now = new Date()
        const parsedLimit = Number.parseInt(limit, 10)
        const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 2
        const fetchLimit = Math.max(10, safeLimit)
        const daysBack = 14

        const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
        const start = startDate.toISOString().split('T')[0]

        async function fetchTicker(ticker: string, retries = 2): Promise<TickerResult> {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const url = `${EVALON_API_URL}/v1/prices?ticker=${ticker}&timeframe=${timeframe}&limit=${fetchLimit}&start=${start}`
                    const response = await fetchWithTimeout(url, 15000)

                    if (!response.ok) {
                        if (attempt < retries) {
                            await delay(500 * (attempt + 1))
                            continue
                        }
                        return { ticker, current: null, previous: null, error: response.statusText }
                    }

                    const data: { data?: PriceBar[] } = await response.json()
                    const bars: PriceBar[] = Array.isArray(data.data) ? data.data : []
                    bars.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())

                    const current = bars.length > 0 ? bars[bars.length - 1] : null
                    const previous = bars.length > 1 ? bars[bars.length - 2] : null

                    return { ticker, current, previous }
                } catch (error) {
                    if (attempt < retries) {
                        await delay(500 * (attempt + 1))
                        continue
                    }
                    return { ticker, current: null, previous: null, error: String(error) }
                }
            }
            return { ticker, current: null, previous: null, error: 'Max retries exceeded' }
        }

        const BATCH_SIZE = 10
        const BATCH_DELAY = 200
        const allResults: TickerResult[] = []

        for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
            const batch = tickers.slice(i, i + BATCH_SIZE)
            const batchResults = await Promise.allSettled(
                batch.map((ticker) => fetchTicker(ticker))
            )

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allResults.push(result.value)
                } else {
                    allResults.push({
                        ticker: batch[index],
                        current: null,
                        previous: null,
                        error: 'Failed',
                    })
                }
            })

            if (i + BATCH_SIZE < tickers.length) {
                await delay(BATCH_DELAY)
            }
        }

        const successful = allResults.filter((result) => result.current !== null)
        const failed = allResults.filter((result) => result.current === null)
        const mergedData: TickerResult[] = [...successful]

        if (cached && failed.length > 0) {
            const cachedDataMap = new Map<string, TickerResult>(
                cached.data.data.map((item) => [item.ticker, item] as const)
            )
            failed.forEach((failedItem) => {
                const cachedItem = cachedDataMap.get(failedItem.ticker)
                if (cachedItem && cachedItem.current) {
                    mergedData.push(cachedItem)
                }
            })
        }

        const response: BatchResponsePayload = {
            count: allResults.length,
            successCount: mergedData.length,
            failedCount: tickers.length - mergedData.length,
            data: mergedData,
            failedTickers: failed
                .filter((failedItem) => !mergedData.find((item) => item.ticker === failedItem.ticker))
                .map((item) => item.ticker),
        }

        const successRate = mergedData.length / tickers.length
        if (CACHE_ENABLED && successRate >= 0.7) {
            setCache(cacheKey, response)
            return { ...response, cached: false, stale: false }
        }

        if (CACHE_ENABLED && cached && cached.data.successCount > mergedData.length) {
            return { ...cached.data, cached: true, stale: true }
        }

        if (CACHE_ENABLED) {
            setCache(cacheKey, response)
        }

        return { ...response, cached: false, stale: false }
    })()

    inFlightRequests.set(inFlightKey, fetchBatchPromise)
    try {
        const response = await fetchBatchPromise
        return NextResponse.json(response)
    } finally {
        inFlightRequests.delete(inFlightKey)
    }
}
