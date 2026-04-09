'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { WatchlistView } from '@/features/watchlist/watchlist-view';

export default function WatchlistPage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <WatchlistView />
            </DashboardShell>
        </ProtectedRoute>
    );
}
