'use client'

import { TrendingUp, TrendingDown, Target, Award, BarChart3, Activity, Zap, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortfolioMetrics } from '@/types/paper-trade'

interface PerformanceMetricsProps {
    metrics: PortfolioMetrics
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
    const cards = [
        {
            label: 'Toplam P&L',
            value: `${metrics.totalPnL >= 0 ? '+' : ''}₺${metrics.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            sub: `${metrics.totalPnLPercent >= 0 ? '+' : ''}${metrics.totalPnLPercent.toFixed(2)}%`,
            icon: metrics.totalPnL >= 0 ? TrendingUp : TrendingDown,
            color: metrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
            bgColor: metrics.totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
        },
        {
            label: 'Win Rate',
            value: `%${metrics.winRate.toFixed(1)}`,
            sub: `${metrics.winningTrades}W / ${metrics.losingTrades}L`,
            icon: Target,
            color: metrics.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
            bgColor: metrics.winRate >= 50 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
        },
        {
            label: 'Profit Factor',
            value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2),
            sub: `Avg Win: ₺${metrics.avgWin.toFixed(0)} / Avg Loss: ₺${metrics.avgLoss.toFixed(0)}`,
            icon: BarChart3,
            color: metrics.profitFactor >= 1.5 ? 'text-emerald-400' : metrics.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400',
            bgColor: metrics.profitFactor >= 1.5 ? 'bg-emerald-500/10' : metrics.profitFactor >= 1 ? 'bg-amber-500/10' : 'bg-red-500/10',
        },
        {
            label: 'Max Drawdown',
            value: `%${metrics.maxDrawdownPercent.toFixed(2)}`,
            sub: `₺${metrics.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            icon: Shield,
            color: metrics.maxDrawdownPercent <= 5 ? 'text-emerald-400' : metrics.maxDrawdownPercent <= 15 ? 'text-amber-400' : 'text-red-400',
            bgColor: metrics.maxDrawdownPercent <= 5 ? 'bg-emerald-500/10' : metrics.maxDrawdownPercent <= 15 ? 'bg-amber-500/10' : 'bg-red-500/10',
        },
        {
            label: 'Best Trade',
            value: `+₺${metrics.bestTrade.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            sub: '',
            icon: Award,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
        },
        {
            label: 'Worst Trade',
            value: `₺${metrics.worstTrade.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            sub: '',
            icon: Activity,
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
        },
        {
            label: 'Sharpe Ratio',
            value: metrics.sharpeRatio.toFixed(2),
            sub: '',
            icon: Zap,
            color: metrics.sharpeRatio >= 1 ? 'text-emerald-400' : metrics.sharpeRatio >= 0 ? 'text-amber-400' : 'text-red-400',
            bgColor: metrics.sharpeRatio >= 1 ? 'bg-emerald-500/10' : metrics.sharpeRatio >= 0 ? 'bg-amber-500/10' : 'bg-red-500/10',
        },
        {
            label: 'Trade Streak',
            value: metrics.currentStreak > 0
                ? `${metrics.currentStreak} wins 🔥`
                : metrics.currentStreak < 0
                    ? `${Math.abs(metrics.currentStreak)} losses`
                    : '—',
            sub: `Total: ${metrics.totalTrades} trades`,
            icon: Zap,
            color: metrics.currentStreak > 0 ? 'text-emerald-400' : metrics.currentStreak < 0 ? 'text-red-400' : 'text-muted-foreground',
            bgColor: metrics.currentStreak > 0 ? 'bg-emerald-500/10' : metrics.currentStreak < 0 ? 'bg-red-500/10' : 'bg-secondary/30',
        },
    ]

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Performans Metrikleri</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Detailed analysis of your decisions</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30">
                {cards.map((card, i) => (
                    <div key={i} className="p-4 bg-card space-y-2 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-2">
                            <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', card.bgColor)}>
                                <card.icon size={14} className={card.color} />
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium">{card.label}</span>
                        </div>
                        <p className={cn('text-lg font-bold tracking-tight', card.color)}>{card.value}</p>
                        {card.sub && <p className="text-[10px] text-muted-foreground/70">{card.sub}</p>}
                    </div>
                ))}
            </div>
        </div>
    )
}
