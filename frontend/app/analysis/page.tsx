'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AnalysisView } from '@/features/analysis/analysis-view';

export default function AnalysisPage() {
    return (
        <DashboardShell>
            <AnalysisView />
        </DashboardShell>
    );
}
