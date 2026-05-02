'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { NotificationsView } from '@/features/notifications/notifications-view'

export default function NotificationsPage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <NotificationsView />
            </DashboardShell>
        </ProtectedRoute>
    )
}
