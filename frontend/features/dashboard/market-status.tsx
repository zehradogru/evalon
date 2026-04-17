'use client'

import Link from 'next/link'
import { Clock, CircleDot, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    useBackendHealth,
    useDashboardRefresh,
    useMarketStatus,
} from '@/hooks/use-dashboard-data'
import { useState } from 'react'

export function MarketStatus() {
    const { data: status, isLoading } = useMarketStatus()
    const { data: backendHealth } = useBackendHealth()
    const { refresh } = useDashboardRefresh()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refresh()
        setTimeout(() => setIsRefreshing(false), 1000)
    }

    if (isLoading || !status) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <div className="h-3 w-20 bg-muted-foreground/30 rounded" />
            </div>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Market Status Badge */}
            <div
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                    status.isOpen
                        ? "bg-[#089981]/10 border-[#089981]/30"
                        : "bg-muted/50 border-border"
                )}
            >
                <CircleDot
                    className={cn(
                        "h-3 w-3",
                        status.isOpen ? "text-[#089981] animate-pulse" : "text-muted-foreground"
                    )}
                />
                <div className="flex flex-col">
                    <span
                        className={cn(
                            "text-[11px] font-semibold",
                            status.isOpen ? "text-[#089981]" : "text-muted-foreground"
                        )}
                    >
                        BIST {status.isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                        {status.nextChangeLabel} {status.timeRemaining}
                    </span>
                </div>
            </div>

            {/* Current Time */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="text-[11px] font-medium">{status.currentTime} TR</span>
            </div>

            <div
                className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium',
                    backendHealth?.isHealthy
                        ? 'border-chart-2/30 bg-chart-2/10 text-chart-2'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                )}
            >
                <CircleDot className="h-3 w-3" />
                API {backendHealth?.isHealthy ? 'READY' : 'CHECKING'}
            </div>

            <div className="flex items-center gap-1.5">
                <Link
                    href="/analysis"
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                    Indicator Lab
                </Link>
                <Link
                    href="/backtest"
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                    Backtest
                </Link>
                <Link
                    href="/ai"
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                    Evalon AI
                </Link>
            </div>

            {/* Refresh Button */}
            <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                    "bg-primary/10 text-primary hover:bg-primary/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
            >
                <RefreshCw
                    className={cn("h-3 w-3", isRefreshing && "animate-spin")}
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
        </div>
    )
}
