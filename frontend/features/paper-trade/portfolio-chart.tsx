'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { DailySnapshot } from '@/types/paper-trade'
import { PAPER_TRADE_INITIAL_BALANCE } from '@/types/paper-trade'

interface PortfolioChartProps {
    snapshots: DailySnapshot[]
    initialBalance?: number
}

export function PortfolioChart({ snapshots, initialBalance = PAPER_TRADE_INITIAL_BALANCE }: PortfolioChartProps) {
    const chartData = useMemo(() => {
        if (snapshots.length === 0) return []
        return snapshots.map((s) => ({
            date: s.date,
            value: s.totalValue,
            pnl: s.cumulativePnL,
            label: new Date(s.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        }))
    }, [snapshots])

    if (chartData.length < 2) {
        return (
            <div className="rounded-xl border border-border bg-card">
                <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Portfolio Value Chart</h3>
                </div>
                <div className="p-10 text-center">
                    <p className="text-sm text-muted-foreground">Not enough data for chart.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">At least 2 daily snapshots required.</p>
                </div>
            </div>
        )
    }

    const latestValue = chartData[chartData.length - 1]?.value || initialBalance
    const isPositive = latestValue >= initialBalance
    const gradientId = `portfolioGradient_${isPositive ? 'up' : 'down'}`
    const strokeColor = isPositive ? '#34d399' : '#f87171'

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Portfolio Value Chart</h3>
            </div>
            <div className="p-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#787B86' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            hide
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1E222D',
                                border: '1px solid #2A2E39',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#D1D4DC',
                            }}
                            formatter={(value) => [
                                `₺${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                                'Portfolio Value',
                            ]}
                            labelFormatter={(label) => String(label)}
                        />
                        <ReferenceLine
                            y={initialBalance}
                            stroke="#787B86"
                            strokeDasharray="3 3"
                            strokeWidth={1}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={strokeColor}
                            strokeWidth={2}
                            fill={`url(#${gradientId})`}
                            animationDuration={800}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
