'use client'

import { useState } from 'react'
import { useSimulatorStore } from '@/store/use-simulator-store'
import { Gamepad2, CalendarDays, Wallet, Rocket, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const BALANCE_PRESETS = [50_000, 100_000, 250_000, 500_000]

const DATE_PRESETS = [
    { label: 'Son 3 Ay', getRange: () => rangeDaysAgo(90) },
    { label: 'Son 6 Ay', getRange: () => rangeDaysAgo(180) },
    { label: '2024 Yazı', getRange: () => ({ start: '2024-06-01', end: '2024-09-30' }) },
    { label: '2024 Sonbahar', getRange: () => ({ start: '2024-10-01', end: '2024-12-31' }) },
    { label: '2025 Q1', getRange: () => ({ start: '2025-01-01', end: '2025-03-31' }) },
    { label: 'Tam Geçmiş', getRange: () => ({ start: '2024-04-01', end: todayStr() }) },
]

function todayStr() {
    return new Date().toISOString().slice(0, 10)
}

function rangeDaysAgo(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR')
}

export function SimulatorSetupPanel() {
    const startSimulation = useSimulatorStore((s) => s.startSimulation)

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState(todayStr())
    const [balance, setBalance] = useState(100_000)
    const [customBalance, setCustomBalance] = useState('')

    const effectiveBalance = customBalance ? Number(customBalance) : balance
    const isReady = startDate && endDate && effectiveBalance > 0 && startDate < endDate

    const handlePreset = (preset: typeof DATE_PRESETS[number]) => {
        const range = preset.getRange()
        setStartDate(range.start)
        setEndDate(range.end)
    }

    const handleStart = () => {
        if (!isReady) return
        startSimulation({
            startDate,
            endDate,
            initialBalance: effectiveBalance,
        })
    }

    return (
        <div className="max-w-lg mx-auto px-4 py-8 lg:py-16">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-xl font-bold text-foreground mb-1">Trading Simulator</h1>
                <p className="text-sm text-muted-foreground">
                    Zamanda geriye git, gerçek verilerle al-sat yap.
                    <br />
                    <span className="text-xs text-muted-foreground/60">
                        Geleceği görmeden karar ver — sonucu ileri sararak gör.
                    </span>
                </p>
            </div>

            {/* Card */}
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-6">
                {/* Date Range */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <CalendarDays size={14} className="text-cyan-400" />
                        Simülasyon Dönemi
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Başlangıç</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min="2024-04-01"
                                max={endDate}
                                className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Bitiş</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate || '2024-04-01'}
                                max={todayStr()}
                                className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {DATE_PRESETS.map((p) => (
                            <button
                                key={p.label}
                                onClick={() => handlePreset(p)}
                                className="px-2.5 py-1 rounded-md bg-secondary/20 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Balance */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Wallet size={14} className="text-emerald-400" />
                        Başlangıç Bakiyesi
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                        {BALANCE_PRESETS.map((amount) => (
                            <button
                                key={amount}
                                onClick={() => {
                                    setBalance(amount)
                                    setCustomBalance('')
                                }}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                    !customBalance && balance === amount
                                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                                        : 'bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                )}
                            >
                                ₺{formatCurrency(amount)}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            ₺
                        </span>
                        <input
                            type="number"
                            value={customBalance}
                            onChange={(e) => setCustomBalance(e.target.value)}
                            min="1000"
                            step="10000"
                            placeholder="Veya özel tutar girin..."
                            className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                    </div>
                </div>

                {/* Summary Preview */}
                {isReady && (
                    <div className="rounded-xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/10 p-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={12} className="text-cyan-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Simülasyon Özeti
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-muted-foreground">Dönem</p>
                                <p className="text-xs font-bold text-foreground">
                                    {Math.round(
                                        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                                            (1000 * 60 * 60 * 24)
                                    )}{' '}
                                    gün
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Bakiye</p>
                                <p className="text-xs font-bold text-emerald-400">
                                    ₺{formatCurrency(effectiveBalance)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Başlangıç</p>
                                <p className="text-xs font-bold text-foreground">
                                    {new Date(startDate).toLocaleDateString('tr-TR', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Start Button */}
                <button
                    onClick={handleStart}
                    disabled={!isReady}
                    className={cn(
                        'w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                        'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700',
                        'text-white shadow-lg shadow-cyan-500/20',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
                    )}
                >
                    <Rocket size={16} />
                    Simülasyonu Başlat
                </button>
            </div>

            {/* Footer note */}
            <p className="text-center text-[10px] text-muted-foreground/50 mt-4">
                Veriler Mart 2024'ten itibaren mevcuttur. İşlemler o günün kapanış fiyatından gerçekleşir.
            </p>
        </div>
    )
}
