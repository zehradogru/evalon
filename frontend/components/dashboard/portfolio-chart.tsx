'use client'

import { useState, useEffect, useRef } from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts'
import { usePortfolioChart } from '@/hooks/use-prices'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Period = '1D' | '1W' | '1M'

const periodLabels: Record<Period, string> = {
    '1D': '1 Gün',
    '1W': '1 Hafta',
    '1M': '1 Ay',
}

export function PortfolioChart() {
    const [period, setPeriod] = useState<Period>('1D')
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const containerRef = useRef<HTMLDivElement>(null)
    const { data, isLoading, error } = usePortfolioChart(period)

    // Use ResizeObserver to measure container dimensions
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                setDimensions({ width, height })
            }
        })

        resizeObserver.observe(container)
        return () => resizeObserver.disconnect()
    }, [])

    // Process and filter data for recharts
    const processedData = (() => {
        if (!data?.data || data.data.length === 0) return { chartData: [], chartDate: '' }

        // Sort by timestamp ascending
        const sorted = [...data.data].sort(
            (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
        )

        // For 1D: filter to show only the most recent trading day
        let filtered = sorted
        if (period === '1D') {
            // Group by date
            const byDate = new Map<string, typeof sorted>()
            sorted.forEach((bar) => {
                const dateKey = new Date(bar.t).toDateString()
                const existing = byDate.get(dateKey) || []
                existing.push(bar)
                byDate.set(dateKey, existing)
            })

            // Get sorted dates (most recent first)
            const sortedDates = Array.from(byDate.keys()).sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
            )

            // Select most recent day with at least 10 bars (minimum threshold)
            const MIN_BARS = 10
            let targetDate = sortedDates[0] // fallback to most recent
            for (const date of sortedDates) {
                const bars = byDate.get(date) || []
                if (bars.length >= MIN_BARS) {
                    targetDate = date
                    break
                }
            }

            filtered = byDate.get(targetDate) || sorted
        }

        // Transform for chart - use label string for category axis
        const chartData = filtered.map((bar) => {
            const date = new Date(bar.t)
            let label: string
            if (period === '1D') {
                label = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            } else if (period === '1W') {
                label = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit' })
            } else {
                label = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
            }
            return {
                label,
                value: bar.c,
                fullDate: date.toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
            }
        })

        return { chartData }
    })()

    const { chartData } = processedData


    // Calculate change
    const firstValue = chartData[0]?.value || 0
    const lastValue = chartData[chartData.length - 1]?.value || 0
    const change = lastValue - firstValue
    const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0
    const isPositive = change >= 0

    return (
        <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-medium text-foreground">
                            Piyasa Görünümü
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            THYAO
                        </p>
                    </div>
                </div>

                {/* Period Tabs */}
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {(['1D', '1W', '1M'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                                period === p
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                {/* Value Display */}
                <div className="mb-4">
                    <div className="text-2xl font-bold text-foreground">
                        ₺{lastValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className={cn("text-sm font-medium", isPositive ? "text-chart-2" : "text-destructive")}>
                        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                        <span className="text-muted-foreground font-normal ml-2">{periodLabels[period]}</span>
                    </div>
                </div>

                {/* Chart */}
                <div ref={containerRef} className="h-[200px] sm:h-[250px] w-full min-w-0">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
                        </div>
                    ) : error ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-destructive text-sm">Veri yüklenemedi</div>
                        </div>
                    ) : dimensions.width > 0 && dimensions.height > 0 ? (
                        <AreaChart
                            data={chartData}
                            width={dimensions.width}
                            height={dimensions.height}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                        offset="5%"
                                        stopColor={isPositive ? 'var(--chart-2)' : 'var(--chart-3)'}
                                        stopOpacity={0.3}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor={isPositive ? 'var(--chart-2)' : 'var(--chart-3)'}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                interval="preserveStartEnd"
                                minTickGap={40}
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis
                                domain={['dataMin - 1', 'dataMax + 1']}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                width={50}
                                tickFormatter={(value) => `₺${value.toFixed(0)}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    color: 'hsl(var(--foreground))',
                                }}
                                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                                labelFormatter={(_, payload) => {
                                    if (payload && payload[0]?.payload?.fullDate) {
                                        return payload[0].payload.fullDate
                                    }
                                    return ''
                                }}
                                formatter={(value) => [
                                    `₺${(value as number).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                                    'Fiyat',
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={isPositive ? 'var(--chart-2)' : 'var(--chart-3)'}
                                strokeWidth={2}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
