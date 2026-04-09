'use client'

import { LineChart, Line } from 'recharts'
import { PriceBar } from '@/types'

interface MiniChartProps {
    data: PriceBar[]
    isPositive: boolean
    width?: number
    height?: number
}

export function MiniChart({
    data,
    isPositive,
    width = 60,
    height = 28
}: MiniChartProps) {
    // Transform data for recharts
    const chartData = data.map((bar) => ({
        value: bar.c,
    }))

    if (chartData.length === 0) {
        return (
            <div
                style={{ width, height }}
                className="bg-secondary/50 rounded animate-pulse"
            />
        )
    }

    const strokeColor = isPositive ? 'var(--chart-2)' : 'var(--chart-3)'

    // Use fixed dimensions instead of ResponsiveContainer to avoid sizing issues
    return (
        <LineChart width={width} height={height} data={chartData}>
            <Line
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
            />
        </LineChart>
    )
}
