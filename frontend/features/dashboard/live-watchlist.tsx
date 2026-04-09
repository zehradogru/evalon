'use client'

import { TrendingUp, TrendingDown, Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardWatchlist, DashboardTicker } from '@/hooks/use-dashboard-data'

interface LiveWatchlistProps {
  onSelectTicker?: (ticker: string, name: string) => void
  activeTicker?: string
}

export function LiveWatchlist({ onSelectTicker, activeTicker }: LiveWatchlistProps) {
  const { data: rawWatchlistData, isLoading } = useDashboardWatchlist()
  const items: DashboardTicker[] = rawWatchlistData || []

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Star className="h-4 w-4 text-[#ff9800]" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Watchlist</h3>
          <p className="text-[10px] text-muted-foreground">
            {isLoading ? 'Loading...' : `${items.length} tickers`}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            No data available
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.changePercent >= 0
            const isActive = item.ticker === activeTicker

            return (
              <div
                key={item.ticker}
                onClick={() => onSelectTicker?.(item.ticker, item.name)}
                className={cn(
                  "flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-150 border-b border-border/20",
                  isActive
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                    isPositive ? "bg-[#089981]/10" : "bg-[#f23645]/10"
                  )}>
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 text-[#089981]" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-[#f23645]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{item.ticker}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{item.name}</div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xs font-medium text-foreground">
                    {item.price.toFixed(2)}
                  </div>
                  <div className={cn(
                    "text-[10px] font-semibold",
                    isPositive ? "text-[#089981]" : "text-[#f23645]"
                  )}>
                    {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
