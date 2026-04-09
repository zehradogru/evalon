'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CalendarView } from '@/features/calendar/calendar-view';

export default function CalendarPage() {
    return (
        <DashboardShell>
            <CalendarView />
        </DashboardShell>
    );
}
