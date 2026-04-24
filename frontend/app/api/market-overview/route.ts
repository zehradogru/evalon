import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import type { MarketOverviewCard } from '@/types'

type CardId = MarketOverviewCard['id']

interface CacheEntry {
    card: MarketOverviewCard
    timestamp: number
}

const CARD_ORDER: CardId[] = ['bist100', 'bist30', 'xauusd', 'usdtry']
const cache = new Map<CardId, CacheEntry>()
const CACHE_TTL = 60 * 1000
const CACHE_STALE_TTL = 15 * 60 * 1000

function setCardCache(card: MarketOverviewCard) {
    cache.set(card.id, {
        card,
        timestamp: Date.now(),
    })
}

function getCachedCard(
    id: CardId
): { card: MarketOverviewCard; stale: boolean } | null {
    const entry = cache.get(id)
    if (!entry) return null

    const ageMs = Date.now() - entry.timestamp
    if (ageMs < CACHE_TTL) {
        return { card: entry.card, stale: false }
    }

    if (ageMs < CACHE_STALE_TTL) {
        return {
            card: {
                ...entry.card,
                stale: true,
                source: `stale-cache:${entry.card.source}`,
                asOf: new Date().toISOString(),
            },
            stale: true,
        }
    }

    cache.delete(id)
    return null
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

function parseYahooSeries(payload: unknown): Array<{ t: string; close: number }> {
    if (!payload || typeof payload !== 'object') return []

    const result = (payload as {
        chart?: {
            result?: Array<{
                timestamp?: number[]
                indicators?: {
                    quote?: Array<{
                        close?: Array<number | null>
                    }>
                }
            }>
        }
    }).chart?.result?.[0]

    if (!result) return []

    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []

    const out: Array<{ t: string; close: number }> = []
    for (let i = 0; i < timestamps.length; i += 1) {
        const close = closes[i]
        if (typeof close !== 'number') continue

        out.push({
            t: new Date(timestamps[i] * 1000).toISOString(),
            close,
        })
    }

    out.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
    return out
}

// ─── Yahoo crumb/cookie cache ────────────────────────────────────────────────

let yahooCrumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
    const now = Date.now()
    if (yahooCrumbCache && yahooCrumbCache.expiresAt > now) {
        return { crumb: yahooCrumbCache.crumb, cookie: yahooCrumbCache.cookie }
    }
    const fcRes = await fetchWithTimeout('https://fc.yahoo.com', 10_000, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            Accept: 'text/html',
        },
        redirect: 'follow',
    })
    const rawCookies = fcRes.headers.get('set-cookie') || ''
    const cookieHeader = rawCookies
        .split(/,(?=[^;]+=[^;]+)/)
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ')
    const crumbRes = await fetchWithTimeout(
        'https://query1.finance.yahoo.com/v1/test/getcrumb',
        10_000,
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                Accept: 'text/plain',
                Cookie: cookieHeader,
            },
        }
    )
    if (!crumbRes.ok) throw new Error(`Yahoo crumb fetch failed: ${crumbRes.status}`)
    const crumb = await crumbRes.text()
    if (!crumb || crumb.length < 3) throw new Error('Empty crumb')
    yahooCrumbCache = { crumb, cookie: cookieHeader, expiresAt: now + 50 * 60 * 1000 }
    return { crumb, cookie: cookieHeader }
}

async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<unknown> {
    let crumb = ''
    let cookie = ''
    try {
        const auth = await getYahooCrumb()
        crumb = auth.crumb
        cookie = auth.cookie
    } catch { /* proceed without crumb */ }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}${crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''}`
    const response = await fetchWithTimeout(url, 12_000, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            ...(cookie ? { Cookie: cookie } : {}),
        },
    })
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) yahooCrumbCache = null
        throw new Error(`Yahoo request failed: ${response.status}`)
    }
    return response.json()
}

async function fetchYahooIndexCard(
    id: 'bist100' | 'bist30',
    label: string,
    symbol: 'XU100.IS' | 'XU030.IS'
): Promise<MarketOverviewCard> {
    const payload = await fetchYahooChart(symbol, '1d', '1mo')
    const response = { ok: true } // already checked in fetchYahooChart
    void response

    if (!payload) {
        throw new Error(`Yahoo request failed for ${symbol}`)
    }

    const series = parseYahooSeries(payload)
    const last = series[series.length - 1]
    const prev = series[series.length - 2] || last

    if (!last) {
        throw new Error('No Yahoo series data')
    }

    const changePct = prev && prev.close > 0
        ? ((last.close - prev.close) / prev.close) * 100
        : null

    return {
        id,
        label,
        value: last.close,
        changePct,
        currency: 'TRY',
        source: 'yahoo',
        asOf: last.t,
        stale: false,
    }
}

function parseTcmbUsdTry(xml: string): { value: number; asOf: string } | null {
    const currencyBlockMatch = xml.match(
        /<Currency\s+CrossOrder="0"\s+Kod="USD"\s+CurrencyCode="USD">([\s\S]*?)<\/Currency>/i
    )
    if (!currencyBlockMatch) return null

    const forexSellingMatch = currencyBlockMatch[1].match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)
    if (!forexSellingMatch) return null

    const raw = forexSellingMatch[1].trim().replace(',', '.')
    const value = Number(raw)
    if (!Number.isFinite(value)) return null

    const dateMatch = xml.match(/<Tarih_Date[^>]*Tarih="([^"]+)"/i)
    const asOf = dateMatch?.[1]
        ? new Date(dateMatch[1].split('.').reverse().join('-')).toISOString()
        : new Date().toISOString()

    return { value, asOf }
}

async function fetchUsdTryFromYahoo(): Promise<MarketOverviewCard> {
    const payload = await fetchYahooChart('TRY=X', '1d', '1mo')
    const series = parseYahooSeries(payload)
    const last = series[series.length - 1]
    const prev = series[series.length - 2] || last
    if (!last) {
        throw new Error('No TRY=X data')
    }

    const changePct = prev && prev.close > 0
        ? ((last.close - prev.close) / prev.close) * 100
        : null

    return {
        id: 'usdtry',
        label: 'USD / TRY',
        value: last.close,
        changePct,
        currency: 'TRY',
        source: 'yahoo',
        asOf: last.t,
        stale: false,
    }
}

async function fetchUsdTryFromTcmb(): Promise<MarketOverviewCard> {
    const response = await fetchWithTimeout('https://www.tcmb.gov.tr/kurlar/today.xml', 10_000)
    if (!response.ok) {
        throw new Error(`TCMB request failed: ${response.status}`)
    }

    const parsed = parseTcmbUsdTry(await response.text())
    if (!parsed) {
        throw new Error('TCMB USD/TRY parse failed')
    }

    return {
        id: 'usdtry',
        label: 'USD / TRY',
        value: parsed.value,
        changePct: null,
        currency: 'TRY',
        source: 'tcmb-official-daily',
        asOf: parsed.asOf,
        stale: false,
    }
}

async function fetchXauUsdCard(): Promise<MarketOverviewCard> {
    const response = await fetchWithTimeout('https://api.gold-api.com/price/XAU', 10_000)
    if (!response.ok) {
        throw new Error(`Gold API request failed: ${response.status}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const value = Number(payload.price)
    if (!Number.isFinite(value)) {
        throw new Error('Gold API payload missing price')
    }

    const rawChange = payload.chp ?? payload.change_percent ?? payload.changePercentage
    const changePct = typeof rawChange === 'number' ? rawChange : null

    return {
        id: 'xauusd',
        label: 'Ons Altın / USD',
        value,
        changePct,
        currency: 'USD',
        source: 'gold-api',
        asOf: new Date().toISOString(),
        stale: false,
    }
}

function buildUnavailableCard(
    id: CardId,
    label: string,
    currency: 'TRY' | 'USD'
): MarketOverviewCard {
    return {
        id,
        label,
        value: null,
        changePct: null,
        currency,
        source: 'error',
        asOf: new Date().toISOString(),
        stale: true,
    }
}

async function resolveCardWithFallback(
    id: CardId,
    resolver: () => Promise<MarketOverviewCard>,
    unavailable: MarketOverviewCard
): Promise<MarketOverviewCard> {
    try {
        const card = await resolver()
        setCardCache(card)
        return card
    } catch (error) {
        const cached = getCachedCard(id)
        if (cached) {
            return cached.card
        }

        const errorMessage = error instanceof Error ? error.message : ''
        const isYahooRateLimited = /429|too many requests/i.test(errorMessage)
        if (isYahooRateLimited) {
            return {
                ...unavailable,
                source: 'error-yahoo-429',
            }
        }

        return unavailable
    }
}

const fetchYahooIndexCardCached = unstable_cache(
    (id: 'bist100' | 'bist30', label: string, symbol: 'XU100.IS' | 'XU030.IS') =>
        fetchYahooIndexCard(id, label, symbol),
    ['yahoo-index-card'],
    { revalidate: 3600 }
)

const fetchUsdTryFromYahooCached = unstable_cache(
    () => fetchUsdTryFromYahoo(),
    ['yahoo-usdtry'],
    { revalidate: 3600 }
)

export async function GET() {
    const bist100Promise = resolveCardWithFallback(
        'bist100',
        () => fetchYahooIndexCardCached('bist100', 'BIST 100', 'XU100.IS'),
        buildUnavailableCard('bist100', 'BIST 100', 'TRY')
    )

    const bist30Promise = resolveCardWithFallback(
        'bist30',
        () => fetchYahooIndexCardCached('bist30', 'BIST 30', 'XU030.IS'),
        buildUnavailableCard('bist30', 'BIST 30', 'TRY')
    )

    const usdTryPromise = resolveCardWithFallback(
        'usdtry',
        async () => {
            try {
                return await fetchUsdTryFromYahooCached()
            } catch {
                return await fetchUsdTryFromTcmb()
            }
        },
        buildUnavailableCard('usdtry', 'USD / TRY', 'TRY')
    )

    const xauUsdPromise = resolveCardWithFallback(
        'xauusd',
        fetchXauUsdCard,
        buildUnavailableCard('xauusd', 'Ons Altın / USD', 'USD')
    )

    const cards = await Promise.all([
        bist100Promise,
        bist30Promise,
        xauUsdPromise,
        usdTryPromise,
    ])

    const orderedCards = CARD_ORDER.map((id) => cards.find((card) => card.id === id)).filter(
        (card): card is MarketOverviewCard => Boolean(card)
    )

    return NextResponse.json(
        {
            cards: orderedCards,
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
            },
        }
    )
}
