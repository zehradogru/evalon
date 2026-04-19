'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CommunityFeedFilter } from '@/types'

interface CommunityFilterBarProps {
    filter: CommunityFeedFilter
    activeTicker?: string | null
    onFilterChange: (filter: CommunityFeedFilter) => void
    onClearTicker: () => void
    requiresAuth: boolean
}

const FILTERS: Array<{
    value: CommunityFeedFilter
    label: string
    description: string
}> = [
    { value: 'all', label: 'All', description: 'Latest ideas across the full feed' },
    { value: 'saved', label: 'Saved', description: 'Posts you kept for later review' },
    { value: 'mine', label: 'Mine', description: 'Your own trail of published notes' },
]

export function CommunityFilterBar({
    filter,
    activeTicker,
    onFilterChange,
    onClearTicker,
    requiresAuth,
}: CommunityFilterBarProps) {
    const activeFilter = FILTERS.find((item) => item.value === filter) ?? FILTERS[0]

    return (
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                        Feed lens
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {requiresAuth
                            ? 'Saved and Mine require an authenticated session.'
                            : activeFilter.description}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-1">
                        {FILTERS.map((item) => (
                            <Button
                                key={item.value}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'rounded-full px-4 text-sm',
                                    filter === item.value &&
                                        'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                                )}
                                onClick={() => onFilterChange(item.value)}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>

                    {activeTicker ? (
                        <Badge
                            className="cursor-pointer rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
                            onClick={onClearTicker}
                        >
                            ${activeTicker} ×
                        </Badge>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
