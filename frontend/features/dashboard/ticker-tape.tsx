'use client'

import { useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useMarketMovers } from '@/hooks/use-dashboard-data'
import { cn } from '@/lib/utils'
import type { DashboardTicker } from '@/hooks/use-dashboard-data'

export function TickerTape() {
  const router = useRouter()
  const { data: moversData } = useMarketMovers()
  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  const items: DashboardTicker[] = moversData?.all || []

  if (!isClient || items.length === 0) {
    return <div className="w-full h-[38px] bg-background border-b border-border" />
  }

  return (
    <div className="w-full h-[38px] bg-background border-b border-border overflow-hidden flex-shrink-0">
      <div className="relative h-full overflow-hidden">
        <div className="flex h-full animate-ticker-scroll">
          {/* Render items twice for seamless loop */}
          {[...items, ...items].map((item, i) => {
            const isPositive = item.changePercent >= 0
            return (
              <div
                key={`${item.ticker}-${i}`}
                className="flex items-center gap-2 px-4 h-full border-r border-border/50 cursor-pointer hover:bg-muted/50 transition-colors flex-shrink-0"
                onClick={() => router.push(`/markets/${item.ticker}`)}
              >
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                  {item.ticker}
                </span>
                <span className="text-xs text-foreground font-medium whitespace-nowrap">
                  {item.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    isPositive ? "text-chart-2" : "text-destructive"
                  )}
                >
                  {isPositive ? '+' : ''}
                  {item.changePercent.toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
