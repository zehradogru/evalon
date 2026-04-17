'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    AlertCircle,
    ArrowLeft,
    ExternalLink,
    Loader2,
    RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    buildGraphWebUrl,
    formatTimeframeLabel,
    toGraphWebTimeframe,
} from '@/lib/evalon'
import { TICKER_NAMES } from '@/config/markets'

interface FullscreenChartViewProps {
    ticker: string
    initialTimeframe?: string
}

interface ChartFrameProps {
    chartUrl: string
    normalizedTicker: string
    timeframe: string
    detailHref: string
    onRetry: () => void
}

const SLOW_LOAD_MS = 2500
const LOAD_TIMEOUT_MS = 10000

function ChartFrame({
    chartUrl,
    normalizedTicker,
    timeframe,
    detailHref,
    onRetry,
}: ChartFrameProps) {
    const [isLoaded, setIsLoaded] = useState(false)
    const [isSlow, setIsSlow] = useState(false)
    const [hasTimedOut, setHasTimedOut] = useState(false)

    useEffect(() => {
        const slowTimer = window.setTimeout(() => setIsSlow(true), SLOW_LOAD_MS)
        const timeoutTimer = window.setTimeout(
            () => setHasTimedOut(true),
            LOAD_TIMEOUT_MS
        )

        return () => {
            window.clearTimeout(slowTimer)
            window.clearTimeout(timeoutTimer)
        }
    }, [])

    const handleLoad = () => {
        setIsLoaded(true)
        setIsSlow(false)
        setHasTimedOut(false)
    }

    return (
        <Card className="relative flex-1 overflow-hidden border-border/70 bg-card/60 p-0">
            <iframe
                src={chartUrl}
                title={`${normalizedTicker} tam ekran grafik`}
                className={`h-full min-h-[calc(100vh-7.5rem)] w-full border-0 transition-opacity duration-300 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={handleLoad}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
            />

            {!isLoaded ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/92 backdrop-blur-sm">
                    {hasTimedOut ? (
                        <div className="mx-4 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border/80 bg-card/95 p-6 text-center shadow-lg">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                                <AlertCircle className="h-6 w-6 text-amber-400" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-semibold">
                                    Grafik beklenenden uzun surdu
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Harici grafik servisi gec yanit veriyor
                                    olabilir. Bu sayfadan cikmadan yeniden
                                    deneyebilir veya yeni sekmede
                                    acabilirsiniz.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button onClick={onRetry}>
                                    <RefreshCw className="h-4 w-4" />
                                    Tekrar Dene
                                </Button>
                                <Button asChild variant="outline">
                                    <a
                                        href={chartUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Yeni Sekmede Aç
                                    </a>
                                </Button>
                                <Button asChild variant="ghost">
                                    <Link href={detailHref}>Detaya Dön</Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-4 flex max-w-sm flex-col items-center gap-4 text-center">
                            <div className="relative">
                                <div className="h-14 w-14 rounded-full border border-primary/20" />
                                <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-primary" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-semibold">
                                    Grafik açılıyor
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {normalizedTicker} ·{' '}
                                    {formatTimeframeLabel(timeframe)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isSlow
                                        ? 'Harici grafik servisi cevap veriyor. Bu ekran açık kalabilir.'
                                        : 'Tam ekran webview hazırlanıyor.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href={chartUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Yeni Sekmede Aç
                                    </a>
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={detailHref}>Detaya Dön</Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </Card>
    )
}

export function FullscreenChartView({
    ticker,
    initialTimeframe,
}: FullscreenChartViewProps) {
    const router = useRouter()
    const normalizedTicker = ticker.toUpperCase()
    const timeframe = useMemo(
        () => toGraphWebTimeframe(initialTimeframe || '1d'),
        [initialTimeframe]
    )
    const chartUrl = useMemo(
        () => buildGraphWebUrl({ symbol: normalizedTicker, tf: timeframe }),
        [normalizedTicker, timeframe]
    )
    const detailHref = `/markets/${normalizedTicker}`
    const [reloadKey, setReloadKey] = useState(0)

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
            return
        }

        router.push(detailHref)
    }

    const handleRetry = () => {
        setReloadKey((current) => current + 1)
    }

    return (
        <div
            className="flex min-h-screen flex-col bg-background text-foreground"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={handleBack}
                        aria-label="Detay sayfasina don"
                        title="Detaya don"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
                                {normalizedTicker}
                            </h1>
                            <Badge
                                variant="outline"
                                className="border-primary/20 bg-primary/5 text-[10px] text-primary sm:text-xs"
                            >
                                {formatTimeframeLabel(timeframe)}
                            </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                            {TICKER_NAMES[normalizedTicker] || 'Borsa Istanbul'} ·
                            Tam ekran grafik
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            onClick={handleRetry}
                            title="Grafiği yenile"
                            aria-label="Grafiği yenile"
                        >
                            <RefreshCw
                                className="h-4 w-4"
                            />
                        </Button>

                        <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 sm:hidden"
                        >
                            <a
                                href={chartUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Grafiği yeni sekmede aç"
                                title="Yeni sekmede aç"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="hidden sm:inline-flex"
                        >
                            <a
                                href={chartUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Yeni Sekmede Aç
                            </a>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
                <ChartFrame
                    key={`${chartUrl}:${reloadKey}`}
                    chartUrl={chartUrl}
                    normalizedTicker={normalizedTicker}
                    timeframe={timeframe}
                    detailHref={detailHref}
                    onRetry={handleRetry}
                />
            </main>
        </div>
    )
}
