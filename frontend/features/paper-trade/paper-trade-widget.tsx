'use client'

import Link from 'next/link'
import { Gamepad2, ArrowRight } from 'lucide-react'

/**
 * Paper Trade Widget — Simplified to direct users to the Trading Simulator.
 * The old Firebase-backed live portfolio widget has been removed.
 */
export function PaperTradeWidget() {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground flex-1">Trading Simulator</h2>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">Borsa Zaman Makinesi</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px]">
                        Geçmiş verilerde al-sat yap, geleceği görmeden karar ver.
                    </p>
                </div>
                <Link
                    href="/paper-trade"
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg shadow-cyan-500/20"
                >
                    Simülatörü Aç <ArrowRight size={12} />
                </Link>
            </div>
        </div>
    )
}
