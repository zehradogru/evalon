'use client'

import { useState } from 'react'
import { useSimulatorStore } from '@/store/use-simulator-store'
import type { SimPosition } from '@/types/simulator'
import { cn } from '@/lib/utils'
import { ShoppingCart, DollarSign, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react'

interface SimulatorOrderPanelProps {
    ticker: string | null
    tickerName: string
    currentPrice: number
    balance: number
    position: SimPosition | null
    onSelectTicker: () => void
}

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SimulatorOrderPanel({
    ticker,
    tickerName,
    currentPrice,
    balance,
    position,
    onSelectTicker,
}: SimulatorOrderPanelProps) {
    const { buyStock, sellStock, currentTime } = useSimulatorStore()

    const [side, setSide] = useState<'buy' | 'sell'>('buy')
    const [sharesInput, setSharesInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const shares = parseInt(sharesInput) || 0
    const total = shares * currentPrice
    const maxBuyShares = currentPrice > 0 ? Math.floor(balance / currentPrice) : 0
    const maxSellShares = position?.shares || 0

    const canSubmit =
        Boolean(ticker) &&
        currentPrice > 0 &&
        shares > 0 &&
        (side === 'buy' ? total <= balance : shares <= maxSellShares)

    const handleSubmit = () => {
        if (!ticker || !canSubmit) return
        setError(null)

        if (side === 'buy') {
            if (total > balance) {
                setError('Yetersiz bakiye')
                return
            }
            buyStock(ticker, tickerName, shares, currentPrice)
            setSuccess(`${shares} adet ${ticker} alindi`)
        } else {
            if (shares > maxSellShares) {
                setError('Yeterli hisse yok')
                return
            }
            sellStock(ticker, shares, currentPrice)
            setSuccess(`${shares} adet ${ticker} satildi`)
        }

        setSharesInput('')
        setTimeout(() => setSuccess(null), 3000)
    }

    const handleQuickFill = (pct: number) => {
        if (side === 'buy') {
            setSharesInput(String(Math.floor(maxBuyShares * pct)))
        } else {
            setSharesInput(String(Math.floor(maxSellShares * pct)))
        }
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 space-y-4 lg:sticky lg:top-4">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart size={14} className="text-cyan-400" />
                Emir Girisi
            </h3>

            {!ticker && (
                <button
                    onClick={onSelectTicker}
                    className="w-full py-6 rounded-lg border border-dashed border-border hover:border-cyan-500/30 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Search size={20} />
                    <span className="text-xs">Hisse sec</span>
                </button>
            )}

            {ticker && (
                <>
                    <div className="p-3 rounded-lg bg-secondary/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-sm text-foreground">{ticker}</p>
                                <p className="text-[10px] text-muted-foreground">{tickerName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-foreground">
                                    ₺{currentPrice > 0 ? formatCurrency(currentPrice) : '—'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {new Date(currentTime).toLocaleString('tr-TR', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}{' '}
                                    mum kapanisi
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/10 rounded-lg">
                        <button
                            onClick={() => {
                                setSide('buy')
                                setSharesInput('')
                                setError(null)
                            }}
                            className={cn(
                                'py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1',
                                side === 'buy'
                                    ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <ArrowUpRight size={14} />
                            Al
                        </button>
                        <button
                            onClick={() => {
                                setSide('sell')
                                setSharesInput('')
                                setError(null)
                            }}
                            className={cn(
                                'py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1',
                                side === 'sell'
                                    ? 'bg-red-500/20 text-red-400 shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <ArrowDownRight size={14} />
                            Sat
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground font-medium">Adet</label>
                        <input
                            type="number"
                            value={sharesInput}
                            onChange={(e) => {
                                setSharesInput(e.target.value)
                                setError(null)
                            }}
                            min="1"
                            max={side === 'buy' ? maxBuyShares : maxSellShares}
                            placeholder="0"
                            className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <div className="flex gap-1">
                            {[0.25, 0.5, 0.75, 1].map((pct) => (
                                <button
                                    key={pct}
                                    onClick={() => handleQuickFill(pct)}
                                    className="flex-1 py-1 rounded-md bg-secondary/20 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                                >
                                    {pct === 1 ? 'Tumu' : `%${pct * 100}`}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            {side === 'buy'
                                ? `Maks: ${maxBuyShares} adet`
                                : `Portfoyde: ${maxSellShares} adet`}
                        </p>
                    </div>

                    {shares > 0 && currentPrice > 0 && (
                        <div className="rounded-lg bg-secondary/10 p-3 space-y-1.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Fiyat</span>
                                <span>₺{formatCurrency(currentPrice)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Adet</span>
                                <span>{shares}</span>
                            </div>
                            <div className="border-t border-border pt-1.5 flex justify-between text-xs font-semibold text-foreground">
                                <span className="flex items-center gap-1">
                                    <DollarSign size={12} />
                                    Toplam
                                </span>
                                <span>₺{formatCurrency(total)}</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                            {success}
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={cn(
                            'w-full py-3 rounded-xl font-bold text-sm transition-all',
                            side === 'buy'
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20',
                            'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
                        )}
                    >
                        {side === 'buy' ? `${ticker} Al` : `${ticker} Sat`}
                    </button>

                    {position && (
                        <div className="rounded-lg border border-border p-3 space-y-1">
                            <p className="text-[10px] text-muted-foreground font-medium">
                                Mevcut Pozisyon
                            </p>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Adet</span>
                                <span className="text-foreground font-semibold">{position.shares}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Ort. Maliyet</span>
                                <span className="text-foreground">₺{formatCurrency(position.avgCost)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Guncel Fiyat</span>
                                <span className="text-foreground">₺{formatCurrency(position.currentPrice)}</span>
                            </div>
                            {(() => {
                                const pnl =
                                    (position.currentPrice - position.avgCost) * position.shares
                                const pnlPct =
                                    position.avgCost > 0
                                        ? ((position.currentPrice - position.avgCost) / position.avgCost) * 100
                                        : 0
                                return (
                                    <div className="flex justify-between text-xs pt-1 border-t border-border">
                                        <span className="text-muted-foreground">K/Z</span>
                                        <span
                                            className={cn(
                                                'font-semibold',
                                                pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                            )}
                                        >
                                            {pnl >= 0 ? '+' : ''}₺{formatCurrency(pnl)} ({pnlPct.toFixed(2)}%)
                                        </span>
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
