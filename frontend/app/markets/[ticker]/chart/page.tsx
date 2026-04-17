import { FullscreenChartView } from '@/features/markets/fullscreen-chart-view'

interface ChartPageProps {
    params: Promise<{ ticker: string }>
    searchParams: Promise<{ tf?: string | string[] }>
}

export default async function TickerChartPage({
    params,
    searchParams,
}: ChartPageProps) {
    const [{ ticker }, resolvedSearchParams] = await Promise.all([
        params,
        searchParams,
    ])
    const tf = Array.isArray(resolvedSearchParams.tf)
        ? resolvedSearchParams.tf[0]
        : resolvedSearchParams.tf

    return (
        <FullscreenChartView
            ticker={ticker.toUpperCase()}
            initialTimeframe={tf}
        />
    )
}
