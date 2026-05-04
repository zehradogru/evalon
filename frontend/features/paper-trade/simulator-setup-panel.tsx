'use client'

import { useState } from 'react'
import { useSimulatorStore } from '@/store/use-simulator-store'
import { CalendarDays, Wallet, Rocket, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const BALANCE_PRESETS = [50_000, 100_000, 250_000, 500_000]
const MIN_1M_START = '2026-01-21T09:55'

function nowLocalInputValue(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
}

function daysAfter(start: string, days: number): string {
    const date = new Date(start)
    date.setDate(date.getDate() + days)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
}

const DATE_PRESETS = [
    { label: 'Acilis Haftasi', startAt: MIN_1M_START, endAt: daysAfter(MIN_1M_START, 7) },
    { label: '2 Hafta', startAt: MIN_1M_START, endAt: daysAfter(MIN_1M_START, 14) },
    { label: '1 Ay', startAt: MIN_1M_START, endAt: daysAfter(MIN_1M_START, 30) },
]

function formatCurrency(val: number): string {
    return val.toLocaleString('tr-TR')
}

export function SimulatorSetupPanel() {
    const startSimulation = useSimulatorStore((s) => s.startSimulation)

    const [startAt, setStartAt] = useState(MIN_1M_START)
    const [endAt, setEndAt] = useState(daysAfter(MIN_1M_START, 7))
    const [balance, setBalance] = useState(100_000)
    const [customBalance, setCustomBalance] = useState('')

    const effectiveBalance = customBalance ? Number(customBalance) : balance
    const isReady = Boolean(startAt && endAt && effectiveBalance > 0 && startAt < endAt)

    const handleStart = () => {
        if (!isReady) return
        startSimulation({
            startAt,
            endAt,
            initialBalance: effectiveBalance,
        })
    }

    return (
        <div className="max-w-lg mx-auto px-4 py-8 lg:py-16">
            <div className="text-center mb-8">
                <h1 className="text-xl font-bold text-foreground mb-1">Trading Simulator</h1>
                <p className="text-sm text-muted-foreground">
                    1 dakikalik gecmis veride replay yap, zamani istedigin hizda ileri sar.
                </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-6">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <CalendarDays size={14} className="text-cyan-400" />
                        Simulasyon Zamani
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Baslangic</span>
                            <input
                                type="datetime-local"
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                min={MIN_1M_START}
                                max={endAt}
                                className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Bitis</span>
                            <input
                                type="datetime-local"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                min={startAt || MIN_1M_START}
                                max={nowLocalInputValue()}
                                className="w-full bg-secondary/30 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {DATE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => {
                                    setStartAt(preset.startAt)
                                    setEndAt(preset.endAt)
                                }}
                                className="px-2.5 py-1 rounded-md bg-secondary/20 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Wallet size={14} className="text-emerald-400" />
                        Baslangic Bakiyesi
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
                            placeholder="Veya ozel tutar girin..."
                            className="w-full bg-secondary/30 rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                    </div>
                </div>

                {isReady && (
                    <div className="rounded-xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/10 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={12} className="text-cyan-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Simulasyon Ozeti
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-muted-foreground">Sure</p>
                                <p className="text-xs font-bold text-foreground">
                                    {Math.round(
                                        (new Date(endAt).getTime() - new Date(startAt).getTime()) /
                                            (1000 * 60 * 60 * 24)
                                    )}{' '}
                                    gun
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Bakiye</p>
                                <p className="text-xs font-bold text-emerald-400">
                                    ₺{formatCurrency(effectiveBalance)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Veri</p>
                                <p className="text-xs font-bold text-foreground">1 dakikalik</p>
                            </div>
                        </div>
                    </div>
                )}

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
                    Simulasyonu Baslat
                </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/50 mt-4">
                1 dakikalik replay verisi 21 Ocak 2026 09:55 itibariyla baslar.
            </p>
        </div>
    )
}
