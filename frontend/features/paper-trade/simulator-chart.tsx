'use client'

import type { PriceBar } from '@/types'
import { BarChart3, Loader2 } from 'lucide-react'
import { CandlestickChart } from '@/components/candlestick-chart'

interface SimulatorChartProps {
    data: PriceBar[]
    ticker: string | null
    currentTime: string
    isLoading: boolean
}

export function SimulatorChart({
    data,
    ticker,
    currentTime,
    isLoading,
}: SimulatorChartProps) {
    if (!ticker) {
        return (
            <div className="rounded-xl border border-border bg-card/60 p-8 flex min-h-[320px] flex-col items-center justify-center text-center">
                <BarChart3 size={32} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                    Grafik gormek icin yukaridan bir hisse secin
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                    Mobildeki gibi secili mum verisi dogrudan charta basilir
                </p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card/60 p-8 flex min-h-[320px] flex-col items-center justify-center text-center">
                <Loader2 size={28} className="animate-spin text-cyan-400 mb-3" />
                <p className="text-sm text-muted-foreground">{ticker} 1 dakikalik verileri yukleniyor</p>
            </div>
        )
    }

    if (!data.length) {
        return (
            <div className="rounded-xl border border-border bg-card/60 p-8 flex min-h-[320px] flex-col items-center justify-center text-center">
                <BarChart3 size={32} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                    {ticker} icin bu ana kadar olusmus 1 dakikalik mum yok
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {new Date(currentTime).toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-semibold text-foreground">
                        {ticker} - 1 Dakikalik Replay
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(currentTime).toLocaleString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </p>
                </div>
                <span className="text-[10px] text-muted-foreground">{data.length} mum</span>
            </div>

            <div className="h-[320px] overflow-hidden rounded-lg">
                <CandlestickChart data={data} />
            </div>
        </div>
    )
}
