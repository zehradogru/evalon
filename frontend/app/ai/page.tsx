import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AiAssistantView } from '@/features/ai-assistant/ai-assistant-view';

export default function AiPage() {
    return (
        <DashboardShell>
            <AiAssistantView />
        </DashboardShell>
    );
}
