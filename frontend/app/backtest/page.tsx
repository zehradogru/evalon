'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BacktestView } from '@/features/backtest/backtest-view';

export default function BacktestPage() {
    return (
        <DashboardShell>
            <BacktestView />
        </DashboardShell>
    );
}
