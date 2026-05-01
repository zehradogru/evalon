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
type NotificationDevicePermission =
    | 'default'
    | 'denied'
    | 'granted'
    | 'unsupported'

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
    payload: Record<string, string | number | boolean | null> | null
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
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
    'messaging/invalid-recipient',
])

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
    payload: Record<string, string>
): Promise<number> {
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
            url: '/notifications',
        },
        webpush: {
            fcmOptions: {
                link: '/notifications',
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
