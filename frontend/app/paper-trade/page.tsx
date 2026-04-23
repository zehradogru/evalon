import type { Metadata } from 'next'
import { PaperTradeDashboard } from '@/features/paper-trade/paper-trade-dashboard'

export const metadata: Metadata = {
    title: 'Paper Trade — EVALON',
    description: 'Sanal para ile gerçek zamanlı borsa simülasyonu. Risk almadan alım-satım kararlarınızı test edin.',
}

export default function PaperTradePage() {
    return <PaperTradeDashboard />
}
