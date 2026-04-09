// Global TypeScript types

export interface Market {
    id: string
    symbol: string
    name: string
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap?: number
    category: 'BIST' | 'NASDAQ' | 'FOREX' | 'CRYPTO'
}

export interface Asset extends Market {
    open: number
    high: number
    low: number
    prevClose: number
    logo?: string
}

export interface User {
    id: string
    email: string
    name?: string
    photoURL?: string
    createdAt: string
}

export type AppLanguage = 'en' | 'tr' | 'de'
export type AppCurrency = 'USD' | 'TRY' | 'EUR'
export type AppTheme = 'dark' | 'light'
export type UserPlan = 'Free' | 'Pro Trader'

export interface NotificationPreferences {
    priceAlerts: boolean
    newsDigest: boolean
}

export interface UserPreferences {
    language: AppLanguage
    currency: AppCurrency
    theme: AppTheme
    notifications: NotificationPreferences
}

export interface UserProfile {
    uid: string
    email: string
    displayName: string
    photoURL: string | null
    plan: UserPlan
    createdAt: string
    updatedAt: string
    preferences: UserPreferences
}

export interface PriceHistory {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
}

// Evalon API Types
export interface PriceBar {
    t: string   // timestamp (ISO format)
    o: number   // open
    h: number   // high
    l: number   // low
    c: number   // close
    v: number   // volume
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1M'

export interface PriceResponse {
    ticker: string
    timeframe: string
    rows: number
    data: PriceBar[]
}

// Alias for backward compatibility
export type PricesResponse = PriceResponse

export interface FetchPricesParams {
    ticker: string
    timeframe: Timeframe
    limit?: number
    start?: string  // YYYY-MM-DDTHH:MM:SS
    end?: string    // YYYY-MM-DDTHH:MM:SS
}

// Watchlist item for dashboard
export interface WatchlistItem {
    ticker: string
    name: string
    price: number
    change: number
    changePercent: number
    priceHistory: PriceBar[]
}

export type MarketListView = 'markets' | 'screener'
export type ListSortDirection = 'asc' | 'desc'

export type MarketListSortField =
    | 'ticker'
    | 'price'
    | 'changePct'
    | 'changeVal'
    | 'high'
    | 'low'
    | 'vol'
    | 'rating'
    | 'marketCap'
    | 'pe'
    | 'eps'
    | 'sector'

export interface MarketListItem {
    ticker: string
    name: string
    price: number | null
    changePct: number | null
    changeVal: number | null
    high: number | null
    low: number | null
    vol: number | null
    rating: string
    marketCap?: number | null
    pe?: number | null
    eps?: number | null
    sector?: string | null
}

export interface MarketListQuery {
    view?: MarketListView
    limit?: number
    cursor?: string | number
    sortBy?: MarketListSortField
    sortDir?: ListSortDirection
    q?: string
}

export interface MarketSnapshotMeta {
    snapshotAt: string
    snapshotAgeMs: number | null
    stale: boolean
    warming: boolean
}

export type MarketListApiMeta = MarketSnapshotMeta

export interface PaginatedListResponse<T> {
    items: T[]
    total: number
    nextCursor: string | null
    hasMore: boolean
    snapshotAt: string
    snapshotAgeMs?: number | null
    stale?: boolean
    warming?: boolean
}

export interface UserWatchlist {
    tickers: string[]
    updatedAt: string
}

export type UserAlertOperator = 'gt' | 'lt'
export type UserAlertStatus = 'active' | 'triggered'

export interface UserAlert {
    id: string
    ticker: string
    operator: UserAlertOperator
    targetPrice: number
    status: UserAlertStatus
    createdAt: string
    updatedAt: string
}

export interface UserScreenerPreset {
    id: string
    name: string
    search: string
    sortBy: MarketListSortField
    sortDir: ListSortDirection
    createdAt: string
    updatedAt: string
}

export type ScreenerPreset = UserScreenerPreset
