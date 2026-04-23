'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
    Search,
    ChevronDown,
    CalendarDays,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    Loader2,
    Sparkles,
    ArrowRight,
    BarChart3,
    Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { fetchPrices, getLatestPrice } from '@/services/price.service'
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

// ─── Types ───
interface TimeMachineResult {
    ticker: string
    tickerName: string
    buyDate: string
    buyPrice: number
    currentPrice: number
    investmentAmount: number
    sharesBought: number
    currentValue: number
    pnl: number
    pnlPercent: number
    holdingDays: number
    chartData: { date: string; value: number }[]
}

// ─── Search Index ───
const SEARCH_INDEX = BIST_AVAILABLE.map((t) => ({
    ticker: t,
    name: TICKER_NAMES[t] || t,
    search: `${t.toLowerCase()} ${(TICKER_NAMES[t] || '').toLowerCase()}`,
}))

// ─── Quick Presets ───
const DATE_PRESETS = [
    { label: '1 Ay Önce', days: 30 },
    { label: '3 Ay Önce', days: 90 },
    { label: '6 Ay Önce', days: 180 },
    { label: '1 Yıl Önce', days: 365 },
]

const AMOUNT_PRESETS = [5000, 10000, 25000, 50000, 100000]

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

function getDaysAgoDate(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
}

export function TimeMachinePanel() {
    // ─── State ───
    const [ticker, setTicker] = useState<string | null>(null)
    const [tickerName, setTickerName] = useState('')
    const [investmentAmount, setInvestmentAmount] = useState<string>('10000')
    const [buyDate, setBuyDate] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<TimeMachineResult | null>(null)
    
    // ─── Preview State ───
    const [previewPrice, setPreviewPrice] = useState<number | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    // Auto-fetch price preview when ticker and date changes
    useEffect(() => {
        if (!ticker || !buyDate) {
            setPreviewPrice(null)
            return
        }

        let active = true
        setPreviewLoading(true)

        fetchPrices({
            ticker,
            timeframe: '1d',
            limit: 10, // In case first day doesn't match exactly due to weekends, get a small window
            start: buyDate,
        })
            .then((data) => {
                if (active && data.data && data.data.length > 0) {
                    // Try to find the exact date match, otherwise use the closest future date available from the fetch results
                    const targetTimestamp = new Date(buyDate).getTime();
                    const closestBar = data.data.find(b => new Date(b.t).getTime() >= targetTimestamp) || data.data[0];
                    setPreviewPrice(closestBar.c)
                } else if (active) {
                    setPreviewPrice(null)
                }
            })
            .catch(() => {
                if (active) setPreviewPrice(null)
            })
            .finally(() => {
                if (active) setPreviewLoading(false)
            })

        return () => { active = false }
    }, [ticker, buyDate])

    // ─── Search State ───
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchIdx, setSearchIdx] = useState(0)
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return []
        const q = searchQuery.toLowerCase()
        return SEARCH_INDEX.filter((i) => i.search.includes(q)).slice(0, 6)
    }, [searchQuery])

    // Close search on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleSelectTicker = (t: string, name: string) => {
        setTicker(t)
        setTickerName(name)
        setSearchQuery('')
        setSearchOpen(false)
        setResult(null)
    }

    // ─── Simulate ───
    const handleSimulate = useCallback(async () => {
        if (!ticker || !buyDate || !investmentAmount) return

        const amount = parseFloat(investmentAmount)
        if (!amount || amount <= 0) {
            setError('Geçerli bir yatırım tutarı girin.')
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            // Fetch historical data from buy date to now
            const data = await fetchPrices({
                ticker,
                timeframe: '1d',
                limit: 500,
                start: buyDate,
            })

            if (!data.data || data.data.length === 0) {
                setError('Bu tarih için fiyat verisi bulunamadı. Farklı bir tarih deneyin.')
                return
            }

            const buyBar = data.data[0]
            const buyPrice = buyBar.c
            const currentBar = data.data[data.data.length - 1]
            const currentPrice = currentBar.c

            const sharesBought = Math.floor(amount / buyPrice)
            if (sharesBought <= 0) {
                setError(`₺${formatCurrency(amount)} ile ${ticker} alınamaz. Fiyat: ₺${formatCurrency(buyPrice)}`)
                return
            }

            const actualInvestment = sharesBought * buyPrice
            const currentValue = sharesBought * currentPrice
            const pnl = currentValue - actualInvestment
            const pnlPercent = (pnl / actualInvestment) * 100

            const buyDateObj = new Date(buyBar.t)
            const nowDate = new Date(currentBar.t)
            const holdingDays = Math.round((nowDate.getTime() - buyDateObj.getTime()) / (1000 * 60 * 60 * 24))

            // Build chart data
            const chartData = data.data.map((bar) => ({
                date: new Date(bar.t).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
                value: Math.round(sharesBought * bar.c * 100) / 100,
            }))

            setResult({
                ticker,
                tickerName: tickerName || ticker,
                buyDate: buyBar.t,
                buyPrice,
                currentPrice,
                investmentAmount: actualInvestment,
                sharesBought,
                currentValue,
                pnl,
                pnlPercent,
                holdingDays,
                chartData,
            })
        } catch (err) {
            setError((err as Error).message || 'Fiyat verisi alınamadı.')
        } finally {
            setLoading(false)
        }
    }, [ticker, buyDate, investmentAmount, tickerName])

    const maxDate = new Date().toISOString().slice(0, 10)
    const minDate = '2020-01-01'
    const isReadyToSimulate = ticker && buyDate && parseFloat(investmentAmount) > 0

    return (
        <div className="space-y-5">
            {/* ─── Header ─── */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                    <Sparkles size={20} className="text-violet-400" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-foreground">Tarihsel Simülasyon</h2>
                    <p className="text-xs text-muted-foreground">Geçmişte alsaydınız ne olurdu?</p>
                </div>
            </div>

            {/* ─── Input Card ─── */}
            <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
                {/* Ticker Search */}
                <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Hisse Seç</label>
                    <div ref={searchRef} className="relative">
                        <div
                            className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                            onClick={() => {
                                setSearchOpen(!searchOpen)
                                setTimeout(() => inputRef.current?.focus(), 50)
                            }}
                        >
                            <Search size={14} className="text-muted-foreground" />
                            {ticker ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="font-bold text-sm text-foreground">{ticker}</span>
                                    <span className="text-xs text-muted-foreground truncate">{tickerName}</span>
                                </div>
                            ) : (
                                <span className="text-sm text-muted-foreground">Hisse ara...</span>
                            )}
                            <ChevronDown size={14} className="text-muted-foreground" />
                        </div>

                        {searchOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-2 border-b border-border">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0) }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx((i) => Math.min(i + 1, searchResults.length - 1)) }
                                            else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx((i) => Math.max(i - 1, 0)) }
                                            else if (e.key === 'Enter' && searchResults[searchIdx]) {
                                                e.preventDefault()
                                                handleSelectTicker(searchResults[searchIdx].ticker, searchResults[searchIdx].name)
                                            }
                                            else if (e.key === 'Escape') setSearchOpen(false)
                                        }}
                                        placeholder="Hisse kodu veya adı..."
                                        className="w-full bg-secondary/20 rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {searchResults.map((item, i) => (
                                        <button
                                            key={item.ticker}
                                            onClick={() => handleSelectTicker(item.ticker, item.name)}
                                            onMouseEnter={() => setSearchIdx(i)}
                                            className={cn(
                                                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                                                i === searchIdx ? 'bg-muted/50' : 'hover:bg-muted/30'
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-bold text-foreground w-14 flex-shrink-0">{item.ticker}</span>
                                                <span className="text-muted-foreground truncate text-xs">{item.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {searchQuery && searchResults.length === 0 && (
                                        <p className="px-3 py-3 text-xs text-muted-foreground text-center">Sonuç bulunamadı</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Date Picker */}
                <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Alım Tarihi</label>
                    <div className="relative">
                        <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="date"
                            value={buyDate}
                            onChange={(e) => { setBuyDate(e.target.value); setResult(null) }}
                            min={minDate}
                            max={maxDate}
                            className="w-full bg-secondary/30 rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {DATE_PRESETS.map((p) => (
                            <button
                                key={p.days}
                                onClick={() => { setBuyDate(getDaysAgoDate(p.days)); setResult(null) }}
                                className="px-2.5 py-1 rounded-md bg-secondary/20 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Investment Amount */}
                <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Yatırım Tutarı</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                        <input
                            type="number"
                            value={investmentAmount}
                            onChange={(e) => { setInvestmentAmount(e.target.value); setResult(null) }}
                            min="100"
                            step="1000"
                            placeholder="10000"
                            className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {AMOUNT_PRESETS.map((a) => (
                            <button
                                key={a}
                                onClick={() => { setInvestmentAmount(String(a)); setResult(null) }}
                                className={cn(
                                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                                    investmentAmount === String(a)
                                        ? 'bg-primary/20 text-primary'
                                        : 'bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                )}
                            >
                                ₺{a.toLocaleString('tr-TR')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Simulation Preview */}
                {ticker && buyDate && (
                    <div className="px-3 py-2.5 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock size={14} className="text-violet-400" />
                            <span>
                                {formatDate(buyDate)} fiyati:
                            </span>
                        </div>
                        {previewLoading ? (
                            <Loader2 size={12} className="animate-spin text-muted-foreground" />
                        ) : previewPrice ? (
                            <div className="text-right">
                                <span className="font-bold text-foreground">₺{formatCurrency(previewPrice)}</span>
                                {parseFloat(investmentAmount) > 0 && parseFloat(investmentAmount) >= previewPrice ? (
                                    <div className="text-[10px] text-violet-400 font-medium mt-0.5">
                                        ~{Math.floor(parseFloat(investmentAmount) / previewPrice)} adet alınabilir
                                    </div>
                                ) : parseFloat(investmentAmount) > 0 ? (
                                    <div className="text-[10px] text-red-400 font-medium mt-0.5">
                                        Bakiye yetersiz
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <span className="text-red-400 text-[10px]">Fiyat bulunamadı</span>
                        )}
                    </div>
                )}

                {/* Simulate Button */}
                <button
                    onClick={handleSimulate}
                    disabled={!isReadyToSimulate || loading}
                    className={cn(
                        'w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                        'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600',
                        'text-white shadow-lg shadow-violet-500/20',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
                    )}
                >
                    {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <>
                            <Sparkles size={16} />
                            Simüle Et
                        </>
                    )}
                </button>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5">
                        <Info size={14} />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* ─── Results ─── */}
            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Summary Card */}
                    <div className={cn(
                        'rounded-xl border p-5 space-y-4',
                        result.pnl >= 0
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : 'border-red-500/20 bg-red-500/5'
                    )}>
                        {/* Scenario Header */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Clock size={12} />
                            <span>
                                Simülasyon Analizi: <strong className="text-foreground">{result.ticker}</strong> / {formatDate(result.buyDate)}
                            </span>
                        </div>

                        {/* Main KPI */}
                        <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground mb-1">Portföy Değeriniz</p>
                            <p className={cn(
                                'text-3xl font-bold tracking-tight',
                                result.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                                ₺{formatCurrency(result.currentValue)}
                            </p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                {result.pnl >= 0 ? (
                                    <TrendingUp size={14} className="text-emerald-400" />
                                ) : (
                                    <TrendingDown size={14} className="text-red-400" />
                                )}
                                <span className={cn(
                                    'text-sm font-semibold',
                                    result.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                )}>
                                    {result.pnl >= 0 ? '+' : ''}₺{formatCurrency(result.pnl)} ({result.pnl >= 0 ? '+' : ''}{result.pnlPercent.toFixed(2)}%)
                                </span>
                            </div>
                        </div>

                        {/* Detail Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <DetailItem
                                icon={DollarSign}
                                label="Yatırım"
                                value={`₺${formatCurrency(result.investmentAmount)}`}
                            />
                            <DetailItem
                                icon={BarChart3}
                                label="Alınan Lot"
                                value={`${result.sharesBought} adet`}
                            />
                            <DetailItem
                                icon={ArrowRight}
                                label="Alış Fiyatı"
                                value={`₺${formatCurrency(result.buyPrice)}`}
                            />
                            <DetailItem
                                icon={ArrowRight}
                                label="Güncel Fiyat"
                                value={`₺${formatCurrency(result.currentPrice)}`}
                            />
                            <DetailItem
                                icon={Clock}
                                label="Tutma Süresi"
                                value={`${result.holdingDays} gün`}
                            />
                            <DetailItem
                                icon={TrendingUp}
                                label="Günlük Ort. Getiri"
                                value={`%${(result.pnlPercent / Math.max(1, result.holdingDays)).toFixed(3)}`}
                            />
                        </div>
                    </div>

                    {/* Chart */}
                    {result.chartData.length > 1 && (
                        <div className="rounded-xl border border-border bg-card/50 p-4">
                            <h3 className="text-xs font-semibold text-foreground mb-3">Portföy Değeri Zaman Serisi</h3>
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={result.chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                        <defs>
                                            <linearGradient id="tmGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={result.pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={result.pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10, fill: '#888' }}
                                            tickLine={false}
                                            axisLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: '#888' }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`}
                                            domain={['auto', 'auto']}
                                            width={50}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'rgba(15,15,20,0.95)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px',
                                                fontSize: '12px',
                                                padding: '8px 12px'
                                            }}
                                            formatter={(value: number | undefined) => [`₺${formatCurrency(value ?? 0)}`, 'Portföy Değeri']}
                                            labelFormatter={(label) => `Tarih: ${label}`}
                                        />
                                        <ReferenceLine
                                            y={result.investmentAmount}
                                            stroke="#888"
                                            strokeDasharray="4 4"
                                            strokeWidth={1}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={result.pnl >= 0 ? '#10b981' : '#ef4444'}
                                            strokeWidth={2}
                                            fill="url(#tmGradient)"
                                            dot={false}
                                            activeDot={{ r: 4, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                                Kesikli çizgi = Başlangıç yatırımı (₺{formatCurrency(result.investmentAmount)})
                            </p>
                        </div>
                    )}

                    {/* Insight Card */}
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <div className="flex items-start gap-2">
                            <Sparkles size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                {result.pnl >= 0 ? (
                                    <>
                                        <strong className="text-foreground">Pozitif Getiri Analizi: </strong>
                                        Simüle edilen pozisyon {result.holdingDays} gün boyunca taşınmış olup, dönem sonunda <strong className="text-emerald-400">%{result.pnlPercent.toFixed(1)}</strong> net sermaye büyümesi sağlamıştır.
                                        {result.pnlPercent > 50 && ' Bu performans oranı, ilgili zaman dilimi için piyasa ortalamasının üzerinde değerlendirilebilir.'}
                                        {result.pnlPercent > 100 && ' Başlangıç yatırımı belirtilen periyot içinde net olarak ikiye katlanmıştır.'}
                                    </>
                                ) : (
                                    <>
                                        <strong className="text-foreground">Negatif Getiri Analizi: </strong>
                                        Simüle edilen pozisyon {result.holdingDays} gün boyunca taşınmış olup, dönem sonunda sermayede <strong className="text-red-400">%{Math.abs(result.pnlPercent).toFixed(1)}</strong> oranında küçülme gerçekleşmiştir.
                                        {' Portföy optimizasyonu için zarar kes (stop-loss) ve risk yönetimi stratejileri bu tür senaryolarda kritik öneme sahiptir.'}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Detail Item ───
function DetailItem({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof DollarSign
    label: string
    value: string
}) {
    return (
        <div className="bg-background/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                <Icon size={10} />
                {label}
            </div>
            <p className="text-xs font-semibold text-foreground">{value}</p>
        </div>
    )
}
