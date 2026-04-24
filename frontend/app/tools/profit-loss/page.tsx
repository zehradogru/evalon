'use client'

import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ProfitLossCalculator } from '@/features/tools/profit-loss-calculator'

export default function ProfitLossPage() {
    return (
        <DashboardShell>
            <ProfitLossCalculator />
        </DashboardShell>
    )
}
