'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePaperTradeStore } from '@/store/use-paper-trade-store'
import { useAuthStore } from '@/store/use-auth-store'
import { TimeMachinePanel } from './time-machine-panel'

type WidgetTab = 'portfolio' | 'simulation'

export function PaperTradeWidget() {
    const [activeTab, setActiveTab] = useState<WidgetTab>('portfolio')
    const { user } = useAuthStore()
    const { portfolio, portfolioLoading, portfolioError, initialize } = usePaperTradeStore()

    useEffect(() => {
        if (user && !portfolio && !portfolioLoading) {
            initialize(user.id, user.name ?? user.email ?? 'Trader')
        }
    }, [user, portfolio, portfolioLoading, initialize])

    const isPositive = (portfolio?.totalPnL ?? 0) >= 0
    const positions = portfolio ? Object.values(portfolio.positions) : []
    const positionsValue = positions.reduce((sum, p) => sum + p.marketValue, 0)
    const cashPct = portfolio && portfolio.totalValue > 0
        ? ((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(0)
        : '100'
    const posPct = portfolio && portfolio.totalValue > 0
        ? ((positionsValue / portfolio.totalValue) * 100).toFixed(0)
        : '0'

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 flex-shrink-0">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BriefcaseBusiness className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground flex-1">Paper Trade</h2>
                <Link
                    href="/paper-trade"
                    className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                >
                    Tam Sayfa <ArrowRight size={11} />
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 flex-shrink-0">
                {(['portfolio', 'simulation'] as WidgetTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'flex-1 py-2 text-xs font-medium transition-colors',
                            activeTab === tab
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tab === 'portfolio' ? 'Portföy' : 'Simülasyon'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">

                {/* ── Portfolio Tab ── */}
                {activeTab === 'portfolio' && (
                    <div className="p-3 space-y-3">
                        {portfolioLoading && (
                            <div className="flex items-center justify-center py-10">
                                <p className="text-xs text-muted-foreground">Yükleniyor…</p>
                            </div>
                        )}
                        {portfolioError && (
                            <p className="text-xs text-destructive p-2">{portfolioError}</p>
                        )}
                        {!portfolioLoading && !portfolio && !portfolioError && (
                            <div className="text-center py-8 space-y-2">
                                <p className="text-xs text-muted-foreground">Portföy yüklenemedi.</p>
                                <Link href="/paper-trade" className="text-xs text-primary hover:underline">
                                    Paper Trade sayfasına git →
                                </Link>
                            </div>
                        )}

                        {portfolio && (
                            <>
                                {/* Value card */}
                                <div className="rounded-xl bg-secondary/20 border border-border/40 p-3.5 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Portföy Değeri</p>
                                            <p className="text-lg font-bold text-foreground leading-tight mt-0.5">
                                                ₺{portfolio.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0',
                                            isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                        )}>
                                            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                            {isPositive ? '+' : ''}{portfolio.totalPnLPercent.toFixed(2)}%
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className={cn('text-xs font-medium', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                                            {isPositive ? '+' : ''}₺{portfolio.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{portfolio.totalTrades} işlem</span>
                                    </div>

                                    {/* Allocation bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Nakit %{cashPct}</span>
                                            <span>Hisse %{posPct}</span>
                                        </div>
                                        <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-primary/50 transition-all duration-500" style={{ width: `${cashPct}%` }} />
                                            <div className="h-full bg-emerald-500/50 transition-all duration-500" style={{ width: `${posPct}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Cash + Positions */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-secondary/10 border border-border/30 p-2.5">
                                        <p className="text-[10px] text-muted-foreground">Nakit</p>
                                        <p className="text-xs font-semibold text-foreground mt-0.5">
                                            ₺{portfolio.cashBalance.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-secondary/10 border border-border/30 p-2.5">
                                        <p className="text-[10px] text-muted-foreground">Pozisyon</p>
                                        <p className="text-xs font-semibold text-foreground mt-0.5">
                                            ₺{positionsValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Positions list */}
                                {positions.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Açık Pozisyonlar ({positions.length})
                                        </p>
                                        {positions.slice(0, 5).map((pos) => {
                                            const up = pos.unrealizedPnL >= 0
                                            return (
                                                <div
                                                    key={pos.ticker}
                                                    className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 border border-border/30"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-foreground">{pos.ticker}</p>
                                                        <p className="text-[10px] text-muted-foreground">{pos.quantity} lot · ₺{pos.currentPrice.toFixed(2)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium text-foreground">
                                                            ₺{pos.marketValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </p>
                                                        <p className={cn('text-[10px] font-medium', up ? 'text-emerald-400' : 'text-red-400')}>
                                                            {up ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {positions.length > 5 && (
                                            <Link href="/paper-trade" className="text-[10px] text-primary hover:underline block text-center pt-0.5">
                                                +{positions.length - 5} pozisyon daha →
                                            </Link>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border/40 p-4 text-center">
                                        <p className="text-xs text-muted-foreground">Açık pozisyon yok</p>
                                        <Link href="/paper-trade" className="text-[10px] text-primary hover:underline mt-1 block">
                                            Emir ver →
                                        </Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── Simulation Tab ── */}
                {activeTab === 'simulation' && (
                    <div className="p-3">
                        <TimeMachinePanel />
                    </div>
                )}
            </div>
        </div>
    )
}
