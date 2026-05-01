'use client'

import { DashboardShell } from '@/components/layout/dashboard-shell'
import { CoMovementSection } from '@/features/markets/co-movement/co-movement-section'

export default function CoMovementPage() {
    return (
        <DashboardShell>
            <div className="w-full max-w-screen-2xl mx-auto p-6">
                <CoMovementSection />
            </div>
        </DashboardShell>
    )
}
