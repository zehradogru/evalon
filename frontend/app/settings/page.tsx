'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SettingsView } from '@/features/settings/settings-view';

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <SettingsView />
            </DashboardShell>
        </ProtectedRoute>
    );
}
