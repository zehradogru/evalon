'use client'

import { DashboardShell } from '@/components/layout/dashboard-shell'
import { MoversView } from '@/features/markets/movers-view'

export default function MoversPage() {
    return (
        <DashboardShell>
            <MoversView />
        </DashboardShell>
    )
}
