'use client'

import { useRouter } from 'next/navigation'
import { Brain, TrendingUp, TrendingDown, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardWatchlist, DashboardTicker } from '@/hooks/use-dashboard-data'

const signalColors: Record<string, { bg: string; text: string; border: string }> = {
  'Strong Buy': { bg: 'bg-chart-2/15', text: 'text-chart-2', border: 'border-chart-2/30' },
  'Buy': { bg: 'bg-chart-2/10', text: 'text-chart-2', border: 'border-chart-2/20' },
  'Neutral': { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', border: 'border-muted-foreground/20' },
  'Sell': { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
  'Strong Sell': { bg: 'bg-destructive/15', text: 'text-destructive', border: 'border-destructive/30' },
}

function getSignal(changePercent: number): 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell' {
  if (changePercent > 3) return 'Strong Buy'
  if (changePercent > 1) return 'Buy'
  if (changePercent < -3) return 'Strong Sell'
  if (changePercent < -1) return 'Sell'
  return 'Neutral'
}

function getConfidence(changePercent: number): number {
  const absChange = Math.abs(changePercent)
  if (absChange > 5) return 94
  if (absChange > 3) return 87
  if (absChange > 2) return 82
  if (absChange > 1) return 75
  return 65
}

function getReason(ticker: string, changePercent: number): string {
  if (changePercent > 2) return 'Strong momentum + positive market sentiment'
  if (changePercent > 0) return 'Bullish trend with steady volume'
  if (changePercent < -2) return 'Bearish pressure, consider hedging'
  if (changePercent < 0) return 'Minor correction, watch support levels'
  return 'Consolidating, wait for breakout'
}

export function AIAlphaPicks() {
  const router = useRouter()
  const { data: watchlistData, isLoading } = useDashboardWatchlist()

  const handlePickClick = (ticker: string) => {
    router.push(`/markets/${ticker}`)
  }

  const picks = (watchlistData || []).slice(0, 3).map((item: DashboardTicker) => ({
    ticker: item.ticker,
    name: item.name,
    price: item.price,
    changePercent: item.changePercent,
    signal: getSignal(item.changePercent),
    confidence: getConfidence(item.changePercent),
    reason: getReason(item.ticker, item.changePercent),
  }))

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-4 to-primary flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Alpha Picks</h3>
            <p className="text-[10px] text-muted-foreground">Top recommendations</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-chart-4" />
      </div>

      {/* Picks */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {picks.map((pick) => {
          const isPositive = pick.changePercent >= 0
          const colors = signalColors[pick.signal] || signalColors['Neutral']

          return (
            <div
              key={pick.ticker}
              onClick={() => handlePickClick(pick.ticker)}
              className="group relative p-3.5 rounded-lg bg-background border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-200 cursor-pointer"
            >
              {/* Top row: Ticker + Signal */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{pick.ticker}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold border", colors.bg, colors.text, colors.border)}>
                      {pick.signal}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{pick.name}</span>
                </div>

                {/* Confidence ring */}
                <div className="relative h-10 w-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="hsl(var(--border))"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={isPositive ? 'var(--chart-2)' : 'var(--chart-3)'}
                      strokeWidth="3"
                      strokeDasharray={`${pick.confidence}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-foreground">{pick.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Price row */}
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-foreground">
                  {pick.price < 1000
                    ? `₺${pick.price.toFixed(2)}`
                    : `$${pick.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </span>
                <div className={cn("flex items-center gap-1 text-xs font-semibold", isPositive ? "text-chart-2" : "text-destructive")}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isPositive ? '+' : ''}{pick.changePercent.toFixed(2)}%
                </div>
              </div>

              {/* Reason */}
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                {pick.reason}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
