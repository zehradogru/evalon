'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CoMovementMatrixDictionary } from '@/types'

type HeatmapVariant = 'correlation' | 'similarity' | 'distance'

interface CoMovementHeatmapProps {
    title: string
    description: string
    matrix?: CoMovementMatrixDictionary
    symbols: string[]
    variant: HeatmapVariant
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

function correlationCellClass(value: number): string {
    if (value >= 0.8) return 'bg-emerald-500/30 text-emerald-200'
    if (value >= 0.5) return 'bg-emerald-500/18 text-emerald-300'
    if (value >= 0.2) return 'bg-emerald-500/10 text-emerald-400'
    if (value > -0.2) return 'bg-slate-500/12 text-slate-300'
    if (value > -0.5) return 'bg-red-500/10 text-red-400'
    if (value > -0.8) return 'bg-red-500/18 text-red-300'
    return 'bg-red-500/30 text-red-200'
}

function similarityCellClass(value: number): string {
    if (value >= 0.85) return 'bg-cyan-500/30 text-cyan-100'
    if (value >= 0.7) return 'bg-cyan-500/20 text-cyan-200'
    if (value >= 0.55) return 'bg-teal-500/18 text-teal-200'
    if (value >= 0.4) return 'bg-teal-500/10 text-teal-300'
    return 'bg-slate-500/12 text-slate-300'
}

function distanceCellClass(value: number, maxDistance: number): string {
    if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
        return 'bg-slate-500/12 text-slate-300'
    }

    const normalized = clamp(value / maxDistance, 0, 1)
    if (normalized <= 0.15) return 'bg-emerald-500/28 text-emerald-100'
    if (normalized <= 0.35) return 'bg-emerald-500/18 text-emerald-200'
    if (normalized <= 0.55) return 'bg-amber-500/14 text-amber-200'
    if (normalized <= 0.75) return 'bg-orange-500/18 text-orange-200'
    return 'bg-red-500/24 text-red-100'
}

function formatValue(value: number | null, variant: HeatmapVariant): string {
    if (value === null || Number.isNaN(value)) return '—'
    const digits = variant === 'distance' ? 3 : 2
    return value.toFixed(digits)
}

export function CoMovementHeatmap({
    title,
    description,
    matrix,
    symbols,
    variant,
}: CoMovementHeatmapProps) {
    const maxDistance = useMemo(() => {
        if (variant !== 'distance' || !matrix) return 0

        let candidate = 0
        for (const row of symbols) {
            for (const column of symbols) {
                if (row === column) continue
                const value = matrix[row]?.[column]
                if (typeof value === 'number' && Number.isFinite(value)) {
                    candidate = Math.max(candidate, value)
                }
            }
        }
        return candidate
    }, [matrix, symbols, variant])

    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                {!matrix || symbols.length < 2 ? (
                    <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                        Heatmap verisi bekleniyor.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="border-collapse text-center text-xs">
                            <thead>
                                <tr>
                                    <th className="w-20 p-1" />
                                    {symbols.map((symbol) => (
                                        <th
                                            key={symbol}
                                            className="p-1 text-[11px] font-medium text-muted-foreground"
                                            style={{
                                                writingMode: 'vertical-rl',
                                                transform: 'rotate(180deg)',
                                                height: 84,
                                            }}
                                        >
                                            {symbol}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {symbols.map((rowSymbol) => (
                                    <tr key={rowSymbol}>
                                        <td className="p-1 pr-2 text-right text-[11px] font-medium text-muted-foreground">
                                            {rowSymbol}
                                        </td>
                                        {symbols.map((columnSymbol) => {
                                            const value = matrix[rowSymbol]?.[columnSymbol] ?? null
                                            const isDiagonal = rowSymbol === columnSymbol

                                            let colorClass = 'bg-slate-500/12 text-slate-300'
                                            if (typeof value === 'number' && !Number.isNaN(value)) {
                                                colorClass =
                                                    variant === 'correlation'
                                                        ? correlationCellClass(value)
                                                        : variant === 'similarity'
                                                          ? similarityCellClass(value)
                                                          : distanceCellClass(value, maxDistance)
                                            }

                                            return (
                                                <td
                                                    key={`${rowSymbol}-${columnSymbol}`}
                                                    title={`${rowSymbol} / ${columnSymbol}: ${formatValue(value, variant)}`}
                                                    className={cn(
                                                        'h-10 w-14 rounded border border-border/25 px-2 transition-colors',
                                                        isDiagonal
                                                            ? 'bg-primary/12 font-semibold text-primary'
                                                            : colorClass
                                                    )}
                                                >
                                                    {formatValue(value, variant)}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    {variant === 'correlation' ? (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-red-500/24" />
                                Negatif
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-slate-500/12" />
                                Nötr
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-emerald-500/24" />
                                Pozitif
                            </div>
                        </>
                    ) : variant === 'similarity' ? (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-slate-500/12" />
                                Düşük benzerlik
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-cyan-500/24" />
                                Güçlü benzerlik
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-emerald-500/24" />
                                Yakın mesafe
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="inline-block h-3 w-5 rounded bg-red-500/24" />
                                Uzak mesafe
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
