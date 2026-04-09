'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StrategyView } from '@/features/strategy/strategy-view';

export default function StrategyPage() {
    return (
        <DashboardShell>
            <StrategyView />
        </DashboardShell>
    );
}
