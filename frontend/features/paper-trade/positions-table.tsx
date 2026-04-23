'use client'

import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaperPosition, PaperPortfolio } from '@/types/paper-trade'

interface PositionsTableProps {
    portfolio: PaperPortfolio
    onSellClick?: (ticker: string) => void
    onTickerClick?: (ticker: string) => void
}

export function PositionsTable({ portfolio, onSellClick, onTickerClick }: PositionsTableProps) {
    const positions = Object.values(portfolio.positions).sort(
        (a, b) => Math.abs(b.unrealizedPnL) - Math.abs(a.unrealizedPnL)
    )

    if (positions.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card">
                <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Açık Pozisyonlar</h3>
                </div>
                <div className="p-10 text-center">
                    <p className="text-sm text-muted-foreground">Henüz açık pozisyonunuz yok.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        Emir giriş panelinden hisse alarak başlayın.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                    Açık Pozisyonlar ({positions.length})
                </h3>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
                            <th className="text-left p-3 font-medium">Hisse</th>
                            <th className="text-right p-3 font-medium">Adet</th>
                            <th className="text-right p-3 font-medium">Ort. Maliyet</th>
                            <th className="text-right p-3 font-medium">Güncel Fiyat</th>
                            <th className="text-right p-3 font-medium">Piyasa Değeri</th>
                            <th className="text-right p-3 font-medium">P&L</th>
                            <th className="text-right p-3 font-medium">Ağırlık</th>
                            <th className="text-right p-3 font-medium">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos) => {
                            const isPositive = pos.unrealizedPnL >= 0
                            return (
                                <tr
                                    key={pos.ticker}
                                    className="border-b border-border/30 hover:bg-muted/20 transition-colors group"
                                >
                                    <td className="p-3">
                                        <button
                                            onClick={() => onTickerClick?.(pos.ticker)}
                                            className="flex flex-col items-start hover:text-primary transition-colors"
                                        >
                                            <span className="font-bold text-foreground text-sm">{pos.ticker}</span>
                                            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                                                {pos.tickerName}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="p-3 text-right text-foreground font-medium">
                                        {pos.quantity.toLocaleString('tr-TR')}
                                    </td>
                                    <td className="p-3 text-right text-muted-foreground">
                                        ₺{pos.avgCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right text-foreground font-medium">
                                        ₺{pos.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right text-foreground">
                                        ₺{pos.marketValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className={cn('flex items-center justify-end gap-1', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                                            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            <div className="flex flex-col items-end">
                                                <span className="font-semibold text-xs">
                                                    {isPositive ? '+' : ''}₺{pos.unrealizedPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[10px] opacity-70">
                                                    {isPositive ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right text-muted-foreground text-xs">
                                        %{pos.weight.toFixed(1)}
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => onSellClick?.(pos.ticker)}
                                            className="px-3 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            Sat
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/30">
                {positions.map((pos) => {
                    const isPositive = pos.unrealizedPnL >= 0
                    return (
                        <div key={pos.ticker} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => onTickerClick?.(pos.ticker)}
                                    className="flex items-center gap-2"
                                >
                                    <span className="font-bold text-foreground text-sm">{pos.ticker}</span>
                                    <span className="text-[10px] text-muted-foreground">{pos.tickerName}</span>
                                </button>
                                <div className={cn('text-right', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                                    <p className="text-xs font-semibold">
                                        {isPositive ? '+' : ''}₺{pos.unrealizedPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] opacity-70">
                                        {isPositive ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[11px]">
                                <div>
                                    <p className="text-muted-foreground/60">Adet</p>
                                    <p className="text-foreground font-medium">{pos.quantity}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground/60">Ort. Maliyet</p>
                                    <p className="text-foreground">₺{pos.avgCost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground/60">Güncel</p>
                                    <p className="text-foreground font-medium">₺{pos.currentPrice.toFixed(2)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onSellClick?.(pos.ticker)}
                                className="w-full py-1.5 rounded-md bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                            >
                                Sat
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
