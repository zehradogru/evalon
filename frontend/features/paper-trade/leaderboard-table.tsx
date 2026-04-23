'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, TrendingUp, Target, BarChart3, Medal, Loader2, RefreshCw, Crown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { paperTradeService } from '@/services/paper-trade.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { LeaderboardEntry, LeaderboardSortBy } from '@/types/paper-trade'

const SORT_OPTIONS: { id: LeaderboardSortBy; label: string; icon: typeof TrendingUp }[] = [
    { id: 'pnl', label: 'Kâr/Zarar', icon: TrendingUp },
    { id: 'totalValue' as LeaderboardSortBy, label: 'Toplam Değer', icon: DollarSign },
    { id: 'winRate', label: 'Kazanma Oranı', icon: Target },
    { id: 'trades', label: 'İşlem Sayısı', icon: BarChart3 },
]

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getRankBadge(rank: number) {
    if (rank === 1) return <Crown size={16} className="text-yellow-400" />
    if (rank === 2) return <Medal size={16} className="text-gray-300" />
    if (rank === 3) return <Medal size={16} className="text-amber-600" />
    return <span className="text-xs text-muted-foreground font-mono w-4 text-center">{rank}</span>
}

function getRowStyle(rank: number) {
    if (rank === 1) return 'bg-yellow-500/5 border-yellow-500/20'
    if (rank === 2) return 'bg-gray-400/5 border-gray-400/15'
    if (rank === 3) return 'bg-amber-600/5 border-amber-600/15'
    return 'bg-transparent border-transparent'
}

export function LeaderboardTable() {
    const { user } = useAuthStore()
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<LeaderboardSortBy>('pnl')

    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await paperTradeService.getLeaderboard(sortBy, 50)
            setEntries(res.entries)
        } catch (err: any) {
            console.error(err)
            setError(err.message)
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [sortBy])

    useEffect(() => { load() }, [load])

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <Trophy size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Liderlik Tablosu</h2>
                        <p className="text-xs text-muted-foreground">Paper Trading topluluk sıralaması</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
                </button>
            </div>

            {/* Sort Pills */}
            <div className="flex items-center gap-1.5 bg-secondary/20 p-1 rounded-xl">
                {SORT_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => setSortBy(opt.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            sortBy === opt.id
                                ? 'bg-primary/15 text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                        )}
                    >
                        <opt.icon size={12} />
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-red-500/20 bg-red-500/5 rounded-xl">
                    <p className="text-sm font-semibold text-red-500 mb-1">Veri Çekilemedi</p>
                    <p className="text-xs text-red-400 max-w-md">{error}</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Trophy size={32} className="text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Henüz kimse işlem yapmamış.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">İlk işleminizi yaparak tabloda yerinizi alın!</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {/* Column Headers */}
                    <div className="grid grid-cols-[2rem_1fr_5.5rem_5rem_5rem_4.5rem_4.5rem] gap-2 px-3 py-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                        <span>#</span>
                        <span>Kullanıcı</span>
                        <span className="text-right">Toplam</span>
                        <span className="text-right">P&L</span>
                        <span className="text-right">P&L %</span>
                        <span className="text-right">Win %</span>
                        <span className="text-right">İşlem</span>
                    </div>

                    {/* Rows */}
                    {entries.map((entry) => {
                        const isCurrentUser = user?.id === entry.userId
                        return (
                            <div
                                key={entry.userId}
                                className={cn(
                                    'grid grid-cols-[2rem_1fr_5.5rem_5rem_5rem_4.5rem_4.5rem] gap-2 items-center px-3 py-2.5 rounded-xl border transition-all',
                                    getRowStyle(entry.rank),
                                    isCurrentUser && 'ring-1 ring-primary/30 bg-primary/5'
                                )}
                            >
                                {/* Rank */}
                                <div className="flex items-center justify-center">
                                    {getRankBadge(entry.rank)}
                                </div>

                                {/* Name */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
                                        {(entry.displayName || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={cn(
                                            'text-xs font-semibold truncate',
                                            isCurrentUser ? 'text-primary' : 'text-foreground'
                                        )}>
                                            {entry.displayName}
                                            {isCurrentUser && <span className="ml-1 text-[9px] text-primary/70">(sen)</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* Total Value */}
                                <p className="text-xs font-bold text-foreground text-right tabular-nums">
                                    ₺{formatCurrency((entry as any).totalValue || 100000)}
                                </p>

                                {/* P&L */}
                                <p className={cn(
                                    'text-xs font-semibold text-right tabular-nums',
                                    entry.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                                )}>
                                    {entry.totalPnL >= 0 ? '+' : ''}₺{formatCurrency(entry.totalPnL)}
                                </p>

                                {/* P&L % */}
                                <p className={cn(
                                    'text-xs font-semibold text-right tabular-nums',
                                    entry.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                                )}>
                                    {entry.totalPnLPercent >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(2)}%
                                </p>

                                {/* Win Rate */}
                                <p className="text-xs text-muted-foreground text-right tabular-nums">
                                    {entry.winRate.toFixed(0)}%
                                </p>

                                {/* Trade Count */}
                                <p className="text-xs text-muted-foreground text-right tabular-nums">
                                    {entry.totalTrades}
                                </p>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
