'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Maximize2, Minus, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { cn } from '@/lib/utils'
import { usePrices } from '@/hooks/use-prices'
import { toGraphWebTimeframe } from '@/lib/evalon'
import type { Timeframe } from '@/types'

type Period = '1D' | '1W' | '1M' | '3M'

interface MainChartProps {
  ticker?: string
  name?: string
}

const PERIOD_CONFIG: Record<Period, { timeframe: Timeframe; limit: number }> = {
  '1D': { timeframe: '5m', limit: 100 },
  '1W': { timeframe: '1h', limit: 40 },
  '1M': { timeframe: '1d', limit: 30 },
  '3M': { timeframe: '1d', limit: 90 },
}

interface ChartDataPoint {
  time: string
  price: number
  open: number
  high: number
  low: number
  volume: number
}

type ChartYDomain = [number, number] | ['auto', 'auto']

export function MainChart({ ticker = 'THYAO', name = 'Turkish Airlines' }: MainChartProps) {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('1D')
  const retryGuardRef = useRef<string | null>(null)

  const config = PERIOD_CONFIG[period]
  const {
    data: priceData,
    marketStatus,
    retryNow,
  } = usePrices(ticker, config.timeframe, config.limit)

  // Always fetch daily data for consistent header price/change
  const {
    data: dailyPriceData,
    retryNow: retryDailyNow,
    isFetching: isDailyFetching,
  } = usePrices(ticker, '1d', 2)

  const chartData: ChartDataPoint[] = useMemo(() => {
    return (priceData?.data ?? []).map((bar) => {
      const date = new Date(bar.t)
      let timeStr: string
      if (period === '1D') {
        // Intraday: only show time
        timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      } else if (period === '1W') {
        // Weekly with hourly data: show date + time to avoid repeating hours
        timeStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' +
          date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      } else {
        // Monthly/quarterly: show date
        timeStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
      }
      return {
        time: timeStr,
        price: bar.c,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        volume: bar.v,
      }
    })
  }, [priceData?.data, period])

  const lastPrice = chartData[chartData.length - 1]?.price ?? 0
  const lastBar = chartData[chartData.length - 1]

  // Daily change from dedicated daily query (independent of chart period)
  const dailyBars = dailyPriceData?.data || []
  const todayClose = dailyBars.length > 0 ? dailyBars[dailyBars.length - 1].c : lastPrice
  const yesterdayClose = dailyBars.length > 1 ? dailyBars[dailyBars.length - 2].c : todayClose
  const change = todayClose - yesterdayClose
  const changePercent = yesterdayClose > 0 ? (change / yesterdayClose) * 100 : 0
  const isPositive = change >= 0
  const color = isPositive ? '#089981' : '#f23645'

  // Dynamic Y-axis domain with 5% padding
  const yDomain = useMemo<ChartYDomain>(() => {
    if (chartData.length === 0) return ['auto', 'auto']
    const prices = chartData.map(d => d.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = (max - min) * 0.05
    return [
      Math.floor((min - padding) * 100) / 100,
      Math.ceil((max + padding) * 100) / 100
    ]
  }, [chartData])

  const showChart = marketStatus.hasUsableData && chartData.length > 0
  const showInitialLoading = marketStatus.isInitialLoading && !showChart
  const showHardFailure = marketStatus.source === 'error' && !showChart
  const showEmptyState = !showChart && !showInitialLoading && !showHardFailure
  const emptyMessage = marketStatus.isWarming
    ? 'Chart data is still warming up.'
    : marketStatus.emptyReason === 'no-data'
      ? 'No price series is available for this period yet.'
      : 'No chart data is available right now.'

  useEffect(() => {
    const retryKey = `${ticker}:${period}`

    if (showChart || showHardFailure) {
      retryGuardRef.current = null
      return
    }

    if (!marketStatus.isInitialLoading && !marketStatus.isWarming) {
      return
    }

    if (retryGuardRef.current === retryKey) {
      return
    }

    const timerId = window.setTimeout(() => {
      retryGuardRef.current = retryKey
      void retryNow()
    }, 4500)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [
    marketStatus.isInitialLoading,
    marketStatus.isWarming,
    period,
    retryNow,
    showChart,
    showHardFailure,
    ticker,
  ])

  const handleRefresh = () => {
    void retryNow()
    void retryDailyNow()
  }

  const handleOpenFullscreen = () => {
    router.push(
      `/markets/${ticker}/chart?tf=${encodeURIComponent(
        toGraphWebTimeframe(config.timeframe)
      )}`
    )
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {/* Ticker info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-foreground">{name}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-medium">
                {ticker}
              </span>
              <div className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
              <MarketDataStatusChip
                status={marketStatus}
                labels={{
                  refreshing: 'Refreshing',
                  warming: 'Starting',
                  stale: 'Delayed',
                  partial: 'Partial',
                  error: 'Unavailable',
                }}
              />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">
                {lastPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground">TRY</span>
              <div className={cn("flex items-center gap-0.5 text-sm font-semibold", isPositive ? "text-chart-2" : "text-destructive")}>
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-background rounded-lg p-0.5">
            {(['1D', '1W', '1M', '3M'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                  period === p
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Tools */}
          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Grafik verisini yenile"
          >
            <RefreshCw className={cn('h-4 w-4', (marketStatus.isBackgroundRefreshing || isDailyFetching) && 'animate-spin')} />
          </button>
          <button
            onClick={handleOpenFullscreen}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Tam ekran grafiği aç"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 min-h-[340px] px-2 relative">
        {showInitialLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : showHardFailure ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <span className="text-sm text-destructive">
                {marketStatus.errorMessage || 'Chart data is temporarily unavailable.'}
              </span>
              <Button size="sm" variant="outline" onClick={() => void retryNow()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : showEmptyState ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">{emptyMessage}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#787b86', fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={period === '1W' ? 80 : 60}
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#787b86', fontSize: 10 }}
                tickFormatter={(v) => v.toLocaleString('tr-TR')}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                formatter={(value) => [
                  Number(value ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
                  'Price',
                ]}
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill="url(#chartGradient)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {showChart && marketStatus.isBackgroundRefreshing ? (
          <div className="absolute right-4 top-4 rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            Refreshing data...
          </div>
        ) : null}
      </div>

      {/* Chart Footer */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-border/50">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground">O <span className="text-foreground">{lastBar?.open?.toFixed(2) ?? '-'}</span></span>
          <span className="text-[10px] text-muted-foreground">H <span className="text-foreground">{lastBar?.high?.toFixed(2) ?? '-'}</span></span>
          <span className="text-[10px] text-muted-foreground">L <span className="text-foreground">{lastBar?.low?.toFixed(2) ?? '-'}</span></span>
          <span className="text-[10px] text-muted-foreground">C <span className="text-foreground">{lastBar?.price?.toFixed(2) ?? '-'}</span></span>
        </div>
        <span className="text-[10px] text-muted-foreground">Vol <span className="text-foreground">{lastBar?.volume ? (lastBar.volume >= 1000000 ? (lastBar.volume / 1000000).toFixed(1) + 'M' : lastBar.volume.toLocaleString()) : '-'}</span></span>
      </div>
    </div>
  )
}
