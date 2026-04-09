'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StockDetailView } from '@/features/stocks/stock-detail-view';

export default function StockPage({ params }: { params: { ticker: string } }) {
    return (
        <DashboardShell>
            <StockDetailView ticker={params.ticker} />
        </DashboardShell>
    );
}
