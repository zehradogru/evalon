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
import { Loader2, RefreshCw, Waves } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
        return 'Secili kombinasyon icin gosterilecek son veri yok.'
    }

    if (indicator === 'rsi') {
        const rsi = latestValues[0].value
        if (rsi >= 70) return 'RSI asiri alim bolgesine yakin. Momentum guclu ama soguma riski var.'
        if (rsi <= 30) return 'RSI asiri satim bolgesine yakin. Tepki potansiyeli izlenebilir.'
        return 'RSI dengeli bolgede. Ek bir trend teyidi faydali olur.'
    }

    if (indicator === 'macd') {
        const macd = latestValues.find((item) => item.label.includes('macd'))
        const signal = latestValues.find((item) => item.label.includes('signal'))
        if (macd && signal) {
            return macd.value >= signal.value
                ? 'MACD cizgisi signal ustunde. Kisa vadeli momentum olumlu.'
                : 'MACD cizgisi signal altinda. Zayiflama riski devam ediyor.'
        }
    }

    return 'Indikator serisi guncel fiyat akisiyla birlikte okunmali. Tek basina karar araci olarak kullanmayin.'
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
                limit: 180,
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
                (a, b) =>
                    new Date(String(a.t)).getTime() - new Date(String(b.t)).getTime()
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
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Indicator Lab</h1>
                <p className="text-muted-foreground">
                    PDF’deki gercek indikator endpointleri ile calisan teknik analiz workspace.
                </p>
            </div>

            <Card className="border-border bg-card">
                <CardHeader className="border-b border-border/60">
                    <CardTitle className="text-base">Calisma Alani</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-2 text-sm">
                        <span className="text-muted-foreground">Ticker</span>
                        <Input
                            value={ticker}
                            onChange={(event) =>
                                setTicker(event.target.value.toUpperCase().trim())
                            }
                            placeholder="THYAO"
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm">
                        <span className="text-muted-foreground">Timeframe</span>
                        <Select
                            value={timeframe}
                            onChange={(event) =>
                                setTimeframe(event.target.value as Timeframe)
                            }
                        >
                            {TIMEFRAMES.map((item) => (
                                <option key={item} value={item}>
                                    {formatTimeframeLabel(item)}
                                </option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm">
                        <span className="text-muted-foreground">Indicator</span>
                        <Select
                            value={indicatorId}
                            onChange={(event) => setIndicatorId(event.target.value)}
                        >
                            {(catalogQuery.data?.indicators || []).map((indicator) => (
                                <option key={indicator.id} value={indicator.id}>
                                    {indicator.label}
                                </option>
                            ))}
                        </Select>
                    </label>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-muted-foreground">Period</span>
                            <Input value={period} onChange={(event) => setPeriod(event.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-muted-foreground">Fast</span>
                            <Input value={fast} onChange={(event) => setFast(event.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-muted-foreground">Slow</span>
                            <Input value={slow} onChange={(event) => setSlow(event.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-muted-foreground">Signal</span>
                            <Input
                                value={signal}
                                onChange={(event) => setSignal(event.target.value)}
                            />
                        </label>
                    </div>
                    <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-2">
                        {BIST_POPULAR.slice(0, 8).map((popularTicker) => (
                            <Button
                                key={popularTicker}
                                type="button"
                                variant={popularTicker === ticker ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTicker(popularTicker)}
                            >
                                {popularTicker}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void indicatorsQuery.refetch()}
                            disabled={indicatorsQuery.isFetching}
                        >
                            <RefreshCw
                                className={cn(
                                    'mr-2 h-3.5 w-3.5',
                                    indicatorsQuery.isFetching && 'animate-spin'
                                )}
                            />
                            Yenile
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <Card className="border-border bg-card">
                    <CardHeader className="border-b border-border/60">
                        <CardTitle className="text-base">
                            {ticker} · {indicatorId.toUpperCase()} · {formatTimeframeLabel(timeframe)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {catalogQuery.isLoading || indicatorsQuery.isLoading ? (
                            <div className="flex h-[360px] items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : indicatorsQuery.error ? (
                            <div className="flex h-[360px] items-center justify-center text-sm text-destructive">
                                {indicatorsQuery.error instanceof Error
                                    ? indicatorsQuery.error.message
                                    : 'Indicator verisi yuklenemedi.'}
                            </div>
                        ) : chartData.data.length === 0 ? (
                            <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
                                Secili kombinasyon icin gosterilecek seri yok.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={360}>
                                <LineChart data={chartData.data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                    <XAxis
                                        dataKey="t"
                                        minTickGap={40}
                                        tickFormatter={(value) =>
                                            new Date(String(value)).toLocaleDateString('tr-TR', {
                                                day: '2-digit',
                                                month: 'short',
                                            })
                                        }
                                    />
                                    <YAxis />
                                    <Tooltip
                                        labelFormatter={(value) =>
                                            new Date(String(value)).toLocaleString('tr-TR')
                                        }
                                    />
                                    <Legend />
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
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-6">
                    <Card className="border-border bg-card">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle className="text-base">Son Degerler</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-6">
                            {latestValues.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Henuz indikator degeri yok.
                                </p>
                            ) : (
                                latestValues.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                                    >
                                        <span className="text-sm text-muted-foreground">
                                            {item.label}
                                        </span>
                                        <span className="font-mono text-sm font-semibold">
                                            {item.value.toFixed(2)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Waves className="h-4 w-4 text-primary" />
                                Hizli Yorum
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <p className="text-sm leading-6 text-muted-foreground">
                                {comment}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
