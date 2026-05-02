'use client'

import { useMemo } from 'react'
import { useSimulatorStore } from '@/store/use-simulator-store'
import {
    getPortfolioValue,
    getTotalPnL,
    getTotalPnLPercent,
} from '@/types/simulator'
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
    Trophy,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Clock,
    Wallet,
    ArrowRight,
    RotateCcw,
    Sparkles,
    DollarSign,
    Target,
} from 'lucide-react'

interface SimulatorResultsProps {
    onPlayAgain: () => void
}

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SimulatorResults({ onPlayAgain }: SimulatorResultsProps) {
    const store = useSimulatorStore()
    const { config, tradeHistory, portfolioSnapshots, positions, balance, peakValue } = store

    const portfolioValue = getPortfolioValue(store)
    const totalPnL = getTotalPnL(store)
    const totalPnLPct = getTotalPnLPercent(store)
    const isPositive = totalPnL >= 0

    // ─── Computed Stats ───
    const stats = useMemo(() => {
        const totalTrades = tradeHistory.length
        const buyTrades = tradeHistory.filter((t) => t.side === 'buy')
        const sellTrades = tradeHistory.filter((t) => t.side === 'sell')
        const uniqueTickers = new Set(tradeHistory.map((t) => t.ticker)).size

        // Best and worst position (from trades)
        const tickerPnL: Record<string, number> = {}
        for (const trade of tradeHistory) {
            if (!tickerPnL[trade.ticker]) tickerPnL[trade.ticker] = 0
            if (trade.side === 'sell') {
                tickerPnL[trade.ticker] += trade.total
            } else {
                tickerPnL[trade.ticker] -= trade.total
            }
        }
        // Add unrealized PnL from open positions
        for (const pos of Object.values(positions)) {
            if (!tickerPnL[pos.ticker]) tickerPnL[pos.ticker] = 0
            tickerPnL[pos.ticker] += pos.shares * pos.currentPrice
        }

        const sortedTickers = Object.entries(tickerPnL).sort((a, b) => b[1] - a[1])
        const bestTicker = sortedTickers[0] || null
        const worstTicker = sortedTickers[sortedTickers.length - 1] || null

        // Max drawdown
        let maxDrawdown = 0
        let peak = config.initialBalance
        for (const snap of portfolioSnapshots) {
            if (snap.value > peak) peak = snap.value
            const drawdown = ((peak - snap.value) / peak) * 100
            if (drawdown > maxDrawdown) maxDrawdown = drawdown
        }

        // Days
        const startTime = new Date(config.startDate).getTime()
        const endTime = new Date(config.endDate).getTime()
        const totalDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24))

        return {
            totalTrades,
            buyCount: buyTrades.length,
            sellCount: sellTrades.length,
            uniqueTickers,
            bestTicker,
            worstTicker,
            maxDrawdown,
            totalDays,
        }
    }, [tradeHistory, positions, portfolioSnapshots, config])

    // ─── Chart Data ───
    const chartData = portfolioSnapshots.map((snap) => ({
        date: new Date(snap.date).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
        }),
        value: snap.value,
    }))

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {/* ═══ Header ═══ */}
            <div className="text-center">
                <div
                    className={cn(
                        'inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4',
                        isPositive
                            ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20'
                            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20'
                    )}
                >
                    {isPositive ? (
                        <Trophy size={32} className="text-emerald-400" />
                    ) : (
                        <Target size={32} className="text-red-400" />
                    )}
                </div>
                <h1 className="text-xl font-bold text-foreground mb-1">Simülasyon Tamamlandı</h1>
                <p className="text-sm text-muted-foreground">
                    {new Date(config.startDate).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}{' '}
                    →{' '}
                    {new Date(config.endDate).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </p>
            </div>

            {/* ═══ Main KPI ═══ */}
            <div
                className={cn(
                    'rounded-2xl border p-6 text-center',
                    isPositive
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                )}
            >
                <p className="text-xs text-muted-foreground mb-1">Son Portföy Değeri</p>
                <p
                    className={cn(
                        'text-4xl font-bold tracking-tight',
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                    )}
                >
                    ₺{formatCurrency(portfolioValue)}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                    {isPositive ? (
                        <TrendingUp size={16} className="text-emerald-400" />
                    ) : (
                        <TrendingDown size={16} className="text-red-400" />
                    )}
                    <span
                        className={cn(
                            'text-lg font-semibold',
                            isPositive ? 'text-emerald-400' : 'text-red-400'
                        )}
                    >
                        {isPositive ? '+' : ''}₺{formatCurrency(totalPnL)} (
                        {isPositive ? '+' : ''}
                        {totalPnLPct.toFixed(2)}%)
                    </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                    Başlangıç: ₺{formatCurrency(config.initialBalance)} → Bitiş: ₺
                    {formatCurrency(portfolioValue)}
                </p>
            </div>

            {/* ═══ Stats Grid ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    icon={Clock}
                    label="Süre"
                    value={`${stats.totalDays} gün`}
                    color="text-cyan-400"
                />
                <StatCard
                    icon={BarChart3}
                    label="Toplam İşlem"
                    value={String(stats.totalTrades)}
                    sub={`${stats.buyCount} alım, ${stats.sellCount} satım`}
                    color="text-blue-400"
                />
                <StatCard
                    icon={Wallet}
                    label="Hisse Çeşidi"
                    value={String(stats.uniqueTickers)}
                    color="text-violet-400"
                />
                <StatCard
                    icon={TrendingDown}
                    label="Maks Drawdown"
                    value={`${stats.maxDrawdown.toFixed(2)}%`}
                    color="text-orange-400"
                />
            </div>

            {/* ═══ Best / Worst ═══ */}
            {stats.bestTicker && stats.worstTicker && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                            <Sparkles size={10} className="text-emerald-400" />
                            En İyi Hisse
                        </p>
                        <p className="text-sm font-bold text-foreground">{stats.bestTicker[0]}</p>
                        <p className="text-xs text-emerald-400 font-semibold">
                            ₺{formatCurrency(stats.bestTicker[1])}
                        </p>
                    </div>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                            <TrendingDown size={10} className="text-red-400" />
                            En Kötü Hisse
                        </p>
                        <p className="text-sm font-bold text-foreground">{stats.worstTicker[0]}</p>
                        <p className="text-xs text-red-400 font-semibold">
                            ₺{formatCurrency(stats.worstTicker[1])}
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ Portfolio Value Chart ═══ */}
            {chartData.length > 1 && (
                <div className="rounded-xl border border-border bg-card/60 p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3">
                        Portföy Değeri Zaman Serisi
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                            >
                                <defs>
                                    <linearGradient
                                        id="resultGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor={isPositive ? '#10b981' : '#ef4444'}
                                            stopOpacity={0.25}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={isPositive ? '#10b981' : '#ef4444'}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.04)"
                                />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: '#666' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#666' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) =>
                                        `₺${(v / 1000).toFixed(0)}K`
                                    }
                                    domain={['auto', 'auto']}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(12,12,16,0.95)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        padding: '8px 12px',
                                    }}
                                    formatter={(value) => [
                                        `₺${formatCurrency(Number(value ?? 0))}`,
                                        'Portföy',
                                    ]}
                                />
                                <ReferenceLine
                                    y={config.initialBalance}
                                    stroke="#666"
                                    strokeDasharray="4 4"
                                    strokeWidth={1}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={isPositive ? '#10b981' : '#ef4444'}
                                    strokeWidth={2}
                                    fill="url(#resultGradient)"
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
                        Kesikli çizgi = Başlangıç bakiyesi (₺{formatCurrency(config.initialBalance)})
                    </p>
                </div>
            )}

            {/* ═══ Trade History ═══ */}
            {tradeHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-card/60 p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                        <DollarSign size={14} className="text-cyan-400" />
                        İşlem Geçmişi
                    </h3>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {tradeHistory.map((trade) => (
                            <div
                                key={trade.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                            trade.side === 'buy'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/20 text-red-400'
                                        )}
                                    >
                                        {trade.side === 'buy' ? 'AL' : 'SAT'}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                        {trade.ticker}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {trade.shares} adet
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-foreground font-medium">
                                        ₺{formatCurrency(trade.total)}
                                    </span>
                                    <span className="text-muted-foreground ml-2">
                                        {new Date(trade.date).toLocaleDateString('tr-TR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Actions ═══ */}
            <div className="flex gap-3">
                <button
                    onClick={onPlayAgain}
                    className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <RotateCcw size={16} />
                    Yeniden Oyna
                </button>
            </div>
        </div>
    )
}

// ─── Stat Card ───
function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
}: {
    icon: typeof Clock
    label: string
    value: string
    sub?: string
    color: string
}) {
    return (
        <div className="rounded-xl border border-border bg-card/60 p-3">
            <div className={cn('flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1')}>
                <Icon size={12} className={color} />
                {label}
            </div>
            <p className="text-sm font-bold text-foreground">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    )
}
