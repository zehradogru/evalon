import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { DEFAULT_EVALON_API_URL } from '@/lib/evalon'
import type {
    ListSortDirection,
    MarketDataMeta,
    MarketListItem,
    MarketListQuery,
    MarketListSortField,
    PaginatedListResponse,
    PriceBar,
} from '@/types'

const EVALON_API_URL =
    process.env.NEXT_PUBLIC_EVALON_API_URL || DEFAULT_EVALON_API_URL

const SNAPSHOT_FRESH_TTL_MS = 30 * 1000
const SNAPSHOT_STALE_TTL_MS = 5 * 60 * 1000
const INITIAL_SNAPSHOT_TIMEOUT_MS = 12_000
const FETCH_TIMEOUT_MS = 15 * 1000
const FETCH_RETRIES = 1
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 150
const MIN_ACCEPTABLE_SUCCESS_RATE = 0.7
const FETCH_BARS_LIMIT = 5

export const DEFAULT_MARKET_LIST_LIMIT = 10
export const MAX_MARKET_LIST_LIMIT = 200
export const DEFAULT_MARKET_LIST_SORT_BY: MarketListSortField = 'changePct'
export const DEFAULT_MARKET_LIST_SORT_DIR: ListSortDirection = 'desc'

interface CacheEntry {
    fetchedAt: number
    snapshotAt: string
    items: MarketListItem[]
}

interface SnapshotState {
    entry: CacheEntry | null
    snapshotAgeMs: number | null
    stale: boolean
    warming: boolean
    source: MarketDataMeta['source']
    message?: string
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

async function fetchTickerSnapshot(ticker: string, startDate: string): Promise<PriceBar[]> {
    const url = `${EVALON_API_URL}/v1/prices?ticker=${ticker}&timeframe=1d&limit=${FETCH_BARS_LIMIT}&start=${startDate}`

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
        try {
            const response = await fetchWithTimeout(url)
            if (!response.ok) {
                if (attempt < FETCH_RETRIES) {
                    await delay(300 * (attempt + 1))
                    continue
                }
                return []
            }

            const payload = await response.json()
            const data: PriceBar[] = Array.isArray(payload?.data) ? payload.data : []
            data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
            return data
        } catch {
            if (attempt < FETCH_RETRIES) {
                await delay(300 * (attempt + 1))
                continue
            }
            return []
        }
    }

    return []
}

async function buildBulkData(startDate: string): Promise<Record<string, PriceBar[]> | null> {
    const tickersParam = encodeURIComponent(BIST_AVAILABLE.join(','))
    const url = `${EVALON_API_URL}/v1/prices/bulk?tickers=${tickersParam}&timeframe=1d&start=${startDate}&limit=${FETCH_BARS_LIMIT}`

    try {
        const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
        if (!response.ok) {
            return null // endpoint not available yet — caller falls back to per-ticker
        }
        const payload: { data?: Record<string, PriceBar[]> } = await response.json()
        return payload.data ?? {}
    } catch {
        return null
    }
}

async function buildSnapshot(previousSnapshot: CacheEntry | null): Promise<CacheEntry> {
    const startDate = getStartDate(14)
    const previousItemsByTicker = new Map<string, MarketListItem>(
        previousSnapshot?.items.map((item) => [item.ticker, item]) ?? []
    )

    // Try fast single-request bulk endpoint first
    let bulkData = await buildBulkData(startDate)

    // If bulk endpoint is unavailable (404/error), fall back to per-ticker batching
    if (bulkData === null) {
        console.info('[market] bulk endpoint unavailable, falling back to per-ticker fetch')
        bulkData = {}
        for (let i = 0; i < BIST_AVAILABLE.length; i += BATCH_SIZE) {
            const batch = BIST_AVAILABLE.slice(i, i + BATCH_SIZE)
            const settled = await Promise.allSettled(
                batch.map((ticker) => fetchTickerSnapshot(ticker, startDate))
            )
            settled.forEach((result, index) => {
                bulkData![batch[index]] = result.status === 'fulfilled' ? result.value : []
            })
            if (i + BATCH_SIZE < BIST_AVAILABLE.length) {
                await delay(BATCH_DELAY_MS)
            }
        }
    }

    const items: MarketListItem[] = BIST_AVAILABLE.map((ticker) => {
        const bars = bulkData![ticker] ?? []
        const current = bars.length > 0 ? bars[bars.length - 1] : null
        const previous = bars.length > 1 ? bars[bars.length - 2] : null
        return toMarketListItem(ticker, current, previous, previousItemsByTicker.get(ticker))
    })

    const successfulCount = items.filter((item) => item.price !== null).length
    const successRate = successfulCount / BIST_AVAILABLE.length

    if (successRate < MIN_ACCEPTABLE_SUCCESS_RATE && previousSnapshot) {
        return previousSnapshot
    }

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
                source: 'cache',
            }
        }

        // Serve stale immediately and refresh in the background.
        void triggerSnapshotRefresh()
        return {
            entry: cacheEntry,
            snapshotAgeMs: ageMs,
            stale: true,
            warming: ageMs > SNAPSHOT_STALE_TTL_MS,
            source: 'stale-cache',
            message:
                ageMs > SNAPSHOT_STALE_TTL_MS
                    ? 'Piyasa verisi yenileniyor.'
                    : undefined,
        }
    }

    if (refreshPromise) {
        return {
            entry: null,
            snapshotAgeMs: null,
            stale: false,
            warming: true,
            source: 'warming',
            message: 'Piyasa verisi hazirlaniyor.',
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
            source: 'live',
        }
    } catch (error) {
        console.warn('Market snapshot warm-up timed out or failed:', error)
        const message =
            error instanceof Error ? error.message : 'Piyasa verisi alinamadi.'
        const timedOut = message.toLowerCase().includes('timed out')
        return {
            entry: null,
            snapshotAgeMs: null,
            stale: false,
            warming: timedOut,
            source: timedOut ? 'warming' : 'error',
            message: timedOut
                ? 'Piyasa verisi hazirlaniyor.'
                : 'Piyasa verisi gecici olarak alinamiyor.',
        }
    }
}

export async function getPaginatedMarketList(
    query: MarketListQuery
): Promise<PaginatedListResponse<MarketListItem>> {
    const snapshotState = await getSnapshotState()

    if (!snapshotState.entry) {
        const nowIso = new Date().toISOString()
        const meta: MarketDataMeta = {
            stale: false,
            warming: snapshotState.warming,
            partial: false,
            hasUsableData: false,
            source: snapshotState.source,
            snapshotAgeMs: null,
            message: snapshotState.message,
            emptyReason: snapshotState.warming ? 'warming' : 'unavailable',
        }
        return {
            items: [],
            total: 0,
            nextCursor: null,
            hasMore: false,
            snapshotAt: nowIso,
            snapshotAgeMs: null,
            stale: false,
            warming: snapshotState.warming,
            meta,
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
        meta: {
            stale: snapshotState.stale,
            warming: snapshotState.warming,
            partial: snapshotState.entry.items.some((item) => item.price === null),
            hasUsableData: sorted.length > 0,
            source: snapshotState.source,
            snapshotAgeMs: snapshotState.snapshotAgeMs,
            message:
                snapshotState.message ||
                (snapshotState.stale
                    ? 'Piyasa verisi guncelleniyor.'
                    : undefined),
            emptyReason: sorted.length > 0 ? undefined : 'no-data',
        },
    }
}
