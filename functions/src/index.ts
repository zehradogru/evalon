import { initializeApp } from 'firebase-admin/app'
import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'

setGlobalOptions({
    region: 'europe-west1',
    maxInstances: 10,
})

const firebaseApp = initializeApp()
const db = getFirestore(firebaseApp)
const messaging = getMessaging(firebaseApp)

type FilterLogic = 'AND' | 'OR'
type ScreenerTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
type NotificationKind = 'price' | 'indicator' | 'system' | 'news'
type NotificationPayloadValue =
    | string
    | number
    | boolean
    | null
    | string[]
type NotificationDevicePermission =
    | 'default'
    | 'denied'
    | 'granted'
    | 'unsupported'
type AlertRuleStatus = 'active' | 'paused'
type NewsAlertScopeType = 'watchlist'
type NewsAlertSentiment = 'OLUMLU' | 'OLUMSUZ' | 'NOTR'
type NewsAlertMatchStatus = 'pending' | 'delivered'

interface AlertFilter {
    type: string
    indicator?: string
    op?: string
    value?: number
    direction?: 'above' | 'below'
    target?: number | 'close'
    bars?: number
    side?: 'high' | 'low'
    pct_tolerance?: number
}

interface AlertRuleDocument {
    ticker: string
    timeframe: ScreenerTimeframe
    logic: FilterLogic
    filters: AlertFilter[]
    status: 'active' | 'paused'
    lastMatchState: boolean | null
    lastTriggeredAt: string | null
    lastEvaluatedAt: string | null
    nextEvaluationAt: string
    createdAt: string
    updatedAt: string
}

interface WatchlistNewsAlertRuleDocument {
    status: AlertRuleStatus
    scopeType: NewsAlertScopeType
    sentiments: NewsAlertSentiment[]
    burstWindowMinutes: number
    lastCheckedAt: string | null
    lastTriggeredAt: string | null
    lastEvaluatedAt: string | null
    createdAt: string
    updatedAt: string
}

interface WatchlistNewsAlertMatchDocument {
    ticker: string | null
    title: string
    sentiment: NewsAlertSentiment | null
    publishedAt: string | null
    windowStart: string
    windowEnd: string
    status: NewsAlertMatchStatus
    deliveredAt: string | null
}

interface NotificationRecord {
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

interface NotificationDeviceRecord {
    token: string | null
    permission: NotificationDevicePermission
    browser: string
    platform: string
    active: boolean
    lastSeenAt: string
}

interface RegisterDevicePayload {
    deviceKey: string
    token: string | null
    permission: NotificationDevicePermission
    browser: string
    platform: string
    active: boolean
}

interface ScreenerScanRow {
    ticker?: string
    close?: number
    matched_filters?: string[]
}

interface ScreenerScanResponse {
    matched?: number
    rows?: ScreenerScanRow[]
}

interface NewsApiItem {
    id: number
    symbol: string | null
    title: string
    summary: string | null
    sentiment: string | null
    news_url: string | null
    published_at: string | null
}

interface NewsApiResponse {
    items?: NewsApiItem[]
    total?: number
    page?: number
    limit?: number
}

interface NotificationPreferenceState {
    pushEnabled: boolean
    priceAlerts: boolean
    indicatorAlerts: boolean
    newsAlerts: boolean
    newsDigest: boolean
}

interface UserWatchlistState {
    tickers: string[]
}

interface UserRuntimeState {
    preferences: NotificationPreferenceState
    watchlist: UserWatchlistState
}

const TIMEFRAME_VALUES = new Set<ScreenerTimeframe>([
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '1d',
    '1w',
])
const PERMISSION_VALUES = new Set<NotificationDevicePermission>([
    'default',
    'denied',
    'granted',
    'unsupported',
])
const NEWS_ALERT_SENTIMENT_VALUES = new Set<NewsAlertSentiment>([
    'OLUMLU',
    'OLUMSUZ',
    'NOTR',
])
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
    'messaging/invalid-recipient',
])
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceState = {
    pushEnabled: false,
    priceAlerts: true,
    indicatorAlerts: true,
    newsAlerts: false,
    newsDigest: false,
}
const NEWS_ALERT_BURST_WINDOW_MINUTES = 10

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null
}

function normalizeFilterLogic(value: unknown): FilterLogic {
    return value === 'OR' ? 'OR' : 'AND'
}

function normalizeTimeframe(value: unknown): ScreenerTimeframe {
    return typeof value === 'string' && TIMEFRAME_VALUES.has(value as ScreenerTimeframe)
        ? (value as ScreenerTimeframe)
        : '1d'
}

function normalizeAlertFilters(value: unknown): AlertFilter[] {
    if (!Array.isArray(value)) return []

    return value
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item): AlertFilter => {
            const direction =
                item.direction === 'above' || item.direction === 'below'
                    ? item.direction
                    : undefined
            const side =
                item.side === 'high' || item.side === 'low'
                    ? item.side
                    : undefined

            return {
                type: typeof item.type === 'string' ? item.type : '',
                indicator:
                    typeof item.indicator === 'string'
                        ? item.indicator
                        : undefined,
                op: typeof item.op === 'string' ? item.op : undefined,
                value:
                    typeof item.value === 'number' && Number.isFinite(item.value)
                        ? item.value
                        : undefined,
                direction,
                target:
                    item.target === 'close' ||
                    (typeof item.target === 'number' &&
                        Number.isFinite(item.target))
                        ? (item.target as number | 'close')
                        : undefined,
                bars:
                    typeof item.bars === 'number' && Number.isFinite(item.bars)
                        ? item.bars
                        : undefined,
                side,
                pct_tolerance:
                    typeof item.pct_tolerance === 'number' &&
                    Number.isFinite(item.pct_tolerance)
                        ? item.pct_tolerance
                        : undefined,
            }
        })
        .filter((item) => item.type.length > 0)
}

function normalizeAlertRule(
    snapshot: QueryDocumentSnapshot
): AlertRuleDocument | null {
    const raw = snapshot.data()
    if (!isRecord(raw)) {
        return null
    }

    const ticker = normalizeString(raw.ticker)
    const filters = normalizeAlertFilters(raw.filters)
    const nextEvaluationAt = normalizeString(raw.nextEvaluationAt)

    if (!ticker || filters.length === 0 || !nextEvaluationAt) {
        return null
    }

    return {
        ticker,
        timeframe: normalizeTimeframe(raw.timeframe),
        logic: normalizeFilterLogic(raw.logic),
        filters,
        status: raw.status === 'paused' ? 'paused' : 'active',
        lastMatchState:
            typeof raw.lastMatchState === 'boolean' ? raw.lastMatchState : null,
        lastTriggeredAt:
            typeof raw.lastTriggeredAt === 'string' ? raw.lastTriggeredAt : null,
        lastEvaluatedAt:
            typeof raw.lastEvaluatedAt === 'string' ? raw.lastEvaluatedAt : null,
        nextEvaluationAt,
        createdAt:
            typeof raw.createdAt === 'string'
                ? raw.createdAt
                : new Date().toISOString(),
        updatedAt:
            typeof raw.updatedAt === 'string'
                ? raw.updatedAt
                : new Date().toISOString(),
    }
}

function normalizeNewsAlertSentiment(
    value: unknown
): NewsAlertSentiment | null {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim().toUpperCase()
    if (normalized === 'NÖTR') {
        return 'NOTR'
    }

    return NEWS_ALERT_SENTIMENT_VALUES.has(normalized as NewsAlertSentiment)
        ? (normalized as NewsAlertSentiment)
        : null
}

function normalizeNewsAlertSentiments(value: unknown): NewsAlertSentiment[] {
    if (!Array.isArray(value)) {
        return []
    }

    const sentiments: NewsAlertSentiment[] = []
    const seen = new Set<NewsAlertSentiment>()

    value.forEach((item) => {
        const normalized = normalizeNewsAlertSentiment(item)
        if (!normalized || seen.has(normalized)) {
            return
        }

        seen.add(normalized)
        sentiments.push(normalized)
    })

    return sentiments
}

function normalizeNewsAlertRule(
    snapshot: QueryDocumentSnapshot
): WatchlistNewsAlertRuleDocument | null {
    const raw = snapshot.data()
    if (!isRecord(raw)) {
        return null
    }

    const sentiments = normalizeNewsAlertSentiments(raw.sentiments)
    if (sentiments.length === 0) {
        return null
    }

    const nowIso = new Date().toISOString()

    return {
        status: raw.status === 'paused' ? 'paused' : 'active',
        scopeType: raw.scopeType === 'watchlist' ? 'watchlist' : 'watchlist',
        sentiments,
        burstWindowMinutes:
            typeof raw.burstWindowMinutes === 'number' &&
            Number.isFinite(raw.burstWindowMinutes) &&
            raw.burstWindowMinutes > 0
                ? raw.burstWindowMinutes
                : NEWS_ALERT_BURST_WINDOW_MINUTES,
        lastCheckedAt:
            typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : null,
        lastTriggeredAt:
            typeof raw.lastTriggeredAt === 'string' ? raw.lastTriggeredAt : null,
        lastEvaluatedAt:
            typeof raw.lastEvaluatedAt === 'string'
                ? raw.lastEvaluatedAt
                : null,
        createdAt:
            typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
        updatedAt:
            typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
    }
}

function normalizeNotificationPreferences(
    value: unknown
): NotificationPreferenceState {
    if (!isRecord(value)) {
        return DEFAULT_NOTIFICATION_PREFERENCES
    }

    return {
        pushEnabled:
            typeof value.pushEnabled === 'boolean'
                ? value.pushEnabled
                : DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
        priceAlerts:
            typeof value.priceAlerts === 'boolean'
                ? value.priceAlerts
                : DEFAULT_NOTIFICATION_PREFERENCES.priceAlerts,
        indicatorAlerts:
            typeof value.indicatorAlerts === 'boolean'
                ? value.indicatorAlerts
                : DEFAULT_NOTIFICATION_PREFERENCES.indicatorAlerts,
        newsAlerts:
            typeof value.newsAlerts === 'boolean'
                ? value.newsAlerts
                : DEFAULT_NOTIFICATION_PREFERENCES.newsAlerts,
        newsDigest:
            typeof value.newsDigest === 'boolean'
                ? value.newsDigest
                : DEFAULT_NOTIFICATION_PREFERENCES.newsDigest,
    }
}

function normalizeWatchlistState(value: unknown): UserWatchlistState {
    if (!isRecord(value) || !Array.isArray(value.tickers)) {
        return { tickers: [] }
    }

    const tickers: string[] = []
    const seen = new Set<string>()

    value.tickers.forEach((item) => {
        if (typeof item !== 'string') {
            return
        }

        const ticker = item.trim().toUpperCase()
        if (!ticker || seen.has(ticker)) {
            return
        }

        seen.add(ticker)
        tickers.push(ticker)
    })

    return { tickers }
}

async function getUserRuntimeState(userId: string): Promise<UserRuntimeState> {
    const userSnapshot = await db.collection('users').doc(userId).get()
    const data = userSnapshot.data()

    if (!data || !isRecord(data)) {
        return {
            preferences: DEFAULT_NOTIFICATION_PREFERENCES,
            watchlist: { tickers: [] },
        }
    }

    const rawPreferences = isRecord(data.preferences) ? data.preferences : null

    return {
        preferences: normalizeNotificationPreferences(
            rawPreferences?.notifications
        ),
        watchlist: normalizeWatchlistState(data.watchlist),
    }
}

function isPriceOnlyRule(filters: AlertFilter[]): boolean {
    return filters.length > 0 && filters.every((filter) => filter.type === 'price')
}

function nextMinuteBoundary(date: Date, intervalMinutes: number): Date {
    const next = new Date(date)
    next.setUTCSeconds(0, 0)
    const remainder = next.getUTCMinutes() % intervalMinutes
    if (remainder !== 0 || next.getTime() <= date.getTime()) {
        next.setUTCMinutes(next.getUTCMinutes() + (intervalMinutes - remainder))
    }
    if (next.getTime() <= date.getTime()) {
        next.setUTCMinutes(next.getUTCMinutes() + intervalMinutes)
    }
    return next
}

function nextHourBoundary(date: Date, intervalHours: number): Date {
    const next = new Date(date)
    next.setUTCMinutes(0, 0, 0)
    const remainder = next.getUTCHours() % intervalHours
    if (remainder !== 0 || next.getTime() <= date.getTime()) {
        next.setUTCHours(next.getUTCHours() + (intervalHours - remainder))
    }
    if (next.getTime() <= date.getTime()) {
        next.setUTCHours(next.getUTCHours() + intervalHours)
    }
    return next
}

function nextDayBoundary(date: Date): Date {
    const next = new Date(date)
    next.setUTCHours(0, 0, 0, 0)
    next.setUTCDate(next.getUTCDate() + 1)
    return next
}

function nextWeekBoundary(date: Date): Date {
    const next = new Date(date)
    next.setUTCHours(0, 0, 0, 0)

    const day = next.getUTCDay()
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day
    next.setUTCDate(next.getUTCDate() + daysUntilNextMonday)
    return next
}

function getNextEvaluationAt(
    filters: AlertFilter[],
    timeframe: ScreenerTimeframe,
    fromDate: Date = new Date()
): string {
    if (isPriceOnlyRule(filters)) {
        return nextMinuteBoundary(fromDate, 1).toISOString()
    }

    switch (timeframe) {
        case '1m':
            return nextMinuteBoundary(fromDate, 1).toISOString()
        case '5m':
            return nextMinuteBoundary(fromDate, 5).toISOString()
        case '15m':
            return nextMinuteBoundary(fromDate, 15).toISOString()
        case '30m':
            return nextMinuteBoundary(fromDate, 30).toISOString()
        case '1h':
            return nextHourBoundary(fromDate, 1).toISOString()
        case '4h':
            return nextHourBoundary(fromDate, 4).toISOString()
        case '1w':
            return nextWeekBoundary(fromDate).toISOString()
        case '1d':
        default:
            return nextDayBoundary(fromDate).toISOString()
    }
}

function describeFilter(filter: AlertFilter): string {
    switch (filter.type) {
        case 'price':
            return `Price ${filter.op ?? ''} ${filter.value ?? ''}`.trim()
        case 'change_pct':
            return `Change ${filter.op ?? ''} ${filter.value ?? ''}%`.trim()
        case 'volume':
            return `Volume ${filter.op ?? ''} ${filter.value ?? ''}`.trim()
        case 'indicator':
            return `${(filter.indicator || 'Indicator').toUpperCase()} ${filter.op ?? ''} ${filter.value ?? ''}`.trim()
        case 'cross':
            return `${(filter.indicator || 'Indicator').toUpperCase()} cross ${filter.direction ?? ''} ${filter.target ?? ''}`.trim()
        case 'high_low':
            return `${filter.bars ?? ''}-bar ${filter.side ?? ''} within ${filter.pct_tolerance ?? ''}%`.trim()
        default:
            return 'Rule condition'
    }
}

function describeFilters(filters: AlertFilter[], logic: FilterLogic): string {
    return filters.map(describeFilter).join(` ${logic} `)
}

function buildNotificationRecord(
    ruleId: string,
    rule: AlertRuleDocument,
    kind: NotificationKind,
    title: string,
    body: string,
    createdAt: string
): NotificationRecord {
    return {
        kind,
        title,
        body,
        ticker: rule.ticker,
        timeframe: rule.timeframe,
        ruleId,
        isRead: false,
        createdAt,
        readAt: null,
        payload: {
            ticker: rule.ticker,
            timeframe: rule.timeframe,
            kind,
        },
    }
}

async function writeNotification(
    userId: string,
    notification: NotificationRecord
): Promise<void> {
    const notificationRef = db
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc()

    await notificationRef.set(notification)
}

function buildNotificationKind(rule: AlertRuleDocument): NotificationKind {
    return isPriceOnlyRule(rule.filters) ? 'price' : 'indicator'
}

async function sendNotificationToDevices(
    userId: string,
    title: string,
    body: string,
    payload: Record<string, string>,
    options?: {
        pushEnabled?: boolean
        url?: string
    }
): Promise<number> {
    if (options?.pushEnabled === false) {
        return 0
    }

    const devicesSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('notification_devices')
        .where('active', '==', true)
        .get()

    const devices = devicesSnapshot.docs
        .map((snapshot) => ({
            id: snapshot.id,
            ref: snapshot.ref,
            data: snapshot.data() as NotificationDeviceRecord,
        }))
        .filter((item) => typeof item.data.token === 'string' && item.data.token)

    if (devices.length === 0) {
        return 0
    }

    const response = await messaging.sendEachForMulticast({
        tokens: devices.map((device) => device.data.token as string),
        data: {
            ...payload,
            title,
            body,
            url: options?.url ?? '/notifications',
        },
        webpush: {
            fcmOptions: {
                link: options?.url ?? '/notifications',
            },
        },
    })

    const batch = db.batch()
    const nowIso = new Date().toISOString()

    response.responses.forEach((result, index) => {
        if (result.success) {
            return
        }

        const errorCode = result.error?.code
        if (!errorCode || !INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
            return
        }

        batch.set(
            devices[index].ref,
            {
                active: false,
                token: null,
                lastSeenAt: nowIso,
            },
            { merge: true }
        )
    })

    await batch.commit()
    return response.successCount
}

function shouldEvaluateMarketRule(
    rule: AlertRuleDocument,
    preferences: NotificationPreferenceState
): boolean {
    if (buildNotificationKind(rule) === 'price') {
        return preferences.priceAlerts
    }

    return preferences.indicatorAlerts
}

function floorWindowStart(date: Date, burstWindowMinutes: number): Date {
    const next = new Date(date)
    next.setUTCSeconds(0, 0)
    const remainder = next.getUTCMinutes() % burstWindowMinutes
    next.setUTCMinutes(next.getUTCMinutes() - remainder)
    return next
}

function getNewsWindowBounds(
    value: string | null,
    burstWindowMinutes: number
): { windowStart: string; windowEnd: string } {
    const source = value ? new Date(value) : new Date()
    const effective = Number.isNaN(source.getTime()) ? new Date() : source
    const windowStart = floorWindowStart(effective, burstWindowMinutes)
    const windowEnd = new Date(windowStart)
    windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + burstWindowMinutes)

    return {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
    }
}

function normalizeNewsApiSentiment(
    value: string | null
): NewsAlertSentiment | null {
    if (typeof value === 'string' && value.trim().toUpperCase() === 'BEKLIYOR') {
        return 'NOTR'
    }

    return normalizeNewsAlertSentiment(value)
}

function buildNewsSummaryBody(matches: WatchlistNewsAlertMatchDocument[]): string {
    const tickers = Array.from(
        new Set(matches.map((item) => item.ticker).filter((item): item is string => Boolean(item)))
    )
    const titles = matches
        .map((item) => item.title.trim())
        .filter((item) => item.length > 0)

    const tickerSummary =
        tickers.length > 0
            ? tickers.slice(0, 3).join(', ')
            : 'Your watchlist'
    const titleSummary = titles.slice(0, 2).join(' | ')

    return titleSummary ? `${tickerSummary}: ${titleSummary}` : tickerSummary
}

function buildNewsNotificationRecord(
    ruleId: string,
    matches: Array<{ id: string; data: WatchlistNewsAlertMatchDocument }>,
    createdAt: string
): NotificationRecord {
    const tickers = Array.from(
        new Set(
            matches
                .map((match) => match.data.ticker)
                .filter((ticker): ticker is string => Boolean(ticker))
        )
    )
    const articleIds = matches.map((match) => match.id)
    const firstWindow = matches[0]?.data
    const count = matches.length

    return {
        kind: 'news',
        title:
            count === 1
                ? '1 new watchlist news item'
                : `${count} new watchlist news items`,
        body: buildNewsSummaryBody(matches.map((match) => match.data)),
        ticker: tickers[0] ?? null,
        timeframe: null,
        ruleId,
        isRead: false,
        createdAt,
        readAt: null,
        payload: {
            articleIds,
            tickers,
            count,
            windowStart: firstWindow?.windowStart ?? createdAt,
            windowEnd: firstWindow?.windowEnd ?? createdAt,
            kind: 'news',
        },
    }
}

function getNewsNotificationUrl(tickers: string[]): string {
    if (tickers.length === 0) {
        return '/news'
    }

    const params = new URLSearchParams({
        symbols: tickers.join(','),
    })

    return `/news?${params.toString()}`
}

async function runScreenerScan(rule: AlertRuleDocument): Promise<ScreenerScanResponse> {
    const baseUrl =
        process.env.EVALON_SCREENER_API_URL || process.env.EVALON_API_BASE_URL

    if (!baseUrl) {
        throw new Error('EVALON_SCREENER_API_URL or EVALON_API_BASE_URL is required')
    }

    const response = await fetch(`${baseUrl}/v1/screener/scan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tickers: [rule.ticker],
            timeframe: rule.timeframe,
            filters: rule.filters,
            logic: rule.logic,
            limit: 1,
            sort_by: 'ticker',
            sort_dir: 'asc',
        }),
    })

    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Screener scan failed (${response.status}): ${detail}`)
    }

    return (await response.json()) as ScreenerScanResponse
}

async function fetchNewsPage(params: {
    symbols: string[]
    publishedAfter?: string | null
    page: number
    limit: number
}): Promise<NewsApiResponse> {
    const baseUrl =
        process.env.EVALON_SCREENER_API_URL || process.env.EVALON_API_BASE_URL

    if (!baseUrl) {
        throw new Error('EVALON_SCREENER_API_URL or EVALON_API_BASE_URL is required')
    }

    const url = new URL('/v1/news', baseUrl)
    url.searchParams.set('symbols', params.symbols.join(','))
    url.searchParams.set('limit', String(params.limit))
    url.searchParams.set('page', String(params.page))

    if (params.publishedAfter) {
        url.searchParams.set('published_after', params.publishedAfter)
    }

    const response = await fetch(url.toString(), {
        headers: {
            Accept: 'application/json',
        },
    })

    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`News fetch failed (${response.status}): ${detail}`)
    }

    return (await response.json()) as NewsApiResponse
}

async function fetchNewsItems(params: {
    symbols: string[]
    publishedAfter?: string | null
    limitPerPage?: number
    maxPages?: number
}): Promise<NewsApiItem[]> {
    const limitPerPage = params.limitPerPage ?? 100
    const maxPages = params.maxPages ?? 5
    const items: NewsApiItem[] = []

    for (let page = 1; page <= maxPages; page += 1) {
        const response = await fetchNewsPage({
            symbols: params.symbols,
            publishedAfter: params.publishedAfter,
            page,
            limit: limitPerPage,
        })

        const pageItems = Array.isArray(response.items) ? response.items : []
        items.push(...pageItems)

        if (pageItems.length < limitPerPage) {
            break
        }
    }

    return items
}

async function evaluateRuleSnapshot(snapshot: QueryDocumentSnapshot): Promise<void> {
    const rule = normalizeAlertRule(snapshot)
    if (!rule || rule.status !== 'active') {
        return
    }

    const userId = snapshot.ref.parent.parent?.id
    if (!userId) {
        return
    }

    const nowIso = new Date().toISOString()

    try {
        const userState = await getUserRuntimeState(userId)
        if (!shouldEvaluateMarketRule(rule, userState.preferences)) {
            await snapshot.ref.set(
                {
                    lastEvaluatedAt: nowIso,
                    nextEvaluationAt: getNextEvaluationAt(rule.filters, rule.timeframe),
                    updatedAt: nowIso,
                },
                { merge: true }
            )
            return
        }

        const response = await runScreenerScan(rule)
        const matchedRow = (response.rows || []).find(
            (row) => row.ticker === rule.ticker
        )
        const didMatch = Boolean(
            matchedRow ||
                (typeof response.matched === 'number' && response.matched > 0)
        )
        const shouldNotify = didMatch && rule.lastMatchState !== true

        if (shouldNotify) {
            const matchedSummary =
                matchedRow?.matched_filters?.join(
                    ` ${rule.logic} `
                ) || describeFilters(rule.filters, rule.logic)
            const kind = buildNotificationKind(rule)
            const title =
                kind === 'price'
                    ? `${rule.ticker} price rule matched`
                    : `${rule.ticker} indicator rule matched`
            const body = matchedRow?.close
                ? `${matchedSummary} | Close: ${matchedRow.close}`
                : matchedSummary

            await writeNotification(
                userId,
                buildNotificationRecord(snapshot.id, rule, kind, title, body, nowIso)
            )

            await sendNotificationToDevices(userId, title, body, {
                ticker: rule.ticker,
                timeframe: rule.timeframe,
                ruleId: snapshot.id,
                kind,
            }, {
                pushEnabled: userState.preferences.pushEnabled,
                url: '/notifications',
            })

            await snapshot.ref.set(
                {
                    lastMatchState: true,
                    lastTriggeredAt: nowIso,
                    lastEvaluatedAt: nowIso,
                    nextEvaluationAt: getNextEvaluationAt(
                        rule.filters,
                        rule.timeframe
                    ),
                    updatedAt: nowIso,
                },
                { merge: true }
            )

            return
        }

        await snapshot.ref.set(
            {
                lastMatchState: didMatch,
                lastEvaluatedAt: nowIso,
                nextEvaluationAt: getNextEvaluationAt(rule.filters, rule.timeframe),
                updatedAt: nowIso,
            },
            { merge: true }
        )
    } catch (error) {
        logger.error('Alert rule evaluation failed', {
            ruleId: snapshot.id,
            userId,
            error: error instanceof Error ? error.message : String(error),
        })

        await snapshot.ref.set(
            {
                lastEvaluatedAt: nowIso,
                nextEvaluationAt: getNextEvaluationAt(rule.filters, rule.timeframe),
                updatedAt: nowIso,
            },
            { merge: true }
        )
    }
}

async function evaluateNewsRuleSnapshot(
    snapshot: QueryDocumentSnapshot
): Promise<void> {
    const rule = normalizeNewsAlertRule(snapshot)
    if (!rule || rule.status !== 'active') {
        return
    }

    const userId = snapshot.ref.parent.parent?.id
    if (!userId) {
        return
    }

    const nowIso = new Date().toISOString()

    try {
        const userState = await getUserRuntimeState(userId)
        const watchlistTickers = userState.watchlist.tickers

        if (!userState.preferences.newsAlerts || watchlistTickers.length === 0) {
            await snapshot.ref.set(
                {
                    lastCheckedAt: nowIso,
                    lastEvaluatedAt: nowIso,
                    updatedAt: nowIso,
                },
                { merge: true }
            )
            return
        }

        const items = await fetchNewsItems({
            symbols: watchlistTickers,
            publishedAfter: rule.lastCheckedAt,
        })

        for (const item of items) {
            const sentiment = normalizeNewsApiSentiment(item.sentiment)
            if (!sentiment || !rule.sentiments.includes(sentiment)) {
                continue
            }

            const articleId = String(item.id)
            const matchRef = snapshot.ref.collection('matches').doc(articleId)
            const existingMatch = await matchRef.get()

            if (existingMatch.exists) {
                continue
            }

            const bounds = getNewsWindowBounds(
                item.published_at,
                rule.burstWindowMinutes
            )

            await matchRef.set({
                ticker: item.symbol ? item.symbol.trim().toUpperCase() : null,
                title: item.title || 'Watchlist news item',
                sentiment,
                publishedAt: item.published_at,
                windowStart: bounds.windowStart,
                windowEnd: bounds.windowEnd,
                status: 'pending',
                deliveredAt: null,
            } satisfies WatchlistNewsAlertMatchDocument)
        }

        const pendingSnapshot = await snapshot.ref
            .collection('matches')
            .where('status', '==', 'pending')
            .where('windowEnd', '<=', nowIso)
            .orderBy('windowEnd', 'asc')
            .get()

        const groupedMatches = new Map<
            string,
            Array<{ id: string; data: WatchlistNewsAlertMatchDocument }>
        >()

        pendingSnapshot.docs.forEach((pendingDoc) => {
            const data = pendingDoc.data() as WatchlistNewsAlertMatchDocument
            const groupKey = `${data.windowStart}::${data.windowEnd}`
            const current = groupedMatches.get(groupKey) ?? []
            current.push({
                id: pendingDoc.id,
                data,
            })
            groupedMatches.set(groupKey, current)
        })

        let lastTriggeredAt = rule.lastTriggeredAt

        for (const [, matches] of groupedMatches) {
            if (matches.length === 0) {
                continue
            }

            const notification = buildNewsNotificationRecord(
                snapshot.id,
                matches,
                nowIso
            )
            const tickers = Array.from(
                new Set(
                    matches
                        .map((match) => match.data.ticker)
                        .filter((ticker): ticker is string => Boolean(ticker))
                )
            )

            await writeNotification(userId, notification)
            await sendNotificationToDevices(
                userId,
                notification.title,
                notification.body,
                {
                    kind: 'news',
                    ruleId: snapshot.id,
                    count: String(matches.length),
                    tickers: tickers.join(','),
                },
                {
                    pushEnabled: userState.preferences.pushEnabled,
                    url: getNewsNotificationUrl(tickers),
                }
            )

            const batch = db.batch()
            matches.forEach((match) => {
                batch.set(
                    snapshot.ref.collection('matches').doc(match.id),
                    {
                        status: 'delivered',
                        deliveredAt: nowIso,
                    },
                    { merge: true }
                )
            })
            await batch.commit()
            lastTriggeredAt = nowIso
        }

        await snapshot.ref.set(
            {
                lastCheckedAt: nowIso,
                lastTriggeredAt,
                lastEvaluatedAt: nowIso,
                updatedAt: nowIso,
            },
            { merge: true }
        )
    } catch (error) {
        logger.error('News alert rule evaluation failed', {
            ruleId: snapshot.id,
            userId,
            error: error instanceof Error ? error.message : String(error),
        })

        await snapshot.ref.set(
            {
                lastCheckedAt: nowIso,
                lastEvaluatedAt: nowIso,
                updatedAt: nowIso,
            },
            { merge: true }
        )
    }
}

export const registerDevice = onCall<RegisterDevicePayload>(
    {
        cors: true,
    },
    async (request) => {
        const userId = request.auth?.uid
        if (!userId) {
            throw new HttpsError('unauthenticated', 'Authentication is required.')
        }

        const payload = request.data
        const deviceKey = normalizeString(payload.deviceKey)
        const browser = normalizeString(payload.browser)
        const platform = normalizeString(payload.platform)
        const permission =
            typeof payload.permission === 'string' &&
            PERMISSION_VALUES.has(payload.permission as NotificationDevicePermission)
                ? (payload.permission as NotificationDevicePermission)
                : null

        if (!deviceKey || !browser || !platform || !permission) {
            throw new HttpsError('invalid-argument', 'Device payload is invalid.')
        }

        const token =
            typeof payload.token === 'string' && payload.token.trim().length > 0
                ? payload.token.trim()
                : null
        const active = payload.active === true && token !== null && permission === 'granted'
        const lastSeenAt = new Date().toISOString()

        await db
            .collection('users')
            .doc(userId)
            .collection('notification_devices')
            .doc(deviceKey)
            .set(
                {
                    token,
                    permission,
                    browser,
                    platform,
                    active,
                    lastSeenAt,
                } satisfies NotificationDeviceRecord,
                { merge: true }
            )

        return {
            deviceId: deviceKey,
            active,
        }
    }
)

export const sendTestNotification = onCall<Record<string, never>>(
    {
        cors: true,
    },
    async (request) => {
        const userId = request.auth?.uid
        if (!userId) {
            throw new HttpsError('unauthenticated', 'Authentication is required.')
        }

        const title = 'Test notification'
        const body = 'Push delivery is configured for this browser.'
        const delivered = await sendNotificationToDevices(userId, title, body, {
            kind: 'system',
            ruleId: '',
            ticker: '',
            timeframe: '',
        })

        if (delivered < 1) {
            throw new HttpsError(
                'failed-precondition',
                'No active browser device is available for test delivery.'
            )
        }

        await writeNotification(
            userId,
            {
                kind: 'system',
                title,
                body,
                ticker: null,
                timeframe: null,
                ruleId: null,
                isRead: false,
                createdAt: new Date().toISOString(),
                readAt: null,
                payload: {
                    kind: 'system',
                },
            }
        )

        return {
            success: true,
            delivered,
        }
    }
)

export const evaluateAlertRules = onSchedule(
    {
        schedule: '* * * * *',
        timeZone: 'UTC',
    },
    async () => {
        const nowIso = new Date().toISOString()
        const snapshot = await db
            .collectionGroup('alert_rules')
            .where('status', '==', 'active')
            .where('nextEvaluationAt', '<=', nowIso)
            .orderBy('nextEvaluationAt', 'asc')
            .limit(100)
            .get()

        for (const ruleSnapshot of snapshot.docs) {
            await evaluateRuleSnapshot(ruleSnapshot)
        }
    }
)

export const evaluateNewsAlertRules = onSchedule(
    {
        schedule: '* * * * *',
        timeZone: 'UTC',
    },
    async () => {
        const snapshot = await db
            .collectionGroup('news_alert_rules')
            .where('status', '==', 'active')
            .limit(100)
            .get()

        for (const ruleSnapshot of snapshot.docs) {
            await evaluateNewsRuleSnapshot(ruleSnapshot)
        }
    }
)
