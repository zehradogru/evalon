import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AiAssistantView } from '@/features/ai-assistant/ai-assistant-view';

export default function AiPage() {
    return (
        <ProtectedRoute>
            <DashboardShell>
                <AiAssistantView />
            </DashboardShell>
        </ProtectedRoute>
    );
}
