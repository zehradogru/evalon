'use client'

import type { PriceBar } from '@/types'
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts'
import { BarChart3 } from 'lucide-react'

interface SimulatorChartProps {
    data: PriceBar[]
    ticker: string | null
}

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SimulatorChart({ data, ticker }: SimulatorChartProps) {
    if (!ticker || data.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card/60 p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                <BarChart3 size={32} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                    Grafik görmek için yukarıdan bir hisse seçin
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                    Sadece simülasyon tarihine kadar olan veriler gösterilir
                </p>
            </div>
        )
    }

    const chartData = data.map((bar) => ({
        date: new Date(bar.t).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        close: bar.c,
        high: bar.h,
        low: bar.l,
        volume: bar.v,
    }))

    const firstClose = chartData[0]?.close || 0
    const lastClose = chartData[chartData.length - 1]?.close || 0
    const isPositive = lastClose >= firstClose

    return (
        <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-foreground">
                    {ticker} — Fiyat Grafiği
                </h3>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">
                        {data.length} gün
                    </span>
                    <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                        {isPositive ? '▲' : '▼'}{' '}
                        {(((lastClose - firstClose) / firstClose) * 100).toFixed(2)}%
                    </span>
                </div>
            </div>
            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <defs>
                            <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={isPositive ? '#10b981' : '#ef4444'}
                                    stopOpacity={0.25}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={isPositive ? '#10b981' : '#ef4444'}
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.04)"
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#666' }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#666' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `₺${v.toFixed(0)}`}
                            domain={['auto', 'auto']}
                            width={55}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'rgba(12,12,16,0.95)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                fontSize: '12px',
                                padding: '8px 12px',
                            }}
                            formatter={(value) => [
                                `₺${formatCurrency(Number(value ?? 0))}`,
                                'Kapanış',
                            ]}
                            labelFormatter={(label) => `Tarih: ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="close"
                            stroke={isPositive ? '#10b981' : '#ef4444'}
                            strokeWidth={2}
                            fill="url(#simGradient)"
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
