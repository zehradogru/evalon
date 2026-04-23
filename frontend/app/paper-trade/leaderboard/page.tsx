import type { Metadata } from 'next'
import { LeaderboardTable } from '@/features/paper-trade/leaderboard-table'

export const metadata: Metadata = {
    title: 'Liderlik Tablosu — EVALON',
    description: 'Paper Trading topluluk sıralaması.',
}

export default function LeaderboardPage() {
    return (
        <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10">
            <LeaderboardTable />
        </div>
    )
}
