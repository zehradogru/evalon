'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, ArrowDownUp } from 'lucide-react'
import type { PaperTrade } from '@/types/paper-trade'

interface TradeHistoryTableProps {
    trades: PaperTrade[]
    loading?: boolean
    hasMore?: boolean
    onLoadMore?: () => void
}

export function TradeHistoryTable({ trades, loading, hasMore, onLoadMore }: TradeHistoryTableProps) {
    if (trades.length === 0 && !loading) {
        return (
            <div className="rounded-xl border border-border bg-card">
                <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Trade History</h3>
                </div>
                <div className="p-10 text-center">
                    <p className="text-sm text-muted-foreground">No trades yet.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                    Trade History ({trades.length})
                </h3>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
                            <th className="text-left p-3 font-medium">Tarih</th>
                            <th className="text-left p-3 font-medium">Hisse</th>
                            <th className="text-center p-3 font-medium">Trade</th>
                            <th className="text-right p-3 font-medium">Adet</th>
                            <th className="text-right p-3 font-medium">Fiyat</th>
                            <th className="text-right p-3 font-medium">Tutar</th>
                            <th className="text-right p-3 font-medium">Komisyon</th>
                            <th className="text-right p-3 font-medium">P&L</th>
                            <th className="text-right p-3 font-medium">Bakiye</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trades.map((trade) => {
                            const isBuy = trade.side === 'buy'
                            const hasPnl = trade.pnl !== null
                            const isPositive = hasPnl && (trade.pnl ?? 0) >= 0
                            const date = new Date(trade.createdAt)

                            return (
                                <tr key={trade.tradeId} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                        <p>{date.toLocaleDateString('en-US')}</p>
                                        <p className="text-[10px] opacity-60">{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </td>
                                    <td className="p-3">
                                        <span className="font-bold text-foreground text-xs">{trade.ticker}</span>
                                        <span className="text-[10px] text-muted-foreground ml-1.5">{trade.tickerName}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={cn(
                                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                            isBuy
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-red-500/10 text-red-400'
                                        )}>
                                            {isBuy ? '↑ BUY' : '↓ SELL'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-foreground text-xs">{trade.quantity.toLocaleString('en-US')}</td>
                                    <td className="p-3 text-right text-foreground text-xs">₺{trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right text-foreground text-xs">₺{trade.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right text-muted-foreground text-xs">₺{trade.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right">
                                        {hasPnl ? (
                                            <span className={cn('text-xs font-semibold', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                                                {isPositive ? '+' : ''}₺{(trade.pnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50">—</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right text-muted-foreground text-xs">
                                        ₺{trade.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border/30">
                {trades.map((trade) => {
                    const isBuy = trade.side === 'buy'
                    const hasPnl = trade.pnl !== null
                    const isPositive = hasPnl && (trade.pnl ?? 0) >= 0
                    const date = new Date(trade.createdAt)

                    return (
                        <div key={trade.tradeId} className="p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
                                        isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                    )}>
                                        {isBuy ? 'BUY' : 'SELL'}
                                    </span>
                                    <span className="font-bold text-foreground text-xs">{trade.ticker}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{date.toLocaleDateString('en-US')}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">
                                    {trade.quantity} × ₺{trade.price.toFixed(2)}
                                </span>
                                {hasPnl ? (
                                    <span className={cn('font-semibold', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                                        {isPositive ? '+' : ''}₺{(trade.pnl ?? 0).toFixed(2)}
                                    </span>
                                ) : (
                                    <span className="text-foreground font-medium">₺{trade.total.toFixed(2)}</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Load More */}
            {hasMore && (
                <div className="p-3 text-center border-t border-border/30">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    )
}
