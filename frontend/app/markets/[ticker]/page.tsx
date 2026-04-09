import { TickerView } from '@/features/markets/ticker-view';

interface PageProps {
    params: Promise<{ ticker: string }>;
}

export default async function TickerPage({ params }: PageProps) {
    const { ticker } = await params;

    return (
        <div className="flex-1 w-full h-full flex flex-col bg-background">
            <TickerView ticker={ticker.toUpperCase()} />
        </div>
    );
}
