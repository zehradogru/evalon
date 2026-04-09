'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ScreenerView } from '@/features/screener/screener-view';

export default function ScreenerPage() {
    return (
        <DashboardShell>
            <ScreenerView />
        </DashboardShell>
    );
}
