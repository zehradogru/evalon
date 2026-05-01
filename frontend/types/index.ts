import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp,
} from 'firebase/firestore'
import type {
    FilterLogic,
    ScreenerFilter,
    ScreenerTimeframe,
} from './screener'

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
    emailVerified: boolean
    authSecurity: AuthSecurityState | null
}

export type AuthSecurityProvider = 'password' | 'google'

export interface AuthSecurityState {
    verificationRequired: boolean
    rolloutVersion: number
    createdWithProvider: AuthSecurityProvider
}

export type AppLanguage = 'en' | 'tr' | 'de'
export type AppCurrency = 'USD' | 'TRY' | 'EUR'
export type AppTheme = 'dark' | 'light'
export type UserPlan = 'Free' | 'Pro Trader'

export interface NotificationPreferences {
    pushEnabled: boolean
    priceAlerts: boolean
    indicatorAlerts: boolean
    newsAlerts: boolean
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
    authSecurity: AuthSecurityState | null
}

export interface CommunityPostRecord {
    content: string
    tickers: string[]
    tags: string[]
    authorId: string
    authorName: string
    createdAt: Timestamp
    editedAt: Timestamp | null
    likeCount: number
    commentCount?: number
    reportCount: number
    imageUrl: string | null
    imagePath: string | null
    imageWidth: number | null
    imageHeight: number | null
}

export interface CommunityCommentRecord {
    content: string
    authorId: string
    authorName: string
    createdAt: Timestamp
    editedAt: Timestamp | null
}

export interface CommunityReportRecord {
    reason: string
    createdAt: Timestamp
}

export interface CommunityMarkerRecord {
    createdAt: Timestamp
}

export type CommunityFeedFilter = 'all' | 'saved' | 'mine'

export interface CommunityPostDraftImage {
    file: File | null
    existingUrl: string | null
    existingPath: string | null
    existingWidth: number | null
    existingHeight: number | null
    remove: boolean
}

export interface CommunityPostDraft {
    content: string
    tickers: string[]
    tags: string[]
    image: CommunityPostDraftImage | null
}

export interface CommunityPost {
    id: string
    content: string
    tickers: string[]
    tags: string[]
    authorId: string
    authorName: string
    createdAt: string
    editedAt: string | null
    likeCount: number
    commentCount: number
    reportCount: number
    imageUrl: string | null
    imagePath: string | null
    imageWidth: number | null
    imageHeight: number | null
    viewerHasLiked: boolean
    viewerHasSaved: boolean
    isMine: boolean
}

export interface CommunityCommentDraft {
    content: string
}

export interface CommunityComment {
    id: string
    postId: string
    content: string
    authorId: string
    authorName: string
    createdAt: string
    editedAt: string | null
    isMine: boolean
}

export type CommunityFeedCursor = QueryDocumentSnapshot<DocumentData>

export interface CommunityFeedPage {
    items: CommunityPost[]
    nextCursor: CommunityFeedCursor | null
    hasMore: boolean
}

export interface CommunityRelatedGroup {
    ticker: string
    posts: CommunityPost[]
}

export type CommunityReportReason =
    | 'Spam'
    | 'Harassment'
    | 'Misinformation'
    | 'Off-topic'
    | 'Other'

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

export interface MarketOverviewCard {
    id: 'bist100' | 'bist30' | 'xauusd' | 'usdtry'
    label: string
    value: number | null
    changePct: number | null
    currency: 'TRY' | 'USD'
    source: string
    asOf: string
    stale: boolean
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

export interface BacktestRuleParamSpec {
    key: string
    label: string
    type: 'int' | 'number'
    default: number
    min: number
    max: number
    step: number
}

export interface BacktestCatalogRule {
    id: string
    label: string
    family: string
    category: string
    stages: string[]
    summary: string
    params?: BacktestRuleParamSpec[]
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

export interface PortfolioCurveData {
    mode: string
    initialBalance: number
    finalBalance: number
    peakBalance: number
    lowBalance: number
    maxDrawdownPct: number
    points: PortfolioCurvePoint[]
}

export interface PortfolioCurveResponse {
    runId: string
    status: string
    createdAt: number
    startedAt: number | null
    finishedAt: number | null
    progress: BacktestProgress
    error?: string
    summary?: BacktestSummary
    curve?: PortfolioCurveData
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
    selected_rule_ids?: string[]
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

export type CoMovementMatrixName =
    | 'pearson'
    | 'spearman'
    | 'dtw_distance'
    | 'dtw_similarity'
    | 'hybrid_similarity'

export interface CoMovementSnapshotMeta {
    snapshot_id: string
    label: string
    created_at: string
    symbol_count: number
    edge_count: number
    community_count: number
    date_range: {
        start: string
        end: string
        aligned_start?: string
        aligned_end?: string
        timeframe?: string
        rows?: number
    }
    config: {
        top_k: number
        min_similarity: number
        rolling_window: number
        rolling_step: number
        max_missing_ratio: number
        min_history_rows: number
    }
    available_matrices: CoMovementMatrixName[]
}

export interface CoMovementPair {
    source: string
    target: string
    pearson?: number
    spearman?: number
    dtw_similarity?: number
    hybrid_similarity?: number
}

export interface CoMovementRollingStabilityRow {
    pair: string
    source: string
    target: string
    stability: number
    strong_windows: number
    total_windows: number
    hybrid_similarity: number
}

export interface CoMovementCommunity {
    community_id: number
    stocks: string[]
    size: number
    avg_similarity: number
}

export interface CoMovementNode {
    id: string
    label: string
    community_id?: number
}

export interface CoMovementEdge {
    source: string
    target: string
    weight: number
    pearson: number
    dtw_similarity: number
}

export interface CoMovementDataQualityRow {
    symbol: string
    rows: number
    observed_rows: number
    filled_rows: number
    missing_ratio: number
}

export interface CoMovementExcludedSymbol {
    symbol: string
    reason: string
    rows?: number
    required_rows?: number
    missing_ratio?: number
}

export interface CoMovementMetrics {
    modularity: number
    community_count: number
    edge_count: number
    node_count: number
    pair_count: number
    rolling_window_count: number
    louvain_method: string
}

export interface CoMovementConfig {
    top_k: number
    min_similarity: number
    rolling_window: number
    rolling_step: number
    max_missing_ratio: number
    min_history_rows: number
}

export interface CoMovementDateRange {
    start: string
    end: string
    aligned_start?: string
    aligned_end?: string
    timeframe?: string
    rows?: number
}

export type CoMovementMatrixDictionary = Record<string, Record<string, number | null>>

export interface CoMovementPairRankings {
    pearson: CoMovementPair[]
    dtw: CoMovementPair[]
    hybrid: CoMovementPair[]
}

interface CoMovementResultBase {
    symbols: string[]
    requested_symbols: string[]
    excluded_symbols: CoMovementExcludedSymbol[]
    date_range: CoMovementDateRange
    config: CoMovementConfig
    top_pairs: CoMovementPair[]
    pair_rankings: CoMovementPairRankings
    graph: {
        nodes: CoMovementNode[]
        edges: CoMovementEdge[]
    }
    communities: CoMovementCommunity[]
    metrics: CoMovementMetrics
    rolling_stability: CoMovementRollingStabilityRow[]
    data_quality: CoMovementDataQualityRow[]
}

export interface CoMovementSnapshotSummary extends CoMovementResultBase {
    matrices: {
        storage: string
        available: CoMovementMatrixName[]
        symbols: string[]
    }
    snapshot: CoMovementSnapshotMeta
    snapshot_summary: {
        top_pairs_total: number
        top_pairs_saved: number
        rolling_stability_total: number
        rolling_stability_saved: number
        pair_rankings_total: Record<string, number>
        pair_rankings_saved: Record<string, number>
    }
}

export interface CoMovementAnalyzeRequest {
    symbols: string[]
    start_date: string
    end_date: string
    top_k: number
    min_similarity: number
    rolling_window: number
    rolling_step?: number
    max_missing_ratio?: number
    min_history_rows?: number
    timeframe?: '1d'
}

export interface CoMovementAnalyzeResponse extends CoMovementResultBase {
    matrices: Record<CoMovementMatrixName, CoMovementMatrixDictionary>
}

export interface CoMovementMatrixResponse {
    matrix_name: CoMovementMatrixName
    symbols: string[]
    matrix: CoMovementMatrixDictionary
}

export interface CoMovementExplainRequest {
    top_pairs: CoMovementPair[]
    communities: CoMovementCommunity[]
    metrics: Partial<CoMovementMetrics>
    language: string
    symbols?: string[]
    date_range?: Partial<CoMovementDateRange>
}

export interface CoMovementExplainResponse {
    summary: string
    warnings: string[]
    source: string
    model: string | null
}

export interface CoMovementSymbolSearchResponse {
    count: number
    total_available: number
    search: string
    symbols: Array<{
        symbol: string
    }>
}

export interface CoMovementSnapshotListResponse {
    count: number
    snapshots: CoMovementSnapshotMeta[]
}

export interface UserWatchlist {
    tickers: string[]
    updatedAt: string
}

export type UserAlertOperator = 'gt' | 'lt'
export type UserAlertStatus = 'active' | 'triggered'

export type AlertRuleStatus = 'active' | 'paused'
export type NotificationKind = 'price' | 'indicator' | 'system' | 'news'
export type NotificationKindFilter = 'all' | NotificationKind
export type NotificationDevicePermission =
    | 'default'
    | 'denied'
    | 'granted'
    | 'unsupported'
export type NewsAlertScopeType = 'watchlist'
export type NewsAlertSentiment = 'OLUMLU' | 'OLUMSUZ' | 'NOTR'
export type NewsAlertMatchStatus = 'pending' | 'delivered'
export type NotificationPayloadValue =
    | string
    | number
    | boolean
    | null
    | string[]

export interface UserAlert {
    id: string
    ticker: string
    operator: UserAlertOperator
    targetPrice: number
    status: UserAlertStatus
    createdAt: string
    updatedAt: string
}

export interface AlertRule {
    id: string
    ticker: string
    timeframe: ScreenerTimeframe
    logic: FilterLogic
    filters: ScreenerFilter[]
    status: AlertRuleStatus
    lastMatchState: boolean | null
    lastTriggeredAt: string | null
    lastEvaluatedAt: string | null
    nextEvaluationAt: string
    createdAt: string
    updatedAt: string
}

export interface WatchlistNewsAlertRule {
    id: string
    status: AlertRuleStatus
    scopeType: NewsAlertScopeType
    sentiments: NewsAlertSentiment[]
    burstWindowMinutes: 10
    lastCheckedAt: string | null
    lastTriggeredAt: string | null
    lastEvaluatedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface WatchlistNewsAlertMatch {
    id: string
    ticker: string | null
    title: string
    sentiment: NewsAlertSentiment | null
    publishedAt: string | null
    windowStart: string
    windowEnd: string
    status: NewsAlertMatchStatus
    deliveredAt: string | null
}

export interface UserNotification {
    id: string
    kind: NotificationKind
    title: string
    body: string
    ticker: string | null
    timeframe: ScreenerTimeframe | null
    ruleId: string | null
    isRead: boolean
    createdAt: string
    readAt: string | null
    payload: Record<string, NotificationPayloadValue> | null
}

export interface NotificationDevice {
    id: string
    token: string | null
    permission: NotificationDevicePermission
    browser: string
    platform: string
    active: boolean
    lastSeenAt: string
}

export type NotificationCursor = QueryDocumentSnapshot<DocumentData>

export interface NotificationPage {
    items: UserNotification[]
    nextCursor: NotificationCursor | null
    hasMore: boolean
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
