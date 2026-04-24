'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { AlertCircle, Loader2, RefreshCw, TrendingUp, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { BIST_POPULAR } from '@/config/markets'
import { formatTimeframeLabel } from '@/lib/evalon'
import { cn } from '@/lib/utils'
import { indicatorsService } from '@/services/indicators.service'
import type { IndicatorSeriesPoint, Timeframe } from '@/types'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']
const SERIES_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

function extractSeriesEntries(point: IndicatorSeriesPoint, seriesId: string) {
    return Object.entries(point)
        .filter(([key, value]) => key !== 't' && typeof value === 'number')
        .map(([key, value]) => ({
            key: key === 'v' ? seriesId : `${seriesId}_${key}`,
            value: value as number,
        }))
}

function buildIndicatorComment(
    indicator: string,
    latestValues: Array<{ label: string; value: number }>
) {
    if (latestValues.length === 0) {
        return 'No recent data to display for the selected combination.'
    }

    if (indicator === 'rsi') {
        const rsi = latestValues[0].value
        if (rsi >= 70) return 'RSI is near overbought territory. Momentum is strong but a cooldown may be approaching.'
        if (rsi <= 30) return 'RSI is near oversold territory. A bounce or reversal could be forming.'
        return 'RSI is in neutral territory. An additional trend confirmation signal would be useful.'
    }

    if (indicator === 'macd') {
        const macd = latestValues.find((item) => item.label.includes('macd'))
        const signal = latestValues.find((item) => item.label.includes('signal'))
        if (macd && signal) {
            return macd.value >= signal.value
                ? 'MACD line is above the signal line. Short-term momentum is bullish.'
                : 'MACD line is below the signal line. Weakness or a downtrend may be continuing.'
        }
    }

    return 'Read the indicator series alongside current price action. Do not use it as a standalone decision tool.'
}

export function AnalysisView() {
    const [ticker, setTicker] = useState('THYAO')
    const [timeframe, setTimeframe] = useState<Timeframe>('1h')
    const [indicatorId, setIndicatorId] = useState('rsi')
    const [period, setPeriod] = useState('14')
    const [fast, setFast] = useState('12')
    const [slow, setSlow] = useState('26')
    const [signal, setSignal] = useState('9')

    const catalogQuery = useQuery({
        queryKey: ['indicator-catalog'],
        queryFn: () => indicatorsService.getCatalog(),
        staleTime: 5 * 60 * 1000,
    })

    const indicatorsQuery = useQuery({
        queryKey: ['analysis-indicator', ticker, timeframe, indicatorId, period, fast, slow, signal],
        queryFn: () =>
            indicatorsService.getIndicators({
                ticker,
                timeframe,
                strategy: indicatorId,
                period: Number(period),
                fast: Number(fast),
                slow: Number(slow),
                signal: Number(signal),
                limit: 200,
            }),
        enabled: Boolean(ticker && indicatorId),
        staleTime: 60 * 1000,
    })

    const chartData = useMemo(() => {
        const rows = new Map<string, Record<string, number | string>>()
        const seriesKeys: string[] = []

        indicatorsQuery.data?.indicators.forEach((series) => {
            ;(Array.isArray(series.series) ? series.series : []).forEach((point) => {
                const row = rows.get(point.t) || { t: point.t }
                extractSeriesEntries(point, series.id).forEach((entry) => {
                    row[entry.key] = entry.value
                    if (!seriesKeys.includes(entry.key)) {
                        seriesKeys.push(entry.key)
                    }
                })
                rows.set(point.t, row)
            })
        })

        return {
            data: Array.from(rows.values()).sort(
                (a, b) => new Date(String(a.t)).getTime() - new Date(String(b.t)).getTime()
            ),
            keys: seriesKeys,
        }
    }, [indicatorsQuery.data])

    const latestValues = useMemo(() => {
        const lastRow = chartData.data[chartData.data.length - 1] || {}
        return chartData.keys
            .map((key) => ({
                label: key,
                value: Number(lastRow[key] ?? NaN),
            }))
            .filter((item) => Number.isFinite(item.value))
    }, [chartData])

    const comment = buildIndicatorComment(indicatorId, latestValues)

    return (
        <div className="w-full flex flex-col gap-4 p-5">

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ROW 1 — Header + Refresh                                        */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Indicator Lab</h1>
                    <p className="text-sm text-muted-foreground">
                        Technical analysis workspace powered by real indicator endpoints.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void indicatorsQuery.refetch()}
                    disabled={indicatorsQuery.isFetching}
                    className="gap-2 shrink-0"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', indicatorsQuery.isFetching && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ROW 2 — Config bar                                               */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                {/* Main controls */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticker</span>
                        <Input
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
                            placeholder="THYAO"
                            className="h-8 text-xs"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Timeframe</span>
                        <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)} className="h-8 text-xs">
                            {TIMEFRAMES.map((tf) => (
                                <option key={tf} value={tf}>{formatTimeframeLabel(tf)}</option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Indicator</span>
                        <Select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} className="h-8 text-xs">
                            {(catalogQuery.data?.indicators ?? []).map((ind) => (
                                <option key={ind.id} value={ind.id}>{ind.label}</option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Period</span>
                        <Input type="number" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Fast</span>
                        <Input type="number" value={fast} onChange={(e) => setFast(e.target.value)} className="h-8 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Slow</span>
                        <Input type="number" value={slow} onChange={(e) => setSlow(e.target.value)} className="h-8 text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Signal</span>
                        <Input type="number" value={signal} onChange={(e) => setSignal(e.target.value)} className="h-8 text-xs" />
                    </label>
                </div>

                {/* Ticker quick-picks */}
                <div className="border-t border-border/30 pt-3 flex flex-wrap gap-1.5">
                    {BIST_POPULAR.slice(0, 12).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTicker(t)}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                t === ticker
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ROW 3 — Chart + side panels                                      */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">

                {/* Chart */}
                <div className="rounded-xl border border-border/50 bg-card p-5 min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                            {ticker} · {indicatorId.toUpperCase()} · {formatTimeframeLabel(timeframe)}
                        </span>
                        {indicatorsQuery.isFetching && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
                        )}
                    </div>

                    {indicatorsQuery.isLoading ? (
                        <div className="flex h-[360px] items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : indicatorsQuery.error ? (
                        <div className="flex h-[360px] flex-col items-center justify-center gap-2 text-destructive">
                            <AlertCircle className="h-6 w-6" />
                            <span className="text-sm">
                                {indicatorsQuery.error instanceof Error
                                    ? indicatorsQuery.error.message
                                    : 'Failed to load indicator data.'}
                            </span>
                        </div>
                    ) : chartData.data.length === 0 ? (
                        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
                            No data available for the selected combination.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={360}>
                            <LineChart data={chartData.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="t"
                                    minTickGap={40}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value) =>
                                        new Date(String(value)).toLocaleDateString('en-US', {
                                            day: '2-digit',
                                            month: 'short',
                                        })
                                    }
                                />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                                    labelFormatter={(value) => new Date(String(value)).toLocaleString('en-US')}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                {chartData.keys.map((key, index) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                                        dot={false}
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Side: Latest values + Quick commentary */}
                <div className="flex flex-col gap-4">
                    {/* Latest values */}
                    <div className="rounded-xl border border-border/50 bg-card p-4">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Latest Values</p>
                        {latestValues.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No indicator values yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {latestValues.map((item, index) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-2 w-2 rounded-full shrink-0"
                                                style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                                            />
                                            <span className="text-xs text-muted-foreground">{item.label}</span>
                                        </div>
                                        <span className="font-mono text-sm font-semibold">{item.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick commentary */}
                    <div className="rounded-xl border border-border/50 bg-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Waves className="h-3.5 w-3.5 text-primary" />
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Quick Read</p>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{comment}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
