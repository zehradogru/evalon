import type { MarketDataMeta } from '@/types'

export interface MarketQueryStatus extends MarketDataMeta {
    isInitialLoading: boolean
    isBackgroundRefreshing: boolean
    isDegraded: boolean
    isWarming: boolean
    isStale: boolean
    isPartial: boolean
    errorMessage?: string
}

type MaybeStatusError = Error & { status?: number }

const DEFAULT_META: MarketDataMeta = {
    stale: false,
    warming: false,
    partial: false,
    hasUsableData: false,
    source: 'empty',
    snapshotAgeMs: null,
}

export function normalizeMarketDataMeta(
    meta?: Partial<MarketDataMeta> | null,
    fallback?: Partial<MarketDataMeta>
): MarketDataMeta {
    return {
        ...DEFAULT_META,
        ...(fallback || {}),
        ...(meta || {}),
    }
}

export function buildMarketQueryStatus({
    meta,
    hasUsableData,
    isLoading,
    isFetching,
    error,
}: {
    meta?: Partial<MarketDataMeta> | null
    hasUsableData: boolean
    isLoading: boolean
    isFetching: boolean
    error: unknown
}): MarketQueryStatus {
    const normalized = normalizeMarketDataMeta(meta, {
        hasUsableData,
        source: hasUsableData ? 'live' : 'empty',
    })

    const errorMessage =
        error instanceof Error
            ? error.message
            : normalized.message

    return {
        ...normalized,
        hasUsableData: normalized.hasUsableData || hasUsableData,
        isInitialLoading: isLoading && !normalized.hasUsableData && !hasUsableData,
        isBackgroundRefreshing: isFetching && (normalized.hasUsableData || hasUsableData),
        isDegraded:
            normalized.stale ||
            normalized.partial ||
            normalized.source === 'error',
        isWarming: normalized.warming,
        isStale: normalized.stale,
        isPartial: normalized.partial,
        errorMessage,
    }
}

export function isRetriableMarketError(error: unknown): boolean {
    const status = (error as MaybeStatusError | undefined)?.status
    if (typeof status !== 'number') return true
    return status >= 500 || status === 429 || status === 408
}
