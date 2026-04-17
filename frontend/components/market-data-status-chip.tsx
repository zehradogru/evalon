'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MarketQueryStatus } from '@/lib/market-data'

interface MarketDataStatusChipProps {
    status?:
        | (Partial<MarketQueryStatus> & {
              isWarming?: boolean
              isStale?: boolean
              isPartial?: boolean
          })
        | null
    className?: string
    labels?: Partial<{
        refreshing: string
        warming: string
        stale: string
        partial: string
        error: string
    }>
}

const DEFAULT_LABELS = {
    refreshing: 'Refreshing',
    warming: 'Starting',
    stale: 'Delayed',
    partial: 'Partial',
    error: 'Issue',
}

export function MarketDataStatusChip({
    status,
    className,
    labels,
}: MarketDataStatusChipProps) {
    if (!status) return null

    const copy = { ...DEFAULT_LABELS, ...(labels || {}) }

    if (status.isBackgroundRefreshing) {
        return (
            <Badge variant="secondary" className={cn('gap-1', className)}>
                {copy.refreshing}
            </Badge>
        )
    }

    if (status.isWarming || status.warming) {
        return (
            <Badge
                variant="outline"
                className={cn('border-primary/30 text-primary', className)}
            >
                {copy.warming}
            </Badge>
        )
    }

    if (status.isStale || status.stale) {
        return (
            <Badge
                variant="outline"
                className={cn('border-amber-500/30 text-amber-500', className)}
            >
                {copy.stale}
            </Badge>
        )
    }

    if (status.isPartial || status.partial) {
        return (
            <Badge
                variant="outline"
                className={cn('border-amber-500/30 text-amber-500', className)}
            >
                {copy.partial}
            </Badge>
        )
    }

    if (status.source === 'error') {
        return (
            <Badge variant="destructive" className={className}>
                {copy.error}
            </Badge>
        )
    }

    return null
}
