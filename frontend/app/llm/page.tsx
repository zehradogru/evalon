'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LLMView } from '@/features/llm/llm-view';

export default function LLMPage() {
    return (
        <DashboardShell>
            <LLMView />
        </DashboardShell>
    );
}
