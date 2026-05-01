'use client';

import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { NewsView } from '@/features/news/news-view';

export default function NewsPage() {
    return (
        <DashboardShell>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading news...</div>}>
                <NewsView />
            </Suspense>
        </DashboardShell>
    );
}
