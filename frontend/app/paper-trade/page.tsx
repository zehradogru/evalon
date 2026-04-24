import type { Metadata } from 'next'
import { PaperTradeDashboard } from '@/features/paper-trade/paper-trade-dashboard'

export const metadata: Metadata = {
    title: 'Paper Trade — EVALON',
    description: 'Real-time stock market simulation with virtual money. Test your trading decisions without risk.',
}

export default function PaperTradePage() {
    return <PaperTradeDashboard />
}
