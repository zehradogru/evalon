'use client'

import { useEffect, useMemo } from 'react'
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    BarChart3,
    RefreshCw,
    PieChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaperPortfolio } from '@/types/paper-trade'

interface PortfolioSummaryCardProps {
    portfolio: PaperPortfolio
    onReset?: () => void
}

export function PortfolioSummaryCard({ portfolio, onReset }: PortfolioSummaryCardProps) {
    const isPositive = portfolio.totalPnL >= 0
    const positionsValue = useMemo(
        () =>
            Object.values(portfolio.positions).reduce((sum, p) => sum + p.marketValue, 0),
        [portfolio.positions]
    )
    const cashPercent = portfolio.totalValue > 0
        ? ((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(1)
        : '100'
    const posPercent = portfolio.totalValue > 0
        ? ((positionsValue / portfolio.totalValue) * 100).toFixed(1)
        : '0'

    return (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Wallet size={18} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Virtual Portfolio</h3>
                        <p className="text-[11px] text-muted-foreground">
                            {portfolio.resetCount > 0
                                ? `${portfolio.resetCount}. reset`
                                : 'New portfolio'}
                        </p>
                    </div>
                </div>
                {onReset && (
                    <button
                        onClick={onReset}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2.5 py-1.5 rounded-lg hover:bg-destructive/10"
                        title="Reset Portfolio"
                    >
                        <RefreshCw size={13} />
                        Reset
                    </button>
                )}
            </div>

            {/* Total Value */}
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <div className="flex items-end gap-3">
                    <span className="text-2xl font-bold text-foreground tracking-tight">
                        ₺{portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className={cn(
                        'flex items-center gap-1 text-sm font-semibold pb-0.5',
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                    )}>
                        {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        <span>
                            {isPositive ? '+' : ''}₺{portfolio.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs opacity-80">
                            ({isPositive ? '+' : ''}{portfolio.totalPnLPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Nakit Bakiye</p>
                    <p className="text-sm font-semibold text-foreground">
                        ₺{portfolio.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Position Value</p>
                    <p className="text-sm font-semibold text-foreground">
                        ₺{positionsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Trade Count</p>
                    <p className="text-sm font-semibold text-foreground">{portfolio.totalTrades}</p>
                </div>
            </div>

            {/* Allocation Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Nakit: %{cashPercent}</span>
                    <span>Hisse: %{posPercent}</span>
                </div>
                <div className="h-2 bg-secondary/40 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-primary/60 rounded-l-full transition-all duration-500"
                        style={{ width: `${cashPercent}%` }}
                    />
                    <div
                        className="h-full bg-emerald-500/60 rounded-r-full transition-all duration-500"
                        style={{ width: `${posPercent}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
