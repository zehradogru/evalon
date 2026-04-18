'use client'

import { useState } from 'react'
import { MainChart } from '@/features/dashboard/main-chart'
import { LiveWatchlist } from '@/features/dashboard/live-watchlist'
import { MarketMovers } from '@/features/dashboard/top-movers'
import { MarketSummary } from '@/features/dashboard/market-summary'
import { MarketStatus } from '@/features/dashboard/market-status'
import { MarketNews } from '@/features/dashboard/market-news'

const DASHBOARD_LAST_SELECTION_KEY = 'dashboard:last-selection'
const DEFAULT_SELECTION = {
    ticker: 'XU100',
    name: 'BIST 100',
}

function readInitialSelection() {
    if (typeof window === 'undefined') {
        return DEFAULT_SELECTION
    }

    try {
        const saved = window.localStorage.getItem(DASHBOARD_LAST_SELECTION_KEY)
        if (!saved) return DEFAULT_SELECTION

        const parsed = JSON.parse(saved) as {
            ticker?: string
            name?: string
        }

        if (typeof parsed.ticker === 'string' && parsed.ticker.trim().length > 0) {
            const ticker = parsed.ticker.trim().toUpperCase()
            return {
                ticker,
                name:
                    typeof parsed.name === 'string' && parsed.name.trim().length > 0
                        ? parsed.name
                        : ticker,
            }
        }
    } catch {
        // Ignore invalid localStorage payloads and keep defaults.
    }

    return DEFAULT_SELECTION
}

export function DashboardView() {
    const [selectedTicker, setSelectedTicker] = useState(() => readInitialSelection().ticker)
    const [selectedName, setSelectedName] = useState(() => readInitialSelection().name)

    const handleSelectTicker = (ticker: string, name: string) => {
        setSelectedTicker(ticker)
        setSelectedName(name)

        try {
            window.localStorage.setItem(
                DASHBOARD_LAST_SELECTION_KEY,
                JSON.stringify({ ticker, name })
            )
        } catch {
            // Ignore storage write failures.
        }
    }

    return (
        <div className="space-y-4 p-4 lg:p-5">
            {/* Row 0: Compact Status Bar */}
            <MarketStatus />

            {/* Row 1: Watchlist (sidebar) + Main Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-3 h-[480px] order-2 lg:order-1">
                    <LiveWatchlist
                        onSelectTicker={handleSelectTicker}
                        activeTicker={selectedTicker}
                    />
                </div>
                <div className="lg:col-span-9 h-[480px] order-1 lg:order-2">
                    <MainChart ticker={selectedTicker} name={selectedName} />
                </div>
            </div>

            {/* Row 2: Market Movers + Market Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 h-[300px]">
                    <MarketMovers />
                </div>
                <div className="lg:col-span-4 h-[300px]">
                    <MarketSummary />
                </div>
            </div>

            {/* Row 3: Market News */}
            <div className="h-[300px]">
                <MarketNews />
            </div>
        </div>
    )
}
