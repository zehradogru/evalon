'use client'

import { Bookmark, Globe, UserCircle2, X } from 'lucide-react'
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
    icon: typeof Globe
    description: string
}> = [
    { value: 'all', label: 'All', icon: Globe, description: 'Latest ideas across the full feed' },
    { value: 'saved', label: 'Saved', icon: Bookmark, description: 'Posts you kept for later review' },
    { value: 'mine', label: 'Mine', icon: UserCircle2, description: 'Your own published notes' },
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
        <section className="animate-fade-in-up animation-delay-100 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Feed lens
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {requiresAuth
                            ? 'Saved and Mine require an authenticated session.'
                            : activeFilter.description}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-xl border border-white/[0.06] bg-black/50 p-1">
                        {FILTERS.map((item) => {
                            const Icon = item.icon
                            const isActive = filter === item.value

                            return (
                                <Button
                                    key={item.value}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        'gap-1.5 rounded-lg px-4 text-sm transition-all duration-300',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-[0_2px_12px_-4px_rgba(40,98,255,0.6)] hover:bg-primary/90 hover:text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                    onClick={() => onFilterChange(item.value)}
                                >
                                    <Icon className="size-3.5" />
                                    {item.label}
                                </Button>
                            )
                        })}
                    </div>

                    {activeTicker ? (
                        <Badge
                            className="group cursor-pointer gap-1.5 rounded-lg border-0 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-all duration-300 hover:bg-primary/20"
                            onClick={onClearTicker}
                        >
                            ${activeTicker}
                            <X className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
                        </Badge>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
