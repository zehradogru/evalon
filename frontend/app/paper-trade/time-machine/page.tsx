import type { Metadata } from 'next'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { TimeMachinePanel } from '@/features/paper-trade/time-machine-panel'
import { TimeMachineBackLink } from '@/features/paper-trade/time-machine-back-link'

export const metadata: Metadata = {
    title: 'Historical Simulation — EVALON',
    description: 'Simulate investment scenarios with historical data.',
}

export default function TimeMachinePage() {
    return (
        <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10">
            <TimeMachineBackLink />
            <TimeMachinePanel />
        </div>
    )
}
