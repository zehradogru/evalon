'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { NewsView } from '@/features/news/news-view';

export default function NewsPage() {
    return (
        <DashboardShell>
            <NewsView />
        </DashboardShell>
    );
}
