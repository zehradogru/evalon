'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw } from 'lucide-react'
import { useMarketMovers } from '@/hooks/use-dashboard-data'
import { Button } from '@/components/ui/button'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { cn } from '@/lib/utils'

function StatCard({ label, value, positive, icon }: {
  label: string
  value: string
  positive?: boolean | null
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-background/50 p-3 flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn(
          "text-sm font-bold",
          positive === true && "text-[#089981]",
          positive === false && "text-[#f23645]",
          positive === null || positive === undefined ? "text-foreground" : ""
        )}>
          {value}
        </span>
      </div>
    </div>
  )
}

export function MarketSummary() {
  const { data, marketStatus, retryNow } = useMarketMovers()

  const stats = useMemo(() => {
    const all = data?.all || []
    if (all.length === 0) return null

    const advancers = all.filter(t => t.changePercent > 0).length
    const decliners = all.filter(t => t.changePercent < 0).length
    const unchanged = all.length - advancers - decliners
    const avgChange = all.reduce((sum, t) => sum + t.changePercent, 0) / all.length
    const breadthRatio = (advancers / all.length) * 100

    return { advancers, decliners, unchanged, avgChange, breadthRatio, total: all.length }
  }, [data])

  return (
    <div className="rounded-xl bg-card border border-border h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Market Overview</h3>
        <MarketDataStatusChip status={marketStatus} className="ml-auto" />
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {marketStatus.isInitialLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : marketStatus.source === 'error' && !marketStatus.hasUsableData ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="text-xs text-muted-foreground">
              {marketStatus.errorMessage || 'Market breadth is temporarily unavailable.'}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retryNow()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : !stats ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">
              {marketStatus.isWarming ? 'Market data is starting...' : 'No market data available'}
            </span>
          </div>
        ) : (
          <>
            {/* Breadth Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Market Breadth</span>
                <span>{stats.breadthRatio.toFixed(0)}% positive</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#f23645]/25 overflow-hidden">
                <div
                  className="h-full bg-[#089981] rounded-full transition-all duration-500"
                  style={{ width: `${stats.breadthRatio}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#089981] font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {stats.advancers} advancing
                </span>
                <span className="text-[#f23645] font-medium flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> {stats.decliners} declining
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Avg. Change"
                value={`${stats.avgChange >= 0 ? '+' : ''}${stats.avgChange.toFixed(2)}%`}
                positive={stats.avgChange >= 0}
              />
              <StatCard
                label="Unchanged"
                value={stats.unchanged.toString()}
                icon={<Minus className="h-3 w-3 text-muted-foreground" />}
              />
              <StatCard
                label="Total Tickers"
                value={stats.total.toString()}
              />
              <StatCard
                label="Breadth Ratio"
                value={`${stats.breadthRatio.toFixed(0)}%`}
                positive={stats.breadthRatio > 50}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
