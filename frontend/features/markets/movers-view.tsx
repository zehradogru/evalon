'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Flame,
    Snowflake,
    Activity,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    ArrowUpRight,
    BarChart2,
} from 'lucide-react'
import { useMarketMovers, type DashboardTicker } from '@/hooks/use-dashboard-data'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/50">
            <td className="py-3 pl-4 pr-2 w-8">
                <span className="text-xs text-muted-foreground/40 font-mono">{index + 1}</span>
            </td>
            <td className="py-3 px-2">
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-2.5 w-28" />
                </div>
            </td>
            <td className="py-3 px-2 text-right"><Skeleton className="h-3.5 w-14 ml-auto" /></td>
            <td className="py-3 px-2 text-right"><Skeleton className="h-3.5 w-12 ml-auto" /></td>
            <td className="py-3 px-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-md" /></td>
            <td className="py-3 pl-2 pr-4 text-right hidden sm:table-cell"><Skeleton className="h-3 w-10 ml-auto" /></td>
            <td className="py-3 pl-2 pr-4 hidden md:table-cell w-8" />
        </tr>
    )
}

type Tab = 'gainers' | 'losers' | 'active'

const TABS: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: 'gainers', label: 'Top Gainers', icon: Flame },
    { id: 'losers', label: 'Top Losers', icon: Snowflake },
    { id: 'active', label: 'Most Active (Volume)', icon: Activity },
]

function formatVolume(vol: number | null): string {
    if (!vol) return '—'
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`
    return String(vol)
}

function TableRow({ item, index, onClick }: { item: DashboardTicker; index: number; onClick: () => void }) {
    const isPositive = item.changePercent >= 0
    return (
        <tr
            onClick={onClick}
            className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors group"
        >
            <td className="py-3 pl-4 pr-2 w-8">
                <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
            </td>
            <td className="py-3 px-2">
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.ticker}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {item.name}
                    </span>
                </div>
            </td>
            <td className="py-3 px-2 text-right">
                <span className="text-sm font-medium text-foreground tabular-nums">
                    ₺{item.price.toFixed(2)}
                </span>
            </td>
            <td className="py-3 px-2 text-right">
                <span className={cn("text-sm font-medium tabular-nums", isPositive ? "text-emerald-400" : "text-red-400")}>
                    {isPositive ? '+' : ''}₺{item.change.toFixed(2)}
                </span>
            </td>
            <td className="py-3 px-4 text-right">
                <span
                    className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-md tabular-nums",
                        isPositive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                    )}
                >
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                </span>
            </td>
            <td className="py-3 pl-2 pr-4 text-right hidden sm:table-cell">
                <span className="text-xs text-muted-foreground tabular-nums">{formatVolume(item.vol)}</span>
            </td>
            <td className="py-3 pl-2 pr-4 text-right hidden md:table-cell">
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors ml-auto" />
            </td>
        </tr>
    )
}

export function MoversView() {
    const [activeTab, setActiveTab] = useState<Tab>('gainers')
    const router = useRouter()
    const { data, marketStatus, retryNow } = useMarketMovers()

    const rows = (() => {
        if (!data) return []
        if (activeTab === 'gainers') return [...data.all].sort((a, b) => b.changePercent - a.changePercent).slice(0, 20)
        if (activeTab === 'losers') return [...data.all].sort((a, b) => a.changePercent - b.changePercent).slice(0, 20)
        // active: by volume
        return [...data.all]
            .filter((i) => i.vol !== null && i.vol! > 0)
            .sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0))
            .slice(0, 20)
    })()

    const isLoading = marketStatus.isInitialLoading
    const isError = marketStatus.source === 'error' && !marketStatus.hasUsableData

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <BarChart2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Piyasa Hareketleri</h1>
                        <p className="text-sm text-muted-foreground">BIST — most active stocks of the day</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <MarketDataStatusChip status={marketStatus} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void retryNow()}
                        className="h-8 gap-1.5 text-xs"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Yenile
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-border">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all",
                                isActive
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {isError && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
                        <p className="text-sm text-muted-foreground">
                            {marketStatus.errorMessage || 'Market data temporarily unavailable.'}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => void retryNow()}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Tekrar Dene
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/20 text-left">
                                    <th className="py-2.5 pl-4 pr-2 w-8 text-[11px] font-medium text-muted-foreground">#</th>
                                    <th className="py-2.5 px-2 text-[11px] font-medium text-muted-foreground">Stock</th>
                                    <th className="py-2.5 px-2 text-right text-[11px] font-medium text-muted-foreground">Price</th>
                                    <th className="py-2.5 px-2 text-right text-[11px] font-medium text-muted-foreground">Change ₺</th>
                                    <th className="py-2.5 px-4 text-right text-[11px] font-medium text-muted-foreground">Change %</th>
                                    <th className="py-2.5 pl-2 pr-4 text-right text-[11px] font-medium text-muted-foreground hidden sm:table-cell">Volume</th>
                                    <th className="py-2.5 pl-2 pr-4 hidden md:table-cell w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading
                                    ? Array.from({ length: 15 }).map((_, i) => (
                                          <SkeletonRow key={i} index={i} />
                                      ))
                                    : rows.length === 0
                                      ? (
                                          <tr>
                                              <td colSpan={7} className="py-24 text-center text-sm text-muted-foreground">
                                                  {marketStatus.isWarming ? 'Loading data...' : 'No data found'}
                                              </td>
                                          </tr>
                                        )
                                      : rows.map((item, i) => (
                                            <TableRow
                                                key={item.ticker}
                                                item={item}
                                                index={i}
                                                onClick={() => router.push(`/markets/${item.ticker}`)}
                                            />
                                        ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
