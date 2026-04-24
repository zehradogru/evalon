'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, ChevronDown, Minus, Plus, ArrowUpDown, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import type { CreateOrderRequest, OrderSide, OrderType, PaperPortfolio } from '@/types/paper-trade'
import { PAPER_TRADE_COMMISSION_RATE } from '@/types/paper-trade'

interface OrderEntryPanelProps {
    portfolio: PaperPortfolio
    selectedTicker?: string | null
    selectedTickerName?: string
    currentPrice?: number
    onSubmitOrder: (req: CreateOrderRequest, currentPrice: number) => void
    onTickerChange?: (ticker: string, name: string) => void
    className?: string
    compact?: boolean
}

// Search index
const SEARCH_INDEX = BIST_AVAILABLE.map((t) => ({
    ticker: t,
    name: TICKER_NAMES[t] || t,
    search: `${t.toLowerCase()} ${(TICKER_NAMES[t] || '').toLowerCase()}`,
}))

export function OrderEntryPanel({
    portfolio,
    selectedTicker,
    selectedTickerName,
    currentPrice: externalPrice,
    onSubmitOrder,
    onTickerChange,
    className,
    compact = false,
}: OrderEntryPanelProps) {
    // ─── State ───
    const [side, setSide] = useState<OrderSide>('buy')
    const [orderType, setOrderType] = useState<OrderType>('market')
    const [quantity, setQuantity] = useState<string>('1')
    const [limitPrice, setLimitPrice] = useState<string>('')
    const [stopPrice, setStopPrice] = useState<string>('')
    const [stopLoss, setStopLoss] = useState<string>('')
    const [takeProfit, setTakeProfit] = useState<string>('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Ticker search
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

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Use provided price or 0
    const currentPrice = externalPrice || 0

    // ─── Computed Values ───
    const qty = parseInt(quantity) || 0
    const effectivePrice = orderType === 'market' ? currentPrice : parseFloat(limitPrice) || currentPrice
    const subtotal = qty * effectivePrice
    const commission = Math.round(subtotal * PAPER_TRADE_COMMISSION_RATE * 100) / 100
    const total = subtotal + commission

    const insufficientBalance = side === 'buy' && total > portfolio.cashBalance
    const existingPosition = selectedTicker ? portfolio.positions[selectedTicker] : null
    const insufficientShares = side === 'sell' && existingPosition && qty > existingPosition.quantity
    const isValid = selectedTicker && qty > 0 && currentPrice > 0 && !insufficientBalance && !insufficientShares

    // Quick allocation buttons
    const handleAllocation = useCallback(
        (pct: number) => {
            if (side === 'buy' && currentPrice > 0) {
                const maxQty = Math.floor((portfolio.cashBalance * pct) / (currentPrice * (1 + PAPER_TRADE_COMMISSION_RATE)))
                setQuantity(String(Math.max(1, maxQty)))
            } else if (side === 'sell' && existingPosition) {
                setQuantity(String(Math.max(1, Math.floor(existingPosition.quantity * pct))))
            }
        },
        [side, currentPrice, portfolio.cashBalance, existingPosition]
    )

    const handleSelectTicker = (ticker: string, name: string) => {
        onTickerChange?.(ticker, name)
        setSearchQuery('')
        setSearchOpen(false)
    }

    const handleSubmit = () => {
        if (!isValid || !selectedTicker || submitting) return

        setSubmitting(true)
        setErrorMsg(null)
        setSuccessMsg(null)

        try {
            const req: CreateOrderRequest = {
                ticker: selectedTicker,
                tickerName: selectedTickerName || selectedTicker,
                side,
                type: orderType,
                quantity: qty,
                limitPrice: orderType !== 'market' ? parseFloat(limitPrice) || null : null,
                stopPrice: (orderType === 'stop' || orderType === 'stop_limit') ? parseFloat(stopPrice) || null : null,
                stopLoss: stopLoss ? parseFloat(stopLoss) : null,
                takeProfit: takeProfit ? parseFloat(takeProfit) : null,
            }

            onSubmitOrder(req, currentPrice)
            setSuccessMsg(side === 'buy' ? 'Buy order successful!' : 'Sell order successful!')
            setQuantity('1')
            setStopLoss('')
            setTakeProfit('')

            setTimeout(() => setSuccessMsg(null), 3000)
        } catch (err) {
            setErrorMsg((err as Error).message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={cn('rounded-xl border border-border bg-card flex flex-col', className)}>
            {/* ─── Ticker Selector ─── */}
            <div className="p-4 border-b border-border">
                <div ref={searchRef} className="relative">
                    <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => inputRef.current?.focus(), 50) }}
                    >
                        <Search size={14} className="text-muted-foreground" />
                        {selectedTicker ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-bold text-sm text-foreground">{selectedTicker}</span>
                                <span className="text-xs text-muted-foreground truncate">{selectedTickerName}</span>
                            </div>
                        ) : (
                            <span className="text-sm text-muted-foreground">Select Stock...</span>
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
                                    placeholder="Hisse ara..."
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
                                        <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">BIST</span>
                                    </button>
                                ))}
                                {searchQuery && searchResults.length === 0 && (
                                    <p className="px-3 py-3 text-xs text-muted-foreground text-center">No results found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Price Display */}
                {selectedTicker && currentPrice > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">
                            ₺{currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                )}
            </div>

            {/* ─── Buy / Sell Toggle ─── */}
            <div className="p-4 border-b border-border">
                <div className="grid grid-cols-2 gap-1 bg-secondary/20 p-1 rounded-lg">
                    <button
                        onClick={() => setSide('buy')}
                        className={cn(
                            'py-2 rounded-md text-sm font-semibold transition-all',
                            side === 'buy'
                                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        BUY
                    </button>
                    <button
                        onClick={() => setSide('sell')}
                        className={cn(
                            'py-2 rounded-md text-sm font-semibold transition-all',
                            side === 'sell'
                                ? 'bg-red-500/20 text-red-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        SELL
                    </button>
                </div>
            </div>

            {/* ─── Order Type ─── */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Order Type Select */}
                <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Emir Tipi</label>
                    <div className="grid grid-cols-2 gap-1 bg-secondary/20 p-1 rounded-lg">
                        {(['market', 'limit'] as OrderType[]).map((t) => (
                            <button
                                key={t}
                                onClick={() => setOrderType(t)}
                                className={cn(
                                    'py-1.5 rounded-md text-xs font-medium transition-all',
                                    orderType === t
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {t === 'market' ? 'Piyasa' : 'Limit'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Limit Price */}
                {orderType !== 'market' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs text-muted-foreground font-medium">
                            Limit Fiyat
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                            <input
                                type="number"
                                value={limitPrice}
                                onChange={(e) => setLimitPrice(e.target.value)}
                                step="0.01"
                                min="0.01"
                                placeholder={currentPrice ? currentPrice.toFixed(2) : '0.00'}
                                className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                )}

                {/* Quantity */}
                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <label className="text-xs text-muted-foreground font-medium">Adet</label>
                        {side === 'sell' && existingPosition && (
                            <span className="text-[10px] text-muted-foreground">
                                Mevcut: {existingPosition.quantity}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setQuantity(String(Math.max(1, qty - 1)))}
                            className="h-10 w-10 flex items-center justify-center rounded-lg bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex-shrink-0"
                        >
                            <Minus size={14} />
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => {
                                // Allow integers only
                                const val = e.target.value.replace(/[^0-9]/g, '')
                                setQuantity(val)
                            }}
                            onKeyDown={(e) => {
                                // Prevent dot and comma input
                                if (e.key === '.' || e.key === ',') {
                                    e.preventDefault()
                                }
                            }}
                            min="1"
                            max="10000"
                            step="1"
                            className="flex-1 bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-center text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <button
                            onClick={() => setQuantity(String(qty + 1))}
                            className="h-10 w-10 flex items-center justify-center rounded-lg bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex-shrink-0"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    {/* Quick allocation */}
                    <div className="grid grid-cols-4 gap-1">
                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                            <button
                                key={pct}
                                onClick={() => handleAllocation(pct)}
                                className="py-1 rounded-md bg-secondary/20 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                            >
                                {pct * 100}%
                            </button>
                        ))}
                    </div>
                    {qty > 0 && effectivePrice > 0 && (
                        <p className="text-[11px] text-muted-foreground text-right">
                            ≈ ₺{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}
                </div>

                {/* Advanced Options */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                    <ArrowUpDown size={12} />
                    Advanced Options
                    <ChevronDown size={12} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
                </button>

                {showAdvanced && (
                    <div className="space-y-3 p-3 bg-secondary/10 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground font-medium">Stop Loss</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                                <input
                                    type="number"
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(e.target.value)}
                                    step="0.01"
                                    placeholder="Opsiyonel"
                                    className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground font-medium">Take Profit</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                                <input
                                    type="number"
                                    value={takeProfit}
                                    onChange={(e) => setTakeProfit(e.target.value)}
                                    step="0.01"
                                    placeholder="Opsiyonel"
                                    className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Summary */}
                {qty > 0 && effectivePrice > 0 && (
                    <div className="space-y-2 p-3 bg-secondary/10 rounded-lg border border-border/50">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Tutar</span>
                            <span className="text-foreground font-medium">
                                ₺{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Komisyon (‰1)</span>
                            <span className="text-foreground">
                                ₺{commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="h-px bg-border/50" />
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground font-medium">Toplam</span>
                            <span className="text-foreground font-bold">
                                ₺{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        {side === 'buy' && (
                            <div className="flex justify-between text-[11px]">
                                <span className="text-muted-foreground">Post-Trade Balance</span>
                                <span className={cn(
                                    'font-medium',
                                    insufficientBalance ? 'text-red-400' : 'text-muted-foreground'
                                )}>
                                    ₺{(portfolio.cashBalance - total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Error / Warning Messages */}
                {insufficientBalance && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5">
                        <AlertTriangle size={14} />
                        <span>Yetersiz bakiye</span>
                    </div>
                )}
                {insufficientShares && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5">
                        <AlertTriangle size={14} />
                        <span>Yeterli hisse yok (Mevcut: {existingPosition?.quantity})</span>
                    </div>
                )}

                {/* Success Message */}
                {successMsg && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2.5 animate-in fade-in">
                        <Check size={14} />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* Error Message */}
                {errorMsg && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5 animate-in fade-in">
                        <AlertTriangle size={14} />
                        <span>{errorMsg}</span>
                    </div>
                )}
            </div>

            {/* ─── Submit Button ─── */}
            <div className="p-4 border-t border-border">
                <button
                    onClick={handleSubmit}
                    disabled={!isValid || submitting}
                    className={cn(
                        'w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                        side === 'buy'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 disabled:bg-emerald-500/30 disabled:shadow-none'
                            : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 disabled:bg-red-500/30 disabled:shadow-none',
                        (!isValid || submitting) && 'cursor-not-allowed opacity-60'
                    )}
                >
                    {submitting ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : side === 'buy' ? (
                        <>PLACE BUY ORDER</>
                    ) : (
                        <>PLACE SELL ORDER</>
                    )}
                </button>
            </div>
        </div>
    )
}
