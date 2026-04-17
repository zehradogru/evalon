import { NextRequest, NextResponse } from 'next/server'
import { getRecentFetchParams } from '@/lib/evalon'
import { buildEvalonUrl } from '@/lib/server/evalon-proxy'
import type { MarketDataMeta, PriceBar, PriceResponse } from '@/types'

interface PriceApiResponse extends PriceResponse {
    meta: MarketDataMeta
}

interface CacheEntry {
    data: PriceApiResponse
    timestamp: number
}

const cache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<PriceApiResponse>>()
const CACHE_TTL = 60 * 1000
const CACHE_STALE_TTL = 15 * 60 * 1000
const BENCHMARK_YAHOO_SYMBOLS: Record<string, string> = {
    XU100: 'XU100.IS',
    XU030: 'XU030.IS',
}

async function readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return response.json()
    }
    return { detail: await response.text() }
}

function getCached(
    key: string
): { data: PriceApiResponse; isStale: boolean; ageMs: number } | null {
    const entry = cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age < CACHE_TTL) {
        return { data: entry.data, isStale: false, ageMs: age }
    }
    if (age < CACHE_STALE_TTL) {
        return { data: entry.data, isStale: true, ageMs: age }
    }

    cache.delete(key)
    return null
}

function setCache(key: string, data: PriceApiResponse) {
    cache.set(key, {
        data,
        timestamp: Date.now(),
    })
}

function buildMeta(
    overrides: Partial<MarketDataMeta> = {}
): MarketDataMeta {
    return {
        stale: false,
        warming: false,
        partial: false,
        hasUsableData: false,
        source: 'empty',
        snapshotAgeMs: null,
        ...overrides,
    }
}

function buildEmptyResponse(
    ticker: string,
    timeframe: string,
    meta: MarketDataMeta
): PriceApiResponse {
    return {
        ticker,
        timeframe,
        rows: 0,
        data: [],
        meta,
    }
}

function getDetailMessage(payload: unknown): string | undefined {
    if (
        payload &&
        typeof payload === 'object' &&
        'detail' in payload &&
        typeof payload.detail === 'string'
    ) {
        return payload.detail
    }

    if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
    ) {
        return payload.error
    }

    return undefined
}

async function fetchWithTimeout(
    url: string,
    timeoutMs: number,
    init?: RequestInit
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await fetch(url, {
            ...(init || {}),
            cache: 'no-store',
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timeoutId)
    }
}

function isYahooBenchmarkTicker(ticker: string): boolean {
    return Boolean(BENCHMARK_YAHOO_SYMBOLS[ticker.toUpperCase()])
}

function mapYahooIntervalAndRange(timeframe: string): {
    interval: string
    range: string
} {
    switch (timeframe) {
        case '1m':
            return { interval: '1m', range: '5d' }
        case '5m':
            return { interval: '5m', range: '1mo' }
        case '15m':
            return { interval: '15m', range: '1mo' }
        case '30m':
            return { interval: '30m', range: '1mo' }
        case '1h':
            return { interval: '1h', range: '3mo' }
        case '1w':
            return { interval: '1wk', range: '2y' }
        case '1M':
        case '1mo':
            return { interval: '1mo', range: '10y' }
        case '1d':
        case '1g':
        default:
            return { interval: '1d', range: '1y' }
    }
}

function parseYahooChartToPriceBars(payload: unknown): PriceBar[] {
    if (!payload || typeof payload !== 'object') return []

    const chart = (payload as {
        chart?: {
            result?: Array<{
                timestamp?: number[]
                indicators?: {
                    quote?: Array<{
                        open?: Array<number | null>
                        high?: Array<number | null>
                        low?: Array<number | null>
                        close?: Array<number | null>
                        volume?: Array<number | null>
                    }>
                }
            }>
        }
    }).chart

    const result = chart?.result?.[0]
    const timestamps = result?.timestamp || []
    const quote = result?.indicators?.quote?.[0]
    if (!quote || timestamps.length === 0) return []

    const opens = quote.open || []
    const highs = quote.high || []
    const lows = quote.low || []
    const closes = quote.close || []
    const volumes = quote.volume || []

    const bars: PriceBar[] = []
    for (let i = 0; i < timestamps.length; i += 1) {
        const o = opens[i]
        const h = highs[i]
        const l = lows[i]
        const c = closes[i]
        if (
            typeof o !== 'number' ||
            typeof h !== 'number' ||
            typeof l !== 'number' ||
            typeof c !== 'number'
        ) {
            continue
        }

        bars.push({
            t: new Date(timestamps[i] * 1000).toISOString(),
            o,
            h,
            l,
            c,
            v: typeof volumes[i] === 'number' ? Math.max(0, Math.round(volumes[i] || 0)) : 0,
        })
    }

    bars.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
    return bars
}

async function fetchYahooBenchmarkBars(
    ticker: string,
    timeframe: string,
    limit: number
): Promise<PriceBar[]> {
    const symbol = BENCHMARK_YAHOO_SYMBOLS[ticker.toUpperCase()]
    if (!symbol) return []

    const { interval, range } = mapYahooIntervalAndRange(timeframe)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`

    const response = await fetchWithTimeout(url, 12_000, {
        headers: {
            Accept: 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
    })

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Yahoo benchmark rate limited (429)')
        }
        throw new Error(`Yahoo benchmark request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bars = parseYahooChartToPriceBars(payload)
    return bars.length > limit ? bars.slice(-limit) : bars
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')
    const requestedLimit = parseInt(searchParams.get('limit') || '100', 10)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!ticker || !timeframe) {
        return NextResponse.json(
            { error: 'Missing required parameters: ticker, timeframe' },
            { status: 400 }
        )
    }

    const cacheKey = `${ticker}:${timeframe}:${requestedLimit}:${start || ''}:${end || ''}`
    const cached = getCached(cacheKey)
    if (cached && !cached.isStale) {
        return NextResponse.json(
            {
                ...cached.data,
                meta: buildMeta({
                    ...cached.data.meta,
                    stale: false,
                    source: 'cache',
                    snapshotAgeMs: cached.ageMs,
                }),
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            }
        )
    }

    const existingRequest = inFlightRequests.get(cacheKey)
    if (existingRequest) {
        const sharedResponse = await existingRequest
        return NextResponse.json(sharedResponse, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        })
    }

    const params = start
        ? { start, fetchLimit: Math.max(requestedLimit, requestedLimit + 10) }
        : getRecentFetchParams(timeframe, requestedLimit)

    const fetchPromise: Promise<PriceApiResponse> = (async () => {
        try {
            if (isYahooBenchmarkTicker(ticker)) {
                const bars = await fetchYahooBenchmarkBars(
                    ticker,
                    timeframe,
                    requestedLimit
                )

                const benchmarkResult: PriceApiResponse = {
                    ticker,
                    timeframe,
                    rows: bars.length,
                    data: bars,
                    meta: buildMeta({
                        hasUsableData: bars.length > 0,
                        source: 'live',
                        emptyReason: bars.length > 0 ? undefined : 'no-data',
                        message:
                            bars.length > 0
                                ? undefined
                                : 'Bu benchmark icin fiyat verisi bulunamadi.',
                    }),
                }

                if (benchmarkResult.meta.hasUsableData) {
                    setCache(cacheKey, benchmarkResult)
                }

                return benchmarkResult
            }

            const response = await fetchWithTimeout(
                buildEvalonUrl('/v1/prices', {
                    ticker,
                    timeframe,
                    limit: params.fetchLimit,
                    start: params.start,
                    end,
                }),
                15_000
            )

            if (!response.ok) {
                const payload = await readPayload(response)
                const message =
                    getDetailMessage(payload) ||
                    'Fiyat verisi gecici olarak alinamiyor.'

                if (cached) {
                    return {
                        ...cached.data,
                        meta: buildMeta({
                            ...cached.data.meta,
                            stale: true,
                            source: 'stale-cache',
                            snapshotAgeMs: cached.ageMs,
                            message: 'Son basarili fiyat serisi gosteriliyor.',
                        }),
                    }
                }

                return buildEmptyResponse(
                    ticker,
                    timeframe,
                    buildMeta({
                        source: 'error',
                        hasUsableData: false,
                        emptyReason:
                            response.status === 400
                                ? 'unsupported-timeframe'
                                : 'unavailable',
                        message,
                    })
                )
            }

            const payload = (await response.json()) as {
                data?: PriceBar[]
                rows?: number
            }

            const data: PriceBar[] = Array.isArray(payload.data) ? payload.data : []
            data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
            const sliced = data.length > requestedLimit ? data.slice(-requestedLimit) : data

            const result: PriceApiResponse = {
                ticker,
                timeframe,
                rows: sliced.length,
                data: sliced,
                meta: buildMeta({
                    hasUsableData: sliced.length > 0,
                    source: 'live',
                    emptyReason: sliced.length > 0 ? undefined : 'no-data',
                    message:
                        sliced.length > 0
                            ? undefined
                            : 'Bu zaman araligi icin fiyat verisi bulunamadi.',
                }),
            }

            if (result.meta.hasUsableData) {
                setCache(cacheKey, result)
            }

            return result
        } catch (error) {
            console.error('Prices proxy error:', error)

            const errorMessage =
                error instanceof Error ? error.message : 'Fiyat verisi gecici olarak alinamiyor.'
            const isRateLimited = /rate limited|429/i.test(errorMessage)

            if (cached) {
                return {
                    ...cached.data,
                    meta: buildMeta({
                        ...cached.data.meta,
                        stale: true,
                        source: 'stale-cache',
                        snapshotAgeMs: cached.ageMs,
                        message: isRateLimited
                            ? 'Yahoo limitine takildi. Son basarili fiyat serisi gosteriliyor.'
                            : 'Baglanti yavas. Son basarili fiyat serisi gosteriliyor.',
                    }),
                }
            }

            return buildEmptyResponse(
                ticker,
                timeframe,
                buildMeta({
                    source: 'error',
                    hasUsableData: false,
                    emptyReason: 'unavailable',
                    message: isRateLimited
                        ? 'Yahoo gecici olarak limit uyguluyor (429).'
                        : 'Fiyat verisi gecici olarak alinamiyor.',
                })
            )
        }
    })()

    inFlightRequests.set(cacheKey, fetchPromise)
    try {
        const result = await fetchPromise
        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        })
    } finally {
        inFlightRequests.delete(cacheKey)
    }
}
