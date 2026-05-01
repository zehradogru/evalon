'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { AlertsView } from '@/features/notifications/alerts-view'

export default function AlertsPage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <AlertsView />
            </DashboardShell>
        </ProtectedRoute>
    )
}
