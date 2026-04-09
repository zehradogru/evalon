'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CommunityView } from '@/features/community/community-view';

export default function CommunityPage() {
    return (
        <DashboardShell>
            <CommunityView />
        </DashboardShell>
    );
}
