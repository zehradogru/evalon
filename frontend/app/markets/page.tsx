'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MarketsView } from '@/features/markets/markets-view';

export default function MarketsPage() {
    return (
        <DashboardShell>
            <MarketsView />
        </DashboardShell>
    );
}
