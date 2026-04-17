'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, Bell, Clock, LineChart as LineChartIcon, Loader2, Maximize2, RefreshCw, Share2, Star, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { usePrices } from '@/hooks/use-prices'
import { EVALON_SUPPORTED_TIMEFRAMES, formatTimeframeLabel } from '@/lib/evalon'
import { cn } from '@/lib/utils'
import { indicatorsService } from '@/services/indicators.service'
import { useAuthStore } from '@/store/use-auth-store'
import { useAddWatchlistTicker, useRemoveWatchlistTicker, useUserWatchlist } from '@/hooks/use-user-watchlist'
import { TICKER_NAMES } from '@/config/markets'
import type { IndicatorSeriesPoint, Timeframe } from '@/types'

interface TickerViewProps { ticker: string }

const APP_BOOT_TS = Date.now()
const LIMITS: Record<string, number> = { '1m': 300, '3m': 300, '5m': 240, '15m': 220, '30m': 220, '1h': 180, '2h': 160, '4h': 140, '6h': 120, '12h': 120, '1d': 90, '1g': 90, '1w': 80, '1M': 72, '1mo': 72 }
const INDICATOR_DEFAULTS: Record<string, { period?: number; fast?: number; slow?: number; signal?: number }> = { rsi: { period: 14 }, sma: { period: 20 }, ema: { period: 20 }, bbands: { period: 20 }, macd: { fast: 12, slow: 26, signal: 9 } }
const INDICATOR_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

const getLimit = (timeframe: Timeframe) => LIMITS[timeframe] ?? 120
const formatYAxisTick = (value: number) => value.toFixed(2)
const getPeriodLabel = (timeframe: Timeframe) => ['1d', '1g', '1w', '1M', '1mo'].includes(timeframe) ? 'Period' : ['1h', '2h', '4h', '6h', '12h'].includes(timeframe) ? 'Session' : 'Intra-day'
const getYAxisWidth = (domain: [number, number] | ['auto', 'auto']) => {
  if (!Array.isArray(domain) || typeof domain[0] !== 'number' || typeof domain[1] !== 'number') return 64
  const [min, max] = domain
  const longest = [min, max, (min + max) / 2, 0].map((v) => formatYAxisTick(v)).reduce((acc, label) => Math.max(acc, label.length), 0)
  return Math.min(96, Math.max(56, Math.ceil(longest * 8 + 16)))
}
const formatAxisTime = (timeframe: Timeframe, value: string) => {
  const date = new Date(value)
  if (['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h'].includes(timeframe)) return date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (timeframe === '1M' || timeframe === '1mo') return date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
  return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })
}
const extractEntries = (point: IndicatorSeriesPoint, seriesId: string) => Object.entries(point).filter(([key, value]) => key !== 't' && typeof value === 'number').map(([key, value]) => ({ key: key === 'v' ? seriesId : `${seriesId}_${key}`, value }))
const buildIndicatorComment = (indicatorId: string, latest: Array<{ label: string; value: number }>) => {
  if (!latest.length) return 'Secili indikator bu kombinasyon icin seri dondurmedi. Farkli timeframe veya parametre deneyin.'
  if (indicatorId === 'rsi') {
    const rsi = latest[0]?.value
    if (rsi >= 70) return 'RSI yuksek seviyede. Momentum guclu ama kisa vadeli soguma riski artiyor.'
    if (rsi <= 30) return 'RSI dusuk bolgede. Tepki potansiyeli izlenebilir ama tek basina yeterli degil.'
    return 'RSI orta bantta. Trend teyidi icin fiyat ve hacimle birlikte okumak daha saglikli olur.'
  }
  if (indicatorId === 'macd') {
    const macd = latest.find((item) => item.label.includes('macd'))
    const signal = latest.find((item) => item.label.includes('signal'))
    if (macd && signal) return macd.value >= signal.value ? 'MACD signal ustunde. Kisa vadeli momentum olumlu tarafta.' : 'MACD signal altinda. Momentum zayif ve yeni teyit gerekebilir.'
  }
  return 'İndikatör serisini fiyat trendiyle birlikte değerlendirin. Tek bir ölçüm kararı taşımaya yetmeyebilir.'
}

export function TickerView({ ticker }: TickerViewProps) {
  const normalizedTicker = ticker.toUpperCase()
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')
  const [indicatorId, setIndicatorId] = useState('rsi')
  const [period, setPeriod] = useState(String(INDICATOR_DEFAULTS.rsi.period ?? 14))
  const [fast, setFast] = useState(String(INDICATOR_DEFAULTS.macd.fast ?? 12))
  const [slow, setSlow] = useState(String(INDICATOR_DEFAULTS.macd.slow ?? 26))
  const [signal, setSignal] = useState(String(INDICATOR_DEFAULTS.macd.signal ?? 9))
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
  const handleIndicatorChange = (value: string) => {
    setIndicatorId(value)
    const defaults = INDICATOR_DEFAULTS[value]
    if (!defaults) return
    if (defaults.period !== undefined) setPeriod(String(defaults.period))
    if (defaults.fast !== undefined) setFast(String(defaults.fast))
    if (defaults.slow !== undefined) setSlow(String(defaults.slow))
    if (defaults.signal !== undefined) setSignal(String(defaults.signal))
  }

  const { data: dailyData } = usePrices(normalizedTicker, '1d', 2)
  const { data: chartPriceData, isLoading, error, refetch, isFetching } = usePrices(normalizedTicker, timeframe, getLimit(timeframe))
  const indicatorCatalogQuery = useQuery({ queryKey: ['ticker-indicator-catalog'], queryFn: () => indicatorsService.getCatalog(), staleTime: 300000 })
  const indicatorSeriesQuery = useQuery({
    queryKey: ['ticker-indicators', normalizedTicker, timeframe, indicatorId, period, fast, slow, signal],
    queryFn: () => indicatorsService.getIndicators({ ticker: normalizedTicker, timeframe, strategy: indicatorId, period: Number(period), fast: Number(fast), slow: Number(slow), signal: Number(signal), limit: getLimit(timeframe) }),
    enabled: Boolean(normalizedTicker && indicatorId),
    staleTime: 60000,
  })

  const data = useMemo(() => chartPriceData?.data ?? [], [chartPriceData])
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
  const indicatorChart = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>()
    const keys: string[] = []
    indicatorSeriesQuery.data?.indicators.forEach((series) => series.series.forEach((point) => {
      const row = rows.get(point.t) || { t: point.t }
      extractEntries(point, series.id).forEach((entry) => {
        row[entry.key] = entry.value
        if (!keys.includes(entry.key)) keys.push(entry.key)
      })
      rows.set(point.t, row)
    }))
    return { rows: Array.from(rows.values()).sort((a, b) => new Date(String(a.t)).getTime() - new Date(String(b.t)).getTime()), keys }
  }, [indicatorSeriesQuery.data])
  const latestIndicatorValues = useMemo(() => {
    const lastRow = indicatorChart.rows[indicatorChart.rows.length - 1] || {}
    return indicatorChart.keys.map((key) => ({ label: key, value: Number(lastRow[key] ?? NaN) })).filter((item) => Number.isFinite(item.value))
  }, [indicatorChart])
  const indicatorErrorMessage = indicatorSeriesQuery.error instanceof Error ? indicatorSeriesQuery.error.message : 'İndikatör verisi yüklenemedi.'

  return <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
    <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card/70 px-6 py-4 backdrop-blur-sm">
      <Link href="/markets" className="-ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><ArrowLeft size={20} /></Link>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary shadow-sm">{normalizedTicker.slice(0, 2)}</div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{normalizedTicker}</h1>
            {headerStats?.isStale ? <Badge variant="outline" className="border-amber-500/30 px-1.5 py-0 text-[10px] text-amber-500"><Clock size={10} className="mr-1" />{headerStats.daysSinceUpdate}d ago</Badge> : null}
          </div>
          <span className="text-sm text-muted-foreground">{TICKER_NAMES[normalizedTicker] || 'Borsa Istanbul'}</span>
        </div>
      </div>
      {headerStats ? <div className="ml-auto flex items-center gap-4"><div className="flex flex-col items-end"><div className="flex items-baseline gap-2"><span className="font-mono text-3xl font-bold tracking-tight">{headerStats.price.toFixed(2)}</span><span className="text-sm text-muted-foreground">TRY</span></div><div className={cn('flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold', headerStats.isPositive ? 'bg-chart-2/10 text-chart-2' : 'bg-destructive/10 text-destructive')}>{headerStats.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{headerStats.isPositive ? '+' : ''}{headerStats.change.toFixed(2)} ({headerStats.isPositive ? '+' : ''}{headerStats.changePct.toFixed(2)}%)</div></div></div> : null}
    </div>

    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-2/10"><ArrowUp size={16} className="text-chart-2" /></div><div className="flex min-w-0 flex-col"><span className="text-xs font-medium text-muted-foreground">{getPeriodLabel(timeframe)} High</span><span className="truncate font-mono text-lg font-semibold">{chartStats?.high?.toFixed(2) || '-'}</span></div></Card>
        <Card className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10"><ArrowDown size={16} className="text-destructive" /></div><div className="flex min-w-0 flex-col"><span className="text-xs font-medium text-muted-foreground">{getPeriodLabel(timeframe)} Low</span><span className="truncate font-mono text-lg font-semibold">{chartStats?.low?.toFixed(2) || '-'}</span></div></Card>
        <Card className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><BarChart3 size={16} className="text-primary" /></div><div className="flex min-w-0 flex-col"><span className="text-xs font-medium text-muted-foreground">Volume</span><span className="truncate text-lg font-semibold">{chartStats?.vol?.toLocaleString('tr-TR') || '-'}</span></div></Card>
        <Card className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Waves size={16} className="text-muted-foreground" /></div><div className="flex min-w-0 flex-col"><span className="text-xs font-medium text-muted-foreground">Indicator</span><span className="truncate text-lg font-semibold uppercase">{indicatorId}</span></div></Card>
      </div>

      {headerStats?.isStale ? <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5"><Clock size={16} className="flex-shrink-0 text-amber-500" /><div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2"><span className="font-medium text-amber-400">Veriler guncel degil</span><span className="text-muted-foreground">Son guncelleme: {headerStats.lastBarDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <Card className="min-h-[560px] rounded-xl border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Timeframe</span><Select value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)}>{EVALON_SUPPORTED_TIMEFRAMES.map((item) => <option key={item} value={item}>{formatTimeframeLabel(item)}</option>)}</Select></label>
              <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Indicator</span><Select value={indicatorId} onChange={(event) => handleIndicatorChange(event.target.value)}>{(indicatorCatalogQuery.data?.indicators || []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
              <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Period</span><Input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Fast</span><Input value={fast} onChange={(event) => setFast(event.target.value)} /></label>
                <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Slow</span><Input value={slow} onChange={(event) => setSlow(event.target.value)} /></label>
                <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Signal</span><Input value={signal} onChange={(event) => setSignal(event.target.value)} /></label>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className={cn('h-8 px-2 hover:bg-amber-500/10 disabled:opacity-50', isInWatchlist ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500')} onClick={() => { void handleToggleWatchlist() }} disabled={!isAuthenticated || isWatchlistMutating} title={isAuthenticated ? isInWatchlist ? 'Watchlistten cikar' : 'Watchliste ekle' : 'Watchlist icin giris gerekli'}><Star size={16} fill={isInWatchlist ? 'currentColor' : 'none'} /><span className="ml-1.5 hidden text-xs sm:inline">{isInWatchlist ? 'Added' : 'Watchlist'}</span></Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50" disabled title="Yakinda aktif olacak"><Bell size={16} /><span className="ml-1.5 hidden text-xs sm:inline">Alert</span></Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground disabled:opacity-50" disabled title="Yakinda aktif olacak"><Share2 size={16} /><span className="ml-1.5 hidden text-xs sm:inline">Paylas</span></Button>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { void refetch(); void indicatorSeriesQuery.refetch() }} disabled={isLoading || isFetching || indicatorSeriesQuery.isFetching} title="Yenile"><RefreshCw size={16} className={cn((isLoading || isFetching || indicatorSeriesQuery.isFetching) && 'animate-spin')} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground disabled:opacity-50" disabled title="Tam ekran - yakinda"><Maximize2 size={16} /></Button>
            </div>
          </div>

          <div className="grid gap-6 p-4 xl:grid-cols-[1.7fr_1fr]">
            <div className="relative min-h-[420px] rounded-xl border border-border/60 bg-background/40 p-4">
              {isLoading ? <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm"><div className="flex flex-col items-center gap-3"><div className="relative"><div className="h-12 w-12 rounded-full border-2 border-primary/20" /><Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-primary" /></div><div className="flex flex-col items-center gap-1"><span className="text-sm font-medium">Grafik yukleniyor</span><span className="text-xs text-muted-foreground">{normalizedTicker} - {formatTimeframeLabel(timeframe)}</span></div></div></div> : null}
              {error ? <div className="absolute inset-0 flex items-center justify-center"><div className="flex max-w-xs flex-col items-center gap-3 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"><AlertCircle className="h-6 w-6 text-destructive" /></div><div className="flex flex-col gap-1"><span className="text-sm font-medium">Fiyat verisi yuklenemedi</span><span className="text-xs text-muted-foreground">Backend bu timeframe icin veri donmuyor olabilir ya da servis gecici hata veriyor.</span></div><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw size={14} className="mr-1.5" />Tekrar Dene</Button></div></div> : !data.length ? <div className="absolute inset-0 flex items-center justify-center"><div className="flex max-w-xs flex-col items-center gap-3 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"><LineChartIcon className="h-6 w-6 text-muted-foreground" /></div><div className="flex flex-col gap-1"><span className="text-sm font-medium">Veri bulunamadi</span><span className="text-xs text-muted-foreground">{normalizedTicker} icin secili timeframe desteklenmiyor olabilir.</span></div></div></div> : <ResponsiveContainer width="100%" height={390}><AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}><defs><linearGradient id="colorPricePos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient><linearGradient id="colorPriceNeg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333333" opacity={0.4} /><XAxis dataKey="t" tickFormatter={(value) => formatAxisTime(timeframe, String(value))} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} dy={10} minTickGap={30} /><YAxis domain={yDomain} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={yAxisWidth} tickFormatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : String(value)} /><RechartsTooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#333333', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#888888', marginBottom: '4px' }} labelFormatter={(label) => new Date(String(label)).toLocaleString('tr-TR')} formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) : String(value ?? ''), name === 'c' ? 'Price' : String(name ?? '')]} /><Area type="monotone" dataKey="c" stroke={headerStats?.isPositive ? '#22c55e' : '#ef4444'} strokeWidth={2} fillOpacity={1} fill={headerStats?.isPositive ? 'url(#colorPricePos)' : 'url(#colorPriceNeg)'} animationDuration={500} /></AreaChart></ResponsiveContainer>}
            </div>

            <div className="flex flex-col gap-4">
              <Card className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-3 flex items-center gap-2"><Waves className="h-4 w-4 text-primary" /><div className="text-sm font-semibold">Indicator Panel</div></div>
                <div className="text-xs text-muted-foreground">{normalizedTicker} - {indicatorId.toUpperCase()} - {formatTimeframeLabel(timeframe)}</div>
                <div className="mt-4 h-[220px]">
                  {indicatorSeriesQuery.isLoading || indicatorCatalogQuery.isLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : indicatorSeriesQuery.isError ? <div className="flex h-full items-center justify-center text-center text-sm text-destructive">{indicatorErrorMessage}</div> : !indicatorChart.rows.length ? <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">Secili indikator bu kombinasyon icin seri dondurmedi.</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={indicatorChart.rows}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" /><XAxis dataKey="t" minTickGap={28} tickFormatter={(value) => formatAxisTime(timeframe, String(value))} /><YAxis /><RechartsTooltip labelFormatter={(value) => new Date(String(value)).toLocaleString('tr-TR')} />{indicatorChart.keys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={INDICATOR_COLORS[index % INDICATOR_COLORS.length]} dot={false} strokeWidth={2} isAnimationActive={false} />)}</LineChart></ResponsiveContainer>}
                </div>
              </Card>

              <Card className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-sm font-semibold">Latest Indicator Values</div>
                <div className="mt-4 space-y-3">{!latestIndicatorValues.length ? <p className="text-sm text-muted-foreground">Henuz hesaplanmis bir indikator degeri yok.</p> : latestIndicatorValues.map((item) => <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/50 px-3 py-2"><span className="text-sm text-muted-foreground">{item.label}</span><span className="font-mono text-sm font-semibold">{item.value.toFixed(2)}</span></div>)}</div>
              </Card>

              <Card className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-sm font-semibold">Quick Read</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{buildIndicatorComment(indicatorId, latestIndicatorValues)}</p>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
}
