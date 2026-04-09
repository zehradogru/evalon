'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileView } from '@/features/profile/profile-view';

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <ProfileView />
            </DashboardShell>
        </ProtectedRoute>
    );
}
