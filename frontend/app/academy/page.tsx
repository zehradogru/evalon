import { DashboardShell } from '@/components/layout/dashboard-shell'
import { AcademyView } from '@/features/academy/academy-view'

export default function AcademyPage() {
    return (
        <DashboardShell>
            <div className="mx-auto max-w-5xl px-4 py-8">
                <AcademyView />
            </div>
        </DashboardShell>
    )
}
