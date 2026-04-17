'use client'

import { useWatchlist } from '@/hooks/use-prices'
import { MiniChart } from './mini-chart'
import { Button } from '@/components/ui/button'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WatchlistWidget() {
    const { data: watchlist, marketStatus, retryNow } = useWatchlist()

    return (
        <Card className="bg-card border-border hover:border-sidebar-primary/30 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Star className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-medium text-foreground">
                                Watchlist
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Takip ettiğin hisseler
                            </p>
                        </div>
                    </div>
                    <MarketDataStatusChip
                        status={marketStatus}
                        labels={{
                            refreshing: 'Yenileniyor',
                            warming: 'Hazirlaniyor',
                            stale: 'Gecikmeli',
                            partial: 'Kismi veri',
                            error: 'Baglanti sorunu',
                        }}
                    />
                </div>
            </CardHeader>

            <CardContent className="space-y-2 pt-3">
                {marketStatus.isInitialLoading ? (
                    // Loading skeleton
                    [...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 animate-pulse"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-muted/50" />
                                <div>
                                    <div className="w-16 h-4 bg-muted/50 rounded" />
                                    <div className="w-24 h-3 bg-muted/30 rounded mt-1" />
                                </div>
                            </div>
                            <div className="w-20 h-8 bg-muted/30 rounded" />
                        </div>
                    ))
                ) : marketStatus.source === 'error' && !marketStatus.hasUsableData ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <div className="text-destructive text-sm">
                            {marketStatus.errorMessage || 'Veri yüklenemedi'}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void retryNow()}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Tekrar Dene
                        </Button>
                    </div>
                ) : (
                    watchlist?.map((item) => {
                        const isPositive = item.changePercent >= 0

                        return (
                            <div
                                key={item.ticker}
                                className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted/50 transition-all duration-200 cursor-pointer group border border-border/50"
                            >
                                {/* Left: Ticker info */}
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold",
                                        isPositive
                                            ? "bg-chart-2/10 text-chart-2"
                                            : "bg-destructive/10 text-destructive"
                                    )}>
                                        {isPositive ? (
                                            <TrendingUp className="h-4 w-4" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                                            {item.ticker}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                                            {item.name}
                                        </div>
                                    </div>
                                </div>

                                {/* Center: Mini chart */}
                                <div className="hidden sm:block">
                                    <MiniChart
                                        data={item.priceHistory}
                                        isPositive={isPositive}
                                        width={60}
                                        height={28}
                                    />
                                </div>

                                {/* Right: Price info */}
                                <div className="text-right">
                                    <div className="font-semibold text-foreground text-sm">
                                        ₺{item.price.toLocaleString('tr-TR', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </div>
                                    <div className={cn("text-xs font-medium",
                                        isPositive ? "text-chart-2" : "text-destructive"
                                    )}>
                                        {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
