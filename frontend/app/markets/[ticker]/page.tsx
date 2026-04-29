import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TickerView } from '@/features/markets/ticker-view';

interface PageProps {
    params: Promise<{ ticker: string }>;
}

export default async function TickerPage({ params }: PageProps) {
    const { ticker } = await params;

    return (
        <DashboardShell>
            <TickerView ticker={ticker.toUpperCase()} />
        </DashboardShell>
    );
}
