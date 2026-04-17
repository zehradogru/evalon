import type { Timeframe } from '@/types'

export const DEFAULT_EVALON_API_URL =
    'https://evalon-backtest-api-474112640179.europe-west1.run.app'
export const DEFAULT_EVALON_GRAPH_WEB_URL =
    'https://evalon-graph-web-474112640179.europe-west1.run.app'
export const EVALON_GRAPH_WEB_URL =
    process.env.NEXT_PUBLIC_EVALON_GRAPH_WEB_URL ||
    DEFAULT_EVALON_GRAPH_WEB_URL

const GRAPH_WEB_TIMEFRAME_ALIASES: Record<string, string> = {
    '1g': '1d',
    '1mo': '1M',
}

const GRAPH_WEB_SUPPORTED_TIMEFRAMES = new Set([
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '2h',
    '4h',
    '6h',
    '12h',
    '1d',
    '1w',
    '1M',
])

export const EVALON_SUPPORTED_TIMEFRAMES: Timeframe[] = [
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '2h',
    '4h',
    '6h',
    '12h',
    '1d',
    '1g',
    '1w',
    '1M',
    '1mo',
]

export function getRecentFetchParams(
    timeframe: Timeframe | string,
    requestedLimit: number
): { start: string; fetchLimit: number } {
    const now = new Date()
    let daysBack = 30
    let fetchLimit = Math.max(requestedLimit, 100)

    switch (timeframe) {
        case '1m':
            daysBack = 3
            fetchLimit = Math.max(requestedLimit, 1500)
            break
        case '3m':
            daysBack = 5
            fetchLimit = Math.max(requestedLimit, 1000)
            break
        case '5m':
            daysBack = 7
            fetchLimit = Math.max(requestedLimit, 500)
            break
        case '15m':
            daysBack = 21
            fetchLimit = Math.max(requestedLimit, 500)
            break
        case '30m':
            daysBack = 30
            fetchLimit = Math.max(requestedLimit, 400)
            break
        case '1h':
            daysBack = 30
            fetchLimit = Math.max(requestedLimit, 300)
            break
        case '2h':
            daysBack = 60
            fetchLimit = Math.max(requestedLimit, 300)
            break
        case '4h':
            daysBack = 90
            fetchLimit = Math.max(requestedLimit, 240)
            break
        case '6h':
            daysBack = 120
            fetchLimit = Math.max(requestedLimit, 240)
            break
        case '12h':
            daysBack = 180
            fetchLimit = Math.max(requestedLimit, 220)
            break
        case '1d':
        case '1g':
            daysBack = Math.max(400, requestedLimit + 30)
            fetchLimit = Math.max(requestedLimit, 120)
            break
        case '1w':
            daysBack = Math.max(365 * 3, requestedLimit * 7 + 60)
            fetchLimit = Math.max(requestedLimit, 120)
            break
        case '1M':
        case '1mo':
            daysBack = Math.max(365 * 10, requestedLimit * 31 + 120)
            fetchLimit = Math.max(requestedLimit, 120)
            break
        default:
            daysBack = Math.max(30, requestedLimit + 14)
            fetchLimit = Math.max(requestedLimit, 120)
            break
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return {
        start: startDate.toISOString().split('T')[0],
        fetchLimit,
    }
}

export function formatTimeframeLabel(timeframe: Timeframe | string): string {
    switch (timeframe) {
        case '1m':
        case '3m':
        case '5m':
        case '15m':
        case '30m':
        case '1h':
        case '2h':
        case '4h':
        case '6h':
        case '12h':
        case '1w':
            return String(timeframe)
        case '1d':
        case '1g':
            return '1d'
        case '1M':
        case '1mo':
            return '1M'
        default:
            return String(timeframe)
    }
}

export function toGraphWebTimeframe(timeframe: Timeframe | string): string {
    const normalized =
        GRAPH_WEB_TIMEFRAME_ALIASES[String(timeframe)] || String(timeframe)

    return GRAPH_WEB_SUPPORTED_TIMEFRAMES.has(normalized) ? normalized : '1d'
}

interface BuildGraphWebUrlParams {
    symbol: string
    tf: Timeframe | string
    page?: 'chart' | 'backtest' | 'ai'
}

export function buildGraphWebUrl({
    symbol,
    tf,
    page = 'chart',
}: BuildGraphWebUrlParams): string {
    const url = new URL(`/${page}`, EVALON_GRAPH_WEB_URL)
    const params = new URLSearchParams({
        symbol: symbol.trim().toUpperCase(),
        tf: toGraphWebTimeframe(tf),
    })

    url.search = params.toString()

    return url.toString()
}
