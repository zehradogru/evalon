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

export interface PriceBar {
    t: string
    o: number
    h: number
    l: number
    c: number
    v: number
}

export type Timeframe =
    | '1m'
    | '3m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '2h'
    | '4h'
    | '6h'
    | '12h'
    | '1d'
    | '1g'
    | '1w'
    | '1M'
    | '1mo'

export interface PriceResponse {
    ticker: string
    timeframe: string
    rows: number
    data: PriceBar[]
    meta?: MarketDataMeta
}

export type PricesResponse = PriceResponse

export interface FetchPricesParams {
    ticker: string
    timeframe: Timeframe
    limit?: number
    start?: string
    end?: string
}

export interface IndicatorCatalogItem {
    id: string
    label: string
}

export interface IndicatorSeriesPoint {
    t: string
    v?: number | null
    [key: string]: string | number | null | undefined
}

export interface IndicatorSeries {
    id: string
    series: IndicatorSeriesPoint[]
    [key: string]: unknown
}

export interface IndicatorCatalogResponse {
    count: number
    indicators: IndicatorCatalogItem[]
}

export interface IndicatorResponse {
    ticker: string
    timeframe: string
    strategy: string
    indicators: IndicatorSeries[]
}

export interface IndicatorQueryParams {
    ticker: string
    timeframe: Timeframe
    strategy: string
    period?: number
    fast?: number
    slow?: number
    signal?: number
    start?: string
    end?: string
    limit?: number
}

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

export type MarketDataSource =
    | 'live'
    | 'cache'
    | 'stale-cache'
    | 'warming'
    | 'empty'
    | 'error'

export type MarketDataEmptyReason =
    | 'no-data'
    | 'unsupported-timeframe'
    | 'warming'
    | 'unavailable'

export interface MarketDataMeta {
    stale: boolean
    warming: boolean
    partial: boolean
    hasUsableData: boolean
    source: MarketDataSource
    snapshotAgeMs: number | null
    failedTickers?: string[]
    message?: string
    emptyReason?: MarketDataEmptyReason
}

export interface PaginatedListResponse<T> {
    items: T[]
    total: number
    nextCursor: string | null
    hasMore: boolean
    snapshotAt: string
    snapshotAgeMs?: number | null
    stale?: boolean
    warming?: boolean
    meta?: MarketDataMeta
}

export interface BacktestRuleCatalogFamily {
    id: string
    label: string
}

export interface BacktestCatalogRule {
    id: string
    label: string
    family: string
    category: string
    stages: string[]
    summary: string
}

export interface BacktestRuleCatalogResponse {
    count: number
    families: BacktestRuleCatalogFamily[]
    rules: BacktestCatalogRule[]
}

export interface BacktestPreset {
    id: string
    label: string
    summary: string
    direction: string
    stageThreshold: number
    ruleIds: string[]
}

export interface BacktestPresetCatalogResponse {
    count: number
    presets: BacktestPreset[]
}

export interface BacktestRuleSelection {
    id: string
    required: boolean
    params: Record<string, string | number | boolean>
}

export interface BacktestStage {
    key: string
    timeframe: Timeframe | string
    required: boolean
    minOptionalMatches: number
    rules: BacktestRuleSelection[]
}

export interface BacktestPortfolioConfig {
    initialCapital?: number | null
    positionSize?: number | null
    commissionPct?: number | null
}

export interface BacktestRiskConfig {
    stopPct: number
    targetPct: number
    maxBars: number
}

export interface BacktestBlueprint {
    symbol?: string
    symbols: string[]
    stageThreshold: number
    direction: string
    testWindowDays: number
    portfolio?: BacktestPortfolioConfig
    risk: BacktestRiskConfig
    stages: Record<string, BacktestStage>
}

export interface BacktestProgress {
    phase: string
    progressPct: number
    totalSymbols: number
    processedSymbols: number
    currentSymbol: string | null
    message: string
}

export interface BacktestSummary {
    totalTrades: number
    winRate: number
    totalPnl: number
    maxDrawdown: number
}

export interface BacktestEvent {
    id: string
    type: string
    time: number
    price: number
    side: string
    symbol: string
    qty: number
    tradeId: string
    orderId: string
    pnl: number | null
    reason: string
    meta: Record<string, unknown>
}

export interface BacktestRunResponse {
    runId: string
    result: Record<string, unknown>
    summary: BacktestSummary
    eventsCount: number
}

export interface BacktestStatusResponse {
    runId: string
    status: string
    createdAt: number
    startedAt: number | null
    finishedAt: number | null
    progress: BacktestProgress
    eventsCount: number
    error?: string
    result?: Record<string, unknown>
    summary?: BacktestSummary
}

export interface BacktestEventsResponse {
    runId: string
    events: BacktestEvent[]
    summary: BacktestSummary | null
    page: number
    totalPages: number
    totalEvents: number
}

export type PortfolioCurvePoint = Record<string, unknown> | number

export interface PortfolioCurveResponse {
    runId: string
    status: string
    createdAt: number
    startedAt: number | null
    finishedAt: number | null
    progress: BacktestProgress
    error?: string
    summary?: BacktestSummary
    curve?: PortfolioCurvePoint[]
}

export type AiChatRole = 'user' | 'assistant' | 'tool'
export type AiAssetKind = 'strategy' | 'rule' | 'indicator'

export interface AiToolDescriptor {
    name: string
    description: string
    args: Record<string, unknown>
}

export interface AiToolCatalog {
    count: number
    tools: AiToolDescriptor[]
}

export interface AiToolCall {
    name: string
    arguments: Record<string, unknown>
}

export interface AiDraftStrategy {
    title: string
    description: string
    blueprint?: Record<string, unknown> | null
    status: string
}

export interface AiDraftRule {
    title: string
    description: string
    expression: string
    stages: string[]
    status: string
}

export interface AiDraftIndicator {
    title: string
    description: string
    formula: string
    inputs: string[]
    parameters: Record<string, unknown>
    status: string
}

export interface AiExecutionPlan {
    intent: string
    tool_calls: AiToolCall[]
    strategy_draft?: AiDraftStrategy | null
    rule_draft?: AiDraftRule | null
    indicator_draft?: AiDraftIndicator | null
    notes: string[]
}

export interface AiMessage {
    id: string
    role: AiChatRole
    content: string
    created_at: number
    name?: string | null
    metadata: Record<string, unknown>
}

export interface AiSession {
    session_id: string
    user_id: string
    created_at: number
    updated_at: number
    title?: string | null
    messages: AiMessage[]
    last_plan?: AiExecutionPlan | null
    last_tool_results: Array<Record<string, unknown>>
    working_context: Record<string, unknown>
    last_backtest_run_id?: string | null
    active_strategy_draft?: AiDraftStrategy | null
}

export interface AiRequestContext {
    user_id?: string
    ticker?: string | null
    timeframe?: string | null
    indicator_id?: string | null
    active_blueprint?: Record<string, unknown> | null
    selected_symbols?: string[]
    auto_save_drafts?: boolean
}

export interface AiSessionCreateResponse {
    sessionId: string
    userId: string
    createdAt: number
    title?: string | null
    messages: AiMessage[]
}

export interface AiAsset {
    asset_id: string
    user_id: string
    kind: AiAssetKind
    title: string
    description: string
    prompt?: string | null
    spec: Record<string, unknown>
    created_at: number
    updated_at: number
}

export interface AiAssetsResponse {
    userId: string
    counts: Record<string, number>
    assets: {
        strategies: AiAsset[]
        rules: AiAsset[]
        indicators: AiAsset[]
    }
}

export interface AiMessageResponse {
    sessionId: string
    message: AiMessage
    plan: AiExecutionPlan | null
    toolResults: Array<Record<string, unknown>>
    savedAssets: AiAsset[]
    errors: string[]
    drafts: {
        strategy?: AiDraftStrategy
        rule?: AiDraftRule
        indicator?: AiDraftIndicator
    }
    resolvedContext: Record<string, unknown>
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
