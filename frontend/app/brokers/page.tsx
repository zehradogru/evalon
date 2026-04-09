'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BrokersView } from '@/features/brokers/brokers-view';

export default function BrokersPage() {
    return (
        <DashboardShell>
            <BrokersView />
        </DashboardShell>
    );
}
