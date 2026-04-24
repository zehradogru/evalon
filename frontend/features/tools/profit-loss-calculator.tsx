'use client'

import { useState, useMemo } from 'react'
import {
    Calculator,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    ArrowRight,
    Info,
    ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Pure calculation logic ───────────────────────────────────────────────────

interface CalcInput {
    entryPrice: number
    exitPrice: number
    quantity: number
    commissionBps: number   // e.g. 2 = binde 2 = 0.02%
    bsmvBps: number         // e.g. 5 = 5 per mille (BSMV on commission)
    direction: 'long' | 'short'
}

interface CalcResult {
    gross: number
    commissionTotal: number
    bsmv: number
    net: number
    roi: number
    breakEven: number
    totalCost: number
    isProfit: boolean
}

function calculate(input: CalcInput): CalcResult | null {
    const { entryPrice, exitPrice, quantity, commissionBps, bsmvBps, direction } = input
    if (
        entryPrice <= 0 ||
        exitPrice <= 0 ||
        quantity <= 0
    ) return null

    const sign = direction === 'long' ? 1 : -1
    const gross = (exitPrice - entryPrice) * quantity * sign

    // Commission: on total buy + sell volume
    const commissionTotal = (entryPrice + exitPrice) * quantity * (commissionBps / 10000)

    // BSMV: on commission amount
    const bsmv = commissionTotal * (bsmvBps / 1000)

    const net = gross - commissionTotal - bsmv
    const totalCost = entryPrice * quantity
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0

    // Break-even: commission + bsmv added to entry side
    const totalFeeRatio = (commissionBps / 10000) * (1 + bsmvBps / 1000) * 2 // buy + sell
    const breakEven = direction === 'long'
        ? entryPrice * (1 + totalFeeRatio)
        : entryPrice * (1 - totalFeeRatio)

    return {
        gross,
        commissionTotal,
        bsmv,
        net,
        roi,
        breakEven,
        totalCost,
        isProfit: net >= 0,
    }
}

// ─── Number Input ─────────────────────────────────────────────────────────────

function NumInput({
    label,
    value,
    onChange,
    prefix,
    suffix,
    placeholder,
    hint,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    prefix?: string
    suffix?: string
    placeholder?: string
    hint?: string
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <div className="relative flex items-center">
                {prefix && (
                    <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                        {prefix}
                    </span>
                )}
                <input
                    type="number"
                    value={value}
                    min={0}
                    step="any"
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50",
                        "focus:outline-none focus:ring-1 focus:ring-primary/60 transition-shadow",
                        "py-2.5",
                        prefix ? "pl-7" : "pl-3",
                        suffix ? "pr-12" : "pr-3"
                    )}
                />
                {suffix && (
                    <span className="absolute right-3 text-xs text-muted-foreground select-none pointer-events-none">
                        {suffix}
                    </span>
                )}
            </div>
            {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
        </div>
    )
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
    label,
    value,
    sub,
    highlight,
    positive,
    icon: Icon,
}: {
    label: string
    value: string
    sub?: string
    highlight?: boolean
    positive?: boolean | null
    icon?: React.ComponentType<{ className?: string }>
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-4 flex flex-col gap-1.5 transition-colors",
                highlight
                    ? positive
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    : "border-border bg-card"
            )}
        >
            <div className="flex items-center gap-1.5">
                {Icon && (
                    <Icon
                        className={cn(
                            "h-3.5 w-3.5",
                            positive === true && "text-emerald-400",
                            positive === false && "text-red-400",
                            positive === null || positive === undefined ? "text-muted-foreground" : ""
                        )}
                    />
                )}
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <span
                className={cn(
                    "font-bold",
                    highlight ? "text-2xl" : "text-lg",
                    positive === true && "text-emerald-400",
                    positive === false && "text-red-400",
                    positive === null || positive === undefined ? "text-foreground" : ""
                )}
            >
                {value}
            </span>
            {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfitLossCalculator() {
    const [direction, setDirection] = useState<'long' | 'short'>('long')
    const [entryPrice, setEntryPrice] = useState('')
    const [exitPrice, setExitPrice] = useState('')
    const [quantity, setQuantity] = useState('')
    const [commissionBps, setCommissionBps] = useState('2')
    const [bsmvBps, setBsmvBps] = useState('5')
    const [showAdvanced, setShowAdvanced] = useState(false)

    const result = useMemo<CalcResult | null>(() => {
        const e = parseFloat(entryPrice)
        const x = parseFloat(exitPrice)
        const q = parseFloat(quantity)
        const c = parseFloat(commissionBps)
        const b = parseFloat(bsmvBps)
        if (isNaN(e) || isNaN(x) || isNaN(q) || isNaN(c) || isNaN(b)) return null
        return calculate({ entryPrice: e, exitPrice: x, quantity: q, commissionBps: c, bsmvBps: b, direction })
    }, [entryPrice, exitPrice, quantity, commissionBps, bsmvBps, direction])

    const fmt = (n: number, decimals = 2) =>
        n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Profit / Loss Calculator</h1>
                    <p className="text-sm text-muted-foreground">
                        Calculate your net profit and break-even price including commissions
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* ─── Input Panel ─── */}
                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-5">
                    {/* Direction Toggle */}
                    <div>
                        <span className="text-xs font-medium text-muted-foreground mb-2 block">Trade Direction</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setDirection('long')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold border transition-all",
                                    direction === 'long'
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                                )}
                            >
                                <TrendingUp className="h-4 w-4" />
                                Long (Buy)
                            </button>
                            <button
                                onClick={() => setDirection('short')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold border transition-all",
                                    direction === 'short'
                                        ? "border-red-500/50 bg-red-500/10 text-red-400"
                                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                                )}
                            >
                                <TrendingDown className="h-4 w-4" />
                                Short (Sell)
                            </button>
                        </div>
                    </div>

                    {/* Core inputs */}
                    <NumInput
                        label="Buy Price"
                        value={entryPrice}
                        onChange={setEntryPrice}
                        prefix="₺"
                        placeholder="0.00"
                    />
                    <NumInput
                        label="Sell / Target Price"
                        value={exitPrice}
                        onChange={setExitPrice}
                        prefix="₺"
                        placeholder="0.00"
                    />
                    <NumInput
                        label="Lot Size"
                        value={quantity}
                        onChange={setQuantity}
                        placeholder="100"
                        hint="1 lot = 1 share"
                    />

                    {/* Advanced toggle */}
                    <button
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDown
                            className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")}
                        />
                        Commission Details
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted ml-1">
                            {commissionBps}‰ komisyon · {bsmvBps}‰ BSMV
                        </span>
                    </button>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/50">
                            <NumInput
                                label="Commission (per mille)"
                                value={commissionBps}
                                onChange={setCommissionBps}
                                suffix="‰"
                                placeholder="2"
                                hint="Broker rate"
                            />
                            <NumInput
                                label="BSMV (on commission)"
                                value={bsmvBps}
                                onChange={setBsmvBps}
                                suffix="‰"
                                placeholder="5"
                                hint="Banking & insurance transaction tax"
                            />
                        </div>
                    )}
                </div>

                {/* ─── Result Panel ─── */}
                <div className="flex flex-col gap-4">
                    {result ? (
                        <>
                            {/* Net P/L — big card */}
                            <ResultCard
                                label="Net Profit / Loss"
                                value={`${result.net >= 0 ? '+' : ''}₺${fmt(result.net)}`}
                                sub={`Gross: ${result.gross >= 0 ? '+' : ''}₺${fmt(result.gross)}`}
                                highlight
                                positive={result.isProfit}
                                icon={result.isProfit ? TrendingUp : TrendingDown}
                            />

                            {/* 2-col grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <ResultCard
                                    label="Return Rate"
                                    value={`${result.roi >= 0 ? '+' : ''}${fmt(result.roi)}%`}
                                    positive={result.roi >= 0 ? true : false}
                                    icon={Percent}
                                />
                                <ResultCard
                                    label="Break-even Price"
                                    value={`₺${fmt(result.breakEven)}`}
                                    sub="Including commission"
                                    positive={null}
                                    icon={ArrowRight}
                                />
                                <ResultCard
                                    label="Total Commission"
                                    value={`₺${fmt(result.commissionTotal)}`}
                                    sub={`BSMV: ₺${fmt(result.bsmv)}`}
                                    positive={null}
                                    icon={DollarSign}
                                />
                                <ResultCard
                                    label="Investment Amount"
                                    value={`₺${fmt(result.totalCost)}`}
                                    positive={null}
                                    icon={DollarSign}
                                />
                            </div>

                            {/* Info strip */}
                            <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3 flex items-start gap-2">
                                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Calculation includes <strong className="text-foreground">{commissionBps}‰</strong> broker commission and{' '}
                                    <strong className="text-foreground">{bsmvBps}‰</strong> BSMV on commission.
                                    Withholding tax and other tax obligations are not included.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 px-8 py-16 text-center">
                            <Calculator className="h-10 w-10 text-muted-foreground/30 mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Enter buy price, sell price and lot size
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Results are calculated instantly
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
