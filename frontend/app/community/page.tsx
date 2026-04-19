'use client';

import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CommunityView } from '@/features/community/community-view';

export default function CommunityPage() {
    return (
        <DashboardShell>
            <Suspense fallback={<div className="px-6 py-6 text-sm text-muted-foreground">Loading community...</div>}>
                <CommunityView />
            </Suspense>
        </DashboardShell>
    );
}
