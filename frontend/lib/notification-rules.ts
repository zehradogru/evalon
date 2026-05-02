import {
    BIST_AVAILABLE,
    CRYPTO_TICKERS,
    FOREX_TICKERS,
    NASDAQ_TICKERS,
} from '@/config/markets'
import type {
    ChangePctFilter,
    CrossFilter,
    FilterLogic,
    HighLowFilter,
    IndicatorFilter,
    NumericOp,
    PriceFilter,
    ScreenerFilter,
    ScreenerTimeframe,
    VolumeFilter,
} from '@/types/screener'

export const ALERT_RULE_MAX_ITEMS = 50
export const ALERT_RULE_MAX_FILTERS = 5

export const SUPPORTED_ALERT_TICKERS = Array.from(
    new Set([
        'XU100',
        'XU030',
        ...BIST_AVAILABLE,
        ...NASDAQ_TICKERS.map((item) => item.ticker),
        ...CRYPTO_TICKERS.map((item) => item.ticker),
        ...FOREX_TICKERS.map((item) => item.ticker),
    ])
).sort((left, right) => left.localeCompare(right))

export const SUPPORTED_ALERT_TICKER_SET = new Set(SUPPORTED_ALERT_TICKERS)

const NUMERIC_OPS = new Set<NumericOp>([
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'eq',
])
const ALERT_TIMEFRAMES = new Set<ScreenerTimeframe>([
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '1d',
    '1w',
])

export type AlertRuleCadence = 'minute' | 'timeframe-close'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
    }
    return value
}

function normalizePositiveNumber(value: unknown): number | null {
    const normalized = normalizeNumber(value)
    return normalized !== null && normalized > 0 ? normalized : null
}

function normalizeInteger(
    value: unknown,
    min: number,
    max: number
): number | null {
    const normalized = normalizeNumber(value)
    if (normalized === null) return null
    const rounded = Math.round(normalized)
    if (rounded < min || rounded > max) return null
    return rounded
}

function normalizeNumericOp(value: unknown): NumericOp | null {
    return typeof value === 'string' && NUMERIC_OPS.has(value as NumericOp)
        ? (value as NumericOp)
        : null
}

function normalizeBetweenValue2(
    op: NumericOp,
    value: number,
    value2: unknown
): number | undefined {
    if (op !== 'between') return undefined
    const normalized = normalizeNumber(value2)
    if (normalized === null || normalized <= value) return undefined
    return normalized
}

function normalizeIndicatorParams(
    value: unknown
): Record<string, number | string> | undefined {
    if (!isRecord(value)) return undefined

    const entries = Object.entries(value).reduce<Record<string, number | string>>(
        (accumulator, [key, rawValue]) => {
            const normalizedKey = normalizeString(key)
            if (!normalizedKey) return accumulator

            if (typeof rawValue === 'string' && rawValue.trim()) {
                accumulator[normalizedKey] = rawValue.trim()
                return accumulator
            }

            if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
                accumulator[normalizedKey] = rawValue
            }

            return accumulator
        },
        {}
    )

    return Object.keys(entries).length > 0 ? entries : undefined
}

function normalizePriceFilter(rawValue: unknown): PriceFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'price') return null
    const op = normalizeNumericOp(rawValue.op)
    const value = normalizePositiveNumber(rawValue.value)
    if (!op || value === null) return null

    return {
        type: 'price',
        op,
        value,
        value2: normalizeBetweenValue2(op, value, rawValue.value2),
    }
}

function normalizeVolumeFilter(rawValue: unknown): VolumeFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'volume') return null
    const op = normalizeNumericOp(rawValue.op)
    const value = normalizeNumber(rawValue.value)
    if (!op || value === null || value < 0) return null

    return {
        type: 'volume',
        op,
        value,
        value2: normalizeBetweenValue2(op, value, rawValue.value2),
        relative: rawValue.relative === true,
    }
}

function normalizeChangePctFilter(rawValue: unknown): ChangePctFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'change_pct') return null
    const op = normalizeNumericOp(rawValue.op)
    const value = normalizeNumber(rawValue.value)
    if (!op || value === null) return null

    return {
        type: 'change_pct',
        op,
        value,
        value2: normalizeBetweenValue2(op, value, rawValue.value2),
    }
}

function normalizeIndicatorFilter(rawValue: unknown): IndicatorFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'indicator') return null
    const indicator = normalizeString(rawValue.indicator)
    const op = normalizeNumericOp(rawValue.op)
    const value = normalizeNumber(rawValue.value)
    if (!indicator || !op || value === null) return null

    const outputKey = normalizeString(rawValue.output_key) ?? 'value'

    return {
        type: 'indicator',
        indicator,
        params: normalizeIndicatorParams(rawValue.params),
        output_key: outputKey,
        op,
        value,
        value2: normalizeBetweenValue2(op, value, rawValue.value2),
    }
}

function normalizeCrossFilter(rawValue: unknown): CrossFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'cross') return null
    const indicator = normalizeString(rawValue.indicator)
    const direction =
        rawValue.direction === 'above' || rawValue.direction === 'below'
            ? rawValue.direction
            : null

    if (!indicator || !direction) return null

    const target =
        rawValue.target === 'close'
            ? 'close'
            : normalizeNumber(rawValue.target)
    if (target === null) return null

    return {
        type: 'cross',
        indicator,
        params: normalizeIndicatorParams(rawValue.params),
        output_key: normalizeString(rawValue.output_key) ?? 'value',
        direction,
        target,
        bars: normalizeInteger(rawValue.bars, 1, 10) ?? 1,
    }
}

function normalizeHighLowFilter(rawValue: unknown): HighLowFilter | null {
    if (!isRecord(rawValue) || rawValue.type !== 'high_low') return null
    const side =
        rawValue.side === 'high' || rawValue.side === 'low'
            ? rawValue.side
            : null
    const bars = normalizeInteger(rawValue.bars, 2, 500)
    const pctTolerance = normalizeNumber(rawValue.pct_tolerance)
    if (!side || bars === null || pctTolerance === null) return null
    if (pctTolerance < 0 || pctTolerance >= 100) return null

    return {
        type: 'high_low',
        side,
        bars,
        pct_tolerance: pctTolerance,
    }
}

export function normalizeAlertRuleFilters(rawValue: unknown): ScreenerFilter[] {
    if (!Array.isArray(rawValue)) return []

    const filters: ScreenerFilter[] = []

    for (const item of rawValue) {
        const normalized =
            normalizePriceFilter(item) ??
            normalizeVolumeFilter(item) ??
            normalizeChangePctFilter(item) ??
            normalizeIndicatorFilter(item) ??
            normalizeCrossFilter(item) ??
            normalizeHighLowFilter(item)

        if (!normalized) continue
        if (filters.length >= ALERT_RULE_MAX_FILTERS) break
        filters.push(normalized)
    }

    return filters
}

export function normalizeAlertLogic(value: unknown): FilterLogic {
    return value === 'OR' ? 'OR' : 'AND'
}

export function normalizeAlertTimeframe(value: unknown): ScreenerTimeframe {
    return typeof value === 'string' && ALERT_TIMEFRAMES.has(value as ScreenerTimeframe)
        ? (value as ScreenerTimeframe)
        : '1d'
}

export function isSupportedAlertTicker(ticker: string): boolean {
    return SUPPORTED_ALERT_TICKER_SET.has(ticker.trim().toUpperCase())
}

export function normalizeAlertTicker(ticker: string): string {
    return ticker.trim().toUpperCase()
}

export function isPriceOnlyFilters(filters: ScreenerFilter[]): boolean {
    return filters.length > 0 && filters.every((filter) => filter.type === 'price')
}

export function getAlertRuleCadence(
    filters: ScreenerFilter[],
    timeframe: ScreenerTimeframe
): { kind: AlertRuleCadence; label: string } {
    if (isPriceOnlyFilters(filters)) {
        return {
            kind: 'minute',
            label: 'Every minute',
        }
    }

    return {
        kind: 'timeframe-close',
        label: `At ${timeframe} close`,
    }
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

export function getNextEvaluationAt(
    filters: ScreenerFilter[],
    timeframe: ScreenerTimeframe,
    fromDate: Date = new Date()
): string {
    let next: Date

    if (isPriceOnlyFilters(filters)) {
        next = nextMinuteBoundary(fromDate, 1)
        return next.toISOString()
    }

    switch (timeframe) {
        case '1m':
            next = nextMinuteBoundary(fromDate, 1)
            break
        case '5m':
            next = nextMinuteBoundary(fromDate, 5)
            break
        case '15m':
            next = nextMinuteBoundary(fromDate, 15)
            break
        case '30m':
            next = nextMinuteBoundary(fromDate, 30)
            break
        case '1h':
            next = nextHourBoundary(fromDate, 1)
            break
        case '4h':
            next = nextHourBoundary(fromDate, 4)
            break
        case '1w':
            next = nextWeekBoundary(fromDate)
            break
        case '1d':
        default:
            next = nextDayBoundary(fromDate)
            break
    }

    return next.toISOString()
}

export function describeScreenerFilter(filter: ScreenerFilter): string {
    switch (filter.type) {
        case 'price':
            return `Price ${filter.op} ${filter.value}`
        case 'change_pct':
            return `Change ${filter.op} ${filter.value}%`
        case 'volume':
            return filter.relative
                ? `Volume ${filter.op} ${filter.value}x avg`
                : `Volume ${filter.op} ${filter.value}`
        case 'indicator': {
            const period = filter.params?.period
            const suffix = period ? `(${period})` : ''
            return `${filter.indicator.toUpperCase()}${suffix} ${filter.op} ${filter.value}`
        }
        case 'cross':
            return `${filter.indicator.toUpperCase()} cross ${filter.direction} ${filter.target}`
        case 'high_low':
            return `${filter.bars}-bar ${filter.side} within ${filter.pct_tolerance}%`
        default:
            return 'Rule condition'
    }
}

export function describeAlertRuleFilters(
    filters: ScreenerFilter[],
    logic: FilterLogic
): string {
    return filters.map(describeScreenerFilter).join(` ${logic} `)
}
