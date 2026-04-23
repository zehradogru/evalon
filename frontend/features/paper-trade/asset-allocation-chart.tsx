'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import type { PaperPortfolio } from '@/types/paper-trade'

interface AssetAllocationChartProps {
    portfolio: PaperPortfolio
}

const COLORS = [
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ec4899', // pink
    '#3b82f6', // blue
    '#ef4444', // red
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
]

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AssetAllocationChart({ portfolio }: AssetAllocationChartProps) {
    const data = useMemo(() => {
        const positions = Object.values(portfolio.positions)
        const items = positions.map((p) => ({
            name: p.ticker,
            value: Math.round(p.marketValue * 100) / 100,
            percent: portfolio.totalValue > 0
                ? Math.round((p.marketValue / portfolio.totalValue) * 10000) / 100
                : 0,
        }))

        // Add cash
        items.push({
            name: 'Nakit',
            value: Math.round(portfolio.cashBalance * 100) / 100,
            percent: portfolio.totalValue > 0
                ? Math.round((portfolio.cashBalance / portfolio.totalValue) * 10000) / 100
                : 100,
        })

        // Sort by value desc
        items.sort((a, b) => b.value - a.value)
        return items
    }, [portfolio])

    if (data.length <= 1 && data[0]?.name === 'Nakit') {
        return (
            <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <PieChartIcon size={14} className="text-violet-400" />
                    <h3 className="text-xs font-semibold text-foreground">Varlık Dağılımı</h3>
                </div>
                <div className="flex items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted-foreground">Portföyünüzde henüz hisse bulunmuyor.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-3">
                <PieChartIcon size={14} className="text-violet-400" />
                <h3 className="text-xs font-semibold text-foreground">Varlık Dağılımı</h3>
            </div>

            <div className="flex items-center gap-4">
                {/* Chart */}
                <div className="h-[160px] w-[160px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={72}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((_, idx) => (
                                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null
                                    const d = payload[0].payload
                                    return (
                                        <div className="rounded-lg bg-[rgba(15,15,20,0.95)] border border-white/10 px-3 py-2 text-xs shadow-xl">
                                            <p className="font-bold text-foreground">{d.name}</p>
                                            <p className="text-muted-foreground">₺{formatCurrency(d.value)} ({d.percent}%)</p>
                                        </div>
                                    )
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[160px]">
                    {data.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                />
                                <span className="text-[11px] text-foreground font-medium truncate">{item.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                                {item.percent}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
