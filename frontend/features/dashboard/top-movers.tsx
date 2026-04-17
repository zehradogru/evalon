'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Flame, Snowflake, Loader2, Activity, RefreshCw } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { cn } from '@/lib/utils'
import { useMarketMovers, DashboardTicker } from '@/hooks/use-dashboard-data'

interface MoverCardProps {
    type: 'gainers' | 'losers'
    data: DashboardTicker[]
    isLoading: boolean
    isWarming?: boolean
    isError?: boolean
    message?: string
    onRetry?: () => void
}

function MoverCard({ type, data, isLoading, isWarming, isError, message, onRetry }: MoverCardProps) {
    const router = useRouter()
    const isGainers = type === 'gainers'

    const Icon = isGainers ? Flame : Snowflake
    const TrendIcon = isGainers ? TrendingUp : TrendingDown
    const title = isGainers ? 'Top Gainers' : 'Top Losers'
    const subtitle = isGainers ? 'Best performers today' : 'Biggest drops today'
    const accentColor = isGainers ? '#089981' : '#f23645'
    const bgColor = isGainers ? 'bg-[#089981]/10' : 'bg-[#f23645]/10'

    const handleClick = (ticker: string) => {
        router.push(`/markets/${ticker}`)
    }

    return (
        <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", bgColor)}>
                        <Icon className="h-3.5 w-3.5" style={{ color: accentColor }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-2 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : isError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <span className="text-xs text-muted-foreground">
                            {message || 'Market data is temporarily unavailable.'}
                        </span>
                        <Button size="sm" variant="outline" onClick={onRetry}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Retry
                        </Button>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                        {isWarming ? 'Market data is starting...' : 'No data available'}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {data.map((item, index) => (
                            <div
                                key={item.ticker}
                                onClick={() => handleClick(item.ticker)}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {item.ticker}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                            {item.name}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">
                                        ₺{item.price.toFixed(2)}
                                    </span>
                                    <div
                                        className={cn(
                                            "flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded",
                                            bgColor
                                        )}
                                        style={{ color: accentColor }}
                                    >
                                        <TrendIcon className="h-3 w-3" />
                                        {isGainers ? '+' : ''}{item.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function TopGainers() {
    const { data, marketStatus, retryNow } = useMarketMovers()
    return (
        <MoverCard
            type="gainers"
            data={data?.topGainers || []}
            isLoading={marketStatus.isInitialLoading}
            isWarming={marketStatus.isWarming}
            isError={marketStatus.source === 'error' && !marketStatus.hasUsableData}
            message={marketStatus.errorMessage}
            onRetry={() => void retryNow()}
        />
    )
}

export function TopLosers() {
    const { data, marketStatus, retryNow } = useMarketMovers()
    return (
        <MoverCard
            type="losers"
            data={data?.topLosers || []}
            isLoading={marketStatus.isInitialLoading}
            isWarming={marketStatus.isWarming}
            isError={marketStatus.source === 'error' && !marketStatus.hasUsableData}
            message={marketStatus.errorMessage}
            onRetry={() => void retryNow()}
        />
    )
}

/**
 * Unified Market Movers with Gainers/Losers tabs
 */
export function MarketMovers() {
    const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers')
    const { data, marketStatus, retryNow } = useMarketMovers()
    const router = useRouter()

    const items = activeTab === 'gainers'
        ? (data?.topGainers || [])
        : (data?.topLosers || [])

    const isGainers = activeTab === 'gainers'
    const accentColor = isGainers ? '#089981' : '#f23645'
    const bgColor = isGainers ? 'bg-[#089981]/10' : 'bg-[#f23645]/10'
    const TrendIcon = isGainers ? TrendingUp : TrendingDown

    return (
        <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Market Movers</h3>
                    <MarketDataStatusChip status={marketStatus} />
                </div>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'gainers' | 'losers')}>
                    <TabsList className="bg-secondary/50 p-0.5 h-7">
                        <TabsTrigger
                            value="gainers"
                            className="text-[10px] px-2.5 h-6 data-[state=active]:bg-background data-[state=active]:text-[#089981]"
                        >
                            Gainers
                        </TabsTrigger>
                        <TabsTrigger
                            value="losers"
                            className="text-[10px] px-2.5 h-6 data-[state=active]:bg-background data-[state=active]:text-[#f23645]"
                        >
                            Losers
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex-1 p-2 overflow-y-auto">
                {marketStatus.isInitialLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : marketStatus.source === 'error' && !marketStatus.hasUsableData ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <span className="text-xs text-muted-foreground">
                            {marketStatus.errorMessage || 'Market movers are temporarily unavailable.'}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => void retryNow()}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Retry
                        </Button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                        {marketStatus.isWarming ? 'Market data is starting...' : 'No data available'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {items.map((item, index) => (
                            <div
                                key={item.ticker}
                                onClick={() => router.push(`/markets/${item.ticker}`)}
                                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {item.ticker}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                            {item.name}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">
                                        {item.price.toFixed(2)}
                                    </span>
                                    <div
                                        className={cn(
                                            "flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded",
                                            bgColor
                                        )}
                                        style={{ color: accentColor }}
                                    >
                                        <TrendIcon className="h-3 w-3" />
                                        {isGainers ? '+' : ''}{item.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
