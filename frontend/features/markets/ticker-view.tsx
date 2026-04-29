'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, Bell, Clock, Loader2, Maximize2, RefreshCw, Share2, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { CandlestickChart } from '@/components/candlestick-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { usePrices } from '@/hooks/use-prices'
import { EVALON_SUPPORTED_TIMEFRAMES, formatTimeframeLabel, toGraphWebTimeframe } from '@/lib/evalon'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/use-auth-store'
import { useAddWatchlistTicker, useRemoveWatchlistTicker, useUserWatchlist } from '@/hooks/use-user-watchlist'
import { TICKER_NAMES } from '@/config/markets'
import type { Timeframe } from '@/types'

interface TickerViewProps { ticker: string }

const APP_BOOT_TS = Date.now()
const LIMITS: Record<string, number> = { '1m': 300, '3m': 300, '5m': 240, '15m': 220, '30m': 220, '1h': 180, '2h': 160, '4h': 140, '6h': 120, '12h': 120, '1d': 90, '1g': 90, '1w': 80, '1M': 72, '1mo': 72 }

const formatYAxisTick = (value: number) => value.toFixed(2)
const getLimit = (timeframe: Timeframe) => LIMITS[timeframe] ?? 120
const getPeriodLabel = (timeframe: Timeframe) => ['1d', '1g', '1w', '1M', '1mo'].includes(timeframe) ? 'Period' : ['1h', '2h', '4h', '6h', '12h'].includes(timeframe) ? 'Session' : 'Intra-day'
const getYAxisWidth = (domain: [number, number] | ['auto', 'auto']) => {
  if (!Array.isArray(domain) || typeof domain[0] !== 'number' || typeof domain[1] !== 'number') return 64
  const [min, max] = domain
  const longest = [min, max, (min + max) / 2, 0].map((v) => formatYAxisTick(v)).reduce((acc, label) => Math.max(acc, label.length), 0)
  return Math.min(96, Math.max(56, Math.ceil(longest * 8 + 16)))
}

export function TickerView({ ticker }: TickerViewProps) {
  const router = useRouter()
  const normalizedTicker = ticker.toUpperCase()
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')
  const { isAuthenticated } = useAuthStore()
  const { data: userWatchlist } = useUserWatchlist()
  const addTickerMutation = useAddWatchlistTicker()
  const removeTickerMutation = useRemoveWatchlistTicker()
  const isWatchlistMutating = addTickerMutation.isPending || removeTickerMutation.isPending
  const isInWatchlist = userWatchlist?.tickers.includes(normalizedTicker) ?? false

  const handleToggleWatchlist = async () => {
    if (!isAuthenticated) return
    if (isInWatchlist) return removeTickerMutation.mutateAsync(normalizedTicker)
    return addTickerMutation.mutateAsync(normalizedTicker)
  }

  const { data: dailyData } = usePrices(normalizedTicker, '1d', 2)
  const {
    data: chartPriceData,
    marketStatus,
    retryNow,
  } = usePrices(normalizedTicker, timeframe, getLimit(timeframe))

  const data = useMemo(() => chartPriceData?.data ?? [], [chartPriceData])
  const showChart = marketStatus.hasUsableData && data.length > 0
  const showInitialLoading = marketStatus.isInitialLoading && !showChart
  const showHardFailure = marketStatus.source === 'error' && !showChart
  const headerStats = useMemo(() => {
    const bars = dailyData?.data || []
    if (!bars.length) return null
    const currentBar = bars[bars.length - 1]
    const previousBar = bars.length > 1 ? bars[bars.length - 2] : null
    const price = currentBar.c
    const change = previousBar ? currentBar.c - previousBar.c : 0
    const changePct = previousBar && previousBar.c !== 0 ? (change / previousBar.c) * 100 : 0
    const lastBarDate = new Date(currentBar.t)
    const daysSinceUpdate = Math.floor((APP_BOOT_TS - lastBarDate.getTime()) / 86400000)
    return { price, change, changePct, isPositive: change >= 0, lastBarDate, isStale: daysSinceUpdate > 5, daysSinceUpdate }
  }, [dailyData])
  const chartStats = useMemo(() => data.length ? { high: Math.max(...data.map((item) => item.h)), low: Math.min(...data.map((item) => item.l)), vol: data[data.length - 1].v } : null, [data])
  const yDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
    if (!data.length) return ['auto', 'auto']
    const prices = data.flatMap((item) => [item.c, item.h, item.l])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min
    const padding = Math.max(range * 0.05, Math.max(Math.max(Math.abs(min), Math.abs(max), 1) * 0.01, 0.01))
    let lower = min - padding
    let upper = max + padding
    if (upper - lower < 0.02) {
      const center = (min + max) / 2
      lower = center - 0.01
      upper = center + 0.01
    }
    return [Math.floor(lower * 100) / 100, Math.ceil(upper * 100) / 100]
  }, [data])
  const yAxisWidth = useMemo(() => getYAxisWidth(yDomain), [yDomain])

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/70 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <Link href="/markets" className="-ml-2 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ArrowLeft size={20} />
          </Link>

          {/* Ticker identity */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary shadow-sm sm:flex">
              {normalizedTicker.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{normalizedTicker}</h1>
                {headerStats?.isStale ? (
                  <Badge variant="outline" className="shrink-0 border-amber-500/30 px-1.5 py-0 text-[10px] text-amber-500">
                    <Clock size={10} className="mr-1" />{headerStats.daysSinceUpdate}d ago
                  </Badge>
                ) : null}
              </div>
              <span className="block truncate text-xs text-muted-foreground">
                {TICKER_NAMES[normalizedTicker] || 'Borsa Istanbul'}
              </span>
            </div>
          </div>

          {/* Watchlist / Alert / Share */}
          <div className="ml-2 flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm"
              className={cn('h-7 shrink-0 px-2 text-xs hover:bg-amber-500/10 disabled:opacity-50', isInWatchlist ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500')}
              onClick={() => { void handleToggleWatchlist() }}
              disabled={!isAuthenticated || isWatchlistMutating}
              title={isAuthenticated ? (isInWatchlist ? 'Watchlistten çıkar' : 'Watchliste ekle') : 'Giriş yapın'}
            >
              <Star size={13} fill={isInWatchlist ? 'currentColor' : 'none'} />
              <span className="ml-1 hidden sm:inline">{isInWatchlist ? 'Eklendi' : 'Watchlist'}</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-muted-foreground disabled:opacity-40" disabled title="Coming soon">
              <Bell size={13} /><span className="ml-1 hidden sm:inline">Alert</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-muted-foreground disabled:opacity-40" disabled title="Coming soon">
              <Share2 size={13} /><span className="ml-1 hidden sm:inline">Share</span>
            </Button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stat pills */}
          {chartStats ? (
            <div className="hidden items-center gap-1.5 sm:flex">
              <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/50 px-2 py-1">
                <ArrowUp size={10} className="text-chart-2" />
                <span className="text-[10px] text-muted-foreground">H</span>
                <span className="font-mono text-[11px] font-semibold text-chart-2">{chartStats.high.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/50 px-2 py-1">
                <ArrowDown size={10} className="text-destructive" />
                <span className="text-[10px] text-muted-foreground">L</span>
                <span className="font-mono text-[11px] font-semibold text-destructive">{chartStats.low.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/50 px-2 py-1">
                <BarChart3 size={10} className="text-primary" />
                <span className="text-[10px] text-muted-foreground">Vol</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {chartStats.vol >= 1_000_000
                    ? `${(chartStats.vol / 1_000_000).toFixed(1)}M`
                    : chartStats.vol >= 1_000
                      ? `${(chartStats.vol / 1_000).toFixed(1)}K`
                      : String(chartStats.vol)}
                </span>
              </div>
            </div>
          ) : null}

          {/* Price */}
          {headerStats ? (
            <div className="ml-3 shrink-0 text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="font-mono text-xl font-bold tracking-tight sm:text-2xl">{headerStats.price.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">TRY</span>
              </div>
              <div className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold', headerStats.isPositive ? 'bg-chart-2/10 text-chart-2' : 'bg-destructive/10 text-destructive')}>
                {headerStats.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span className="hidden sm:inline">{headerStats.isPositive ? '+' : ''}{headerStats.change.toFixed(2)} </span>
                ({headerStats.isPositive ? '+' : ''}{headerStats.changePct.toFixed(2)}%)
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Page Body ── */}
      <div className="flex w-full flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {/* Timeframe pills */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-card p-0.5">
            {EVALON_SUPPORTED_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'h-6 min-w-[30px] rounded-md px-1.5 text-[11px] font-medium transition-colors',
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {formatTimeframeLabel(tf)}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-5 w-px shrink-0 bg-border/50" />

          {/* Status + actions */}
          <div className="flex shrink-0 items-center gap-1">
            <MarketDataStatusChip
              status={marketStatus}
              labels={{ refreshing: 'Refreshing', warming: 'Warming up', stale: 'Delayed', partial: 'Partial data', error: 'Connection error' }}
            />
            {headerStats?.isStale ? (
              <span className="rounded-md border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-400">
                <Clock size={9} className="mr-0.5 inline" />{headerStats.daysSinceUpdate}g gecikmeli
              </span>
            ) : null}
            <Button
              variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => { void retryNow() }}
              disabled={marketStatus.isInitialLoading || marketStatus.isBackgroundRefreshing}
              title="Yenile"
            >
              <RefreshCw size={13} className={cn((marketStatus.isInitialLoading || marketStatus.isBackgroundRefreshing) && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => router.push(`/markets/${normalizedTicker}/chart?tf=${encodeURIComponent(toGraphWebTimeframe(timeframe))}`)}
              title="Tam ekran grafik"
            >
              <Maximize2 size={13} />
            </Button>
          </div>
        </div>

        {/* ── Chart ── */}
        <div className="relative h-[360px] overflow-hidden rounded-xl border border-border/60 bg-background/40 sm:h-[480px] lg:h-[600px]">
              {showInitialLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
                      <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-primary" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">Loading chart</span>
                      <span className="text-xs text-muted-foreground">{normalizedTicker} · {formatTimeframeLabel(timeframe)}</span>
                    </div>
                  </div>
                </div>
              )}
              {showHardFailure && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <span className="text-sm text-muted-foreground">Chart data unavailable</span>
                  </div>
                </div>
              )}
              <CandlestickChart data={data} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}
