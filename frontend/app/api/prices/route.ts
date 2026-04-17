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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await fetch(url, {
            cache: 'no-store',
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timeoutId)
    }
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

            if (cached) {
                return {
                    ...cached.data,
                    meta: buildMeta({
                        ...cached.data.meta,
                        stale: true,
                        source: 'stale-cache',
                        snapshotAgeMs: cached.ageMs,
                        message: 'Baglanti yavas. Son basarili fiyat serisi gosteriliyor.',
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
                    message: 'Fiyat verisi gecici olarak alinamiyor.',
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
