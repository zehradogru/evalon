import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import type {
    ListSortDirection,
    MarketListItem,
    MarketListQuery,
    MarketListSortField,
    PaginatedListResponse,
    PriceBar,
} from '@/types'

const EVALON_API_URL = process.env.NEXT_PUBLIC_EVALON_API_URL || 'https://evalon-mu.vercel.app'

const SNAPSHOT_FRESH_TTL_MS = 30 * 1000
const SNAPSHOT_STALE_TTL_MS = 5 * 60 * 1000
const INITIAL_SNAPSHOT_TIMEOUT_MS = 5500
const FETCH_TIMEOUT_MS = 15 * 1000
const FETCH_RETRIES = 2
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 150
const MIN_ACCEPTABLE_SUCCESS_RATE = 0.7
const FETCH_BARS_LIMIT = 10

export const DEFAULT_MARKET_LIST_LIMIT = 10
export const MAX_MARKET_LIST_LIMIT = 200
export const DEFAULT_MARKET_LIST_SORT_BY: MarketListSortField = 'changePct'
export const DEFAULT_MARKET_LIST_SORT_DIR: ListSortDirection = 'desc'

interface CacheEntry {
    fetchedAt: number
    snapshotAt: string
    items: MarketListItem[]
}

interface TickerSnapshotResult {
    ticker: string
    current: PriceBar | null
    previous: PriceBar | null
}

interface SnapshotState {
    entry: CacheEntry | null
    snapshotAgeMs: number | null
    stale: boolean
    warming: boolean
}

let cacheEntry: CacheEntry | null = null
let refreshPromise: Promise<CacheEntry> | null = null

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getStartDate(daysBack: number): string {
    const now = new Date()
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return start.toISOString().split('T')[0]
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    })

    try {
        return await Promise.race([promise, timeoutPromise])
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

function getSnapshotAgeMs(entry: CacheEntry): number {
    return Math.max(0, Date.now() - entry.fetchedAt)
}

function clampLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) return DEFAULT_MARKET_LIST_LIMIT
    return Math.min(Math.max(limit, 1), MAX_MARKET_LIST_LIMIT)
}

function normalizeCursor(cursor?: string | number): number {
    if (cursor === undefined || cursor === null || cursor === '') return 0
    const value = typeof cursor === 'number' ? cursor : parseInt(cursor, 10)
    if (Number.isNaN(value) || value < 0) return 0
    return value
}

function normalizeSortBy(sortBy?: string): MarketListSortField {
    const validSortBy: MarketListSortField[] = [
        'ticker',
        'price',
        'changePct',
        'changeVal',
        'high',
        'low',
        'vol',
        'rating',
        'marketCap',
        'pe',
        'eps',
        'sector',
    ]

    if (sortBy && validSortBy.includes(sortBy as MarketListSortField)) {
        return sortBy as MarketListSortField
    }

    return DEFAULT_MARKET_LIST_SORT_BY
}

function normalizeSortDir(sortDir?: string): ListSortDirection {
    return sortDir === 'asc' ? 'asc' : 'desc'
}

function normalizeSearchText(value: string): string {
    return value
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
}

function applySearch(items: MarketListItem[], q?: string): MarketListItem[] {
    const query = q ? normalizeSearchText(q) : ''
    if (!query) return items
    const queryTokens = query.split(' ').filter(Boolean)

    return items.filter((item) => {
        const searchableTicker = normalizeSearchText(item.ticker)
        const searchableName = normalizeSearchText(item.name)
        const searchableContent = `${searchableTicker} ${searchableName}`

        return queryTokens.every((token) => searchableContent.includes(token))
    })
}

const RATING_RANK: Record<string, number> = {
    'Strong Buy': 5,
    Buy: 4,
    Neutral: 3,
    Sell: 2,
    'Strong Sell': 1,
}

function numericComparator(a: number | null | undefined, b: number | null | undefined, sortDir: ListSortDirection): number {
    const aMissing = a === null || a === undefined
    const bMissing = b === null || b === undefined

    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1

    if (sortDir === 'asc') return a - b
    return b - a
}

function stringComparator(a: string | null | undefined, b: string | null | undefined, sortDir: ListSortDirection): number {
    const aValue = (a || '').toLocaleLowerCase('tr-TR')
    const bValue = (b || '').toLocaleLowerCase('tr-TR')
    const result = aValue.localeCompare(bValue, 'tr-TR')
    return sortDir === 'asc' ? result : -result
}

function applySort(
    items: MarketListItem[],
    sortBy: MarketListSortField,
    sortDir: ListSortDirection
): MarketListItem[] {
    return [...items].sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
            case 'ticker':
                comparison = stringComparator(a.ticker, b.ticker, sortDir)
                break
            case 'sector':
                comparison = stringComparator(a.sector, b.sector, sortDir)
                break
            case 'rating':
                comparison = numericComparator(RATING_RANK[a.rating] || 0, RATING_RANK[b.rating] || 0, sortDir)
                break
            case 'price':
            case 'changePct':
            case 'changeVal':
            case 'high':
            case 'low':
            case 'vol':
            case 'marketCap':
            case 'pe':
            case 'eps':
                comparison = numericComparator(a[sortBy], b[sortBy], sortDir)
                break
            default:
                comparison = numericComparator(a.changePct, b.changePct, sortDir)
                break
        }

        if (comparison !== 0) return comparison
        return a.ticker.localeCompare(b.ticker, 'tr-TR')
    })
}

function getRating(changePct: number | null): string {
    if (changePct === null) return 'Neutral'
    if (changePct > 2) return 'Strong Buy'
    if (changePct > 0.5) return 'Buy'
    if (changePct < -2) return 'Strong Sell'
    if (changePct < -0.5) return 'Sell'
    return 'Neutral'
}

function createEmptyMarketItem(ticker: string): MarketListItem {
    return {
        ticker,
        name: TICKER_NAMES[ticker] || ticker,
        price: null,
        changePct: null,
        changeVal: null,
        high: null,
        low: null,
        vol: null,
        rating: 'Neutral',
        marketCap: null,
        pe: null,
        eps: null,
        sector: null,
    }
}

function derivePreviousPrice(
    previous: PriceBar | null,
    fallback?: MarketListItem
): number | null {
    if (previous) return previous.c
    if (!fallback || fallback.price === null || fallback.changeVal === null) return null
    return fallback.price - fallback.changeVal
}

function toMarketListItem(
    ticker: string,
    current: PriceBar | null,
    previous: PriceBar | null,
    fallback?: MarketListItem
): MarketListItem {
    if (!current) {
        return fallback || createEmptyMarketItem(ticker)
    }

    const currentPrice = current.c
    const previousPrice = derivePreviousPrice(previous, fallback)
    const changeVal =
        previousPrice !== null
            ? parseFloat((currentPrice - previousPrice).toFixed(2))
            : null
    const changePct =
        previousPrice !== null && previousPrice > 0
            ? parseFloat((((currentPrice - previousPrice) / previousPrice) * 100).toFixed(2))
            : null

    return {
        ticker,
        name: TICKER_NAMES[ticker] || ticker,
        price: parseFloat(currentPrice.toFixed(2)),
        changePct,
        changeVal,
        high: current.h,
        low: current.l,
        vol: current.v,
        rating: getRating(changePct),
        marketCap: fallback?.marketCap ?? null,
        pe: fallback?.pe ?? null,
        eps: fallback?.eps ?? null,
        sector: fallback?.sector ?? null,
    }
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
        })
        return response
    } finally {
        clearTimeout(timeoutId)
    }
}

async function fetchTickerSnapshot(ticker: string, startDate: string): Promise<TickerSnapshotResult> {
    const url = `${EVALON_API_URL}/v1/prices?ticker=${ticker}&timeframe=1d&limit=${FETCH_BARS_LIMIT}&start=${startDate}`

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
        try {
            const response = await fetchWithTimeout(url)
            if (!response.ok) {
                if (attempt < FETCH_RETRIES) {
                    await delay(300 * (attempt + 1))
                    continue
                }
                return { ticker, current: null, previous: null }
            }

            const payload = await response.json()
            const data: PriceBar[] = Array.isArray(payload?.data) ? payload.data : []

            data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())

            return {
                ticker,
                current: data.length > 0 ? data[data.length - 1] : null,
                previous: data.length > 1 ? data[data.length - 2] : null,
            }
        } catch {
            if (attempt < FETCH_RETRIES) {
                await delay(300 * (attempt + 1))
                continue
            }
            return { ticker, current: null, previous: null }
        }
    }

    return { ticker, current: null, previous: null }
}

async function buildSnapshot(previousSnapshot: CacheEntry | null): Promise<CacheEntry> {
    const startDate = getStartDate(14)
    const results: TickerSnapshotResult[] = []
    const previousItemsByTicker = new Map<string, MarketListItem>(
        previousSnapshot?.items.map((item) => [item.ticker, item]) ?? []
    )

    for (let i = 0; i < BIST_AVAILABLE.length; i += BATCH_SIZE) {
        const batch = BIST_AVAILABLE.slice(i, i + BATCH_SIZE)
        const settled = await Promise.allSettled(batch.map((ticker) => fetchTickerSnapshot(ticker, startDate)))

        settled.forEach((result, index) => {
            const ticker = batch[index]
            if (result.status === 'fulfilled') {
                results.push(result.value)
            } else {
                results.push({ ticker, current: null, previous: null })
            }
        })

        if (i + BATCH_SIZE < BIST_AVAILABLE.length) {
            await delay(BATCH_DELAY_MS)
        }
    }

    const successfulCount = results.filter((item) => item.current !== null).length
    const successRate = successfulCount / BIST_AVAILABLE.length

    if (successRate < MIN_ACCEPTABLE_SUCCESS_RATE && previousSnapshot) {
        return previousSnapshot
    }

    const items: MarketListItem[] = results.map((item) =>
        toMarketListItem(
            item.ticker,
            item.current,
            item.previous,
            previousItemsByTicker.get(item.ticker)
        )
    )

    return {
        fetchedAt: Date.now(),
        snapshotAt: new Date().toISOString(),
        items,
    }
}

function triggerSnapshotRefresh(): Promise<CacheEntry> {
    if (refreshPromise) {
        return refreshPromise
    }

    refreshPromise = buildSnapshot(cacheEntry)
        .then((nextSnapshot) => {
            cacheEntry = nextSnapshot
            return nextSnapshot
        })
        .catch((error) => {
            console.error('Market snapshot refresh failed:', error)
            if (cacheEntry) {
                return cacheEntry
            }
            throw error
        })
        .finally(() => {
            refreshPromise = null
        })

    return refreshPromise
}

async function getSnapshotState(): Promise<SnapshotState> {
    if (cacheEntry) {
        const ageMs = getSnapshotAgeMs(cacheEntry)

        if (ageMs <= SNAPSHOT_FRESH_TTL_MS) {
            return {
                entry: cacheEntry,
                snapshotAgeMs: ageMs,
                stale: false,
                warming: false,
            }
        }

        // Serve stale immediately and refresh in the background.
        void triggerSnapshotRefresh()
        return {
            entry: cacheEntry,
            snapshotAgeMs: ageMs,
            stale: true,
            warming: ageMs > SNAPSHOT_STALE_TTL_MS,
        }
    }

    if (refreshPromise) {
        return {
            entry: null,
            snapshotAgeMs: null,
            stale: false,
            warming: true,
        }
    }

    try {
        const warmedSnapshot = await withTimeout(
            triggerSnapshotRefresh(),
            INITIAL_SNAPSHOT_TIMEOUT_MS
        )

        return {
            entry: warmedSnapshot,
            snapshotAgeMs: getSnapshotAgeMs(warmedSnapshot),
            stale: false,
            warming: false,
        }
    } catch (error) {
        console.warn('Market snapshot warm-up timed out or failed:', error)
        return {
            entry: null,
            snapshotAgeMs: null,
            stale: false,
            warming: true,
        }
    }
}

export async function getPaginatedMarketList(
    query: MarketListQuery
): Promise<PaginatedListResponse<MarketListItem>> {
    const snapshotState = await getSnapshotState()

    if (!snapshotState.entry) {
        const nowIso = new Date().toISOString()
        return {
            items: [],
            total: 0,
            nextCursor: null,
            hasMore: false,
            snapshotAt: nowIso,
            snapshotAgeMs: null,
            stale: false,
            warming: true,
        }
    }

    const limit = clampLimit(query.limit)
    const cursor = normalizeCursor(query.cursor)
    const sortBy = normalizeSortBy(query.sortBy)
    const sortDir = normalizeSortDir(query.sortDir)

    const searched = applySearch(snapshotState.entry.items, query.q)
    const sorted = applySort(searched, sortBy, sortDir)

    const pageItems = sorted.slice(cursor, cursor + limit)
    const nextOffset = cursor + pageItems.length

    return {
        items: pageItems,
        total: sorted.length,
        nextCursor: nextOffset < sorted.length ? String(nextOffset) : null,
        hasMore: nextOffset < sorted.length,
        snapshotAt: snapshotState.entry.snapshotAt,
        snapshotAgeMs: snapshotState.snapshotAgeMs,
        stale: snapshotState.stale,
        warming: snapshotState.warming,
    }
}
