'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CorrelationView } from '@/features/correlation/correlation-view';

export default function CorrelationPage() {
    return (
        <DashboardShell>
            <CorrelationView />
        </DashboardShell>
    );
}
