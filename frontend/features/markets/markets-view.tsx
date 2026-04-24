'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Activity,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    DollarSign,
    Loader2,
    MoreHorizontal,
    RefreshCw,
    TrendingUp,
} from 'lucide-react'
import { MARKET_TICKERS } from '@/config/markets'
import type { MarketQueryStatus } from '@/lib/market-data'
import { cn } from '@/lib/utils'
import { useInfiniteLoad } from '@/hooks/use-infinite-load'
import { useMarketList } from '@/hooks/use-market-list'
import { fetchPrices } from '@/services/price.service'
import type {
    ListSortDirection,
    MarketListItem,
    MarketListSortField,
    MarketOverviewCard,
} from '@/types'

type SortField = Exclude<MarketListSortField, 'marketCap' | 'pe' | 'eps' | 'sector'>
type SortDirection = ListSortDirection

const RATING_ORDER: Record<string, number> = {
    'Strong Buy': 5,
    Buy: 4,
    Neutral: 3,
    Sell: 2,
    'Strong Sell': 1,
}

const mockMarketData: Record<'nasdaq' | 'forex', MarketListItem[]> = {
    nasdaq: MARKET_TICKERS.NASDAQ.map((item) => ({
        ticker: item.ticker,
        name: item.name,
        price: 850.12,
        changePct: 2.5,
        changeVal: 20.5,
        high: 855,
        low: 835,
        vol: 45_000_000,
        rating: 'Strong Buy',
        marketCap: null,
        pe: null,
        eps: null,
        sector: null,
    })),
    forex: MARKET_TICKERS.FOREX.map((item) => ({
        ticker: item.ticker,
        name: item.name,
        price: 1.085,
        changePct: 0.1,
        changeVal: 0.0011,
        high: 1.087,
        low: 1.083,
        vol: null,
        rating: 'Neutral',
        marketCap: null,
        pe: null,
        eps: null,
        sector: null,
    })),
}

function useCryptoList() {
    const [items, setItems] = useState<MarketListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isError, setIsError] = useState(false)

    useEffect(() => {
        setIsLoading(true)
        setIsError(false)
        void Promise.all(
            MARKET_TICKERS.CRYPTO.map(async (t) => {
                try {
                    const res = await fetchPrices({ ticker: t.ticker, timeframe: '1d', limit: 2 })
                    const bars = res.data
                    if (bars.length === 0) return null
                    const last = bars[bars.length - 1]
                    const prev = bars.length >= 2 ? bars[bars.length - 2] : null
                    return {
                        ticker: t.ticker,
                        name: t.name,
                        price: last.c,
                        changePct: prev ? ((last.c - prev.c) / prev.c) * 100 : 0,
                        changeVal: prev ? last.c - prev.c : 0,
                        high: last.h,
                        low: last.l,
                        vol: last.v,
                        rating: 'Neutral' as const,
                        marketCap: null,
                        pe: null,
                        eps: null,
                        sector: null,
                    } satisfies MarketListItem
                } catch {
                    return null
                }
            })
        )
            .then((results: (MarketListItem | null)[]) => setItems(results.filter((r): r is MarketListItem => r !== null)))
            .catch(() => setIsError(true))
            .finally(() => setIsLoading(false))
    }, [])

    return { items, isLoading, isError }
}

function formatVolume(vol: number | null) {
    if (vol === null) return '-'
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
    return vol.toFixed(0)
}

function RatingBadge({ rating }: { rating: string }) {
    let colorClass = 'bg-secondary text-muted-foreground'
    if (rating === 'Strong Buy') colorClass = 'bg-chart-2/20 text-chart-2'
    if (rating === 'Buy') colorClass = 'bg-chart-2/10 text-chart-2'
    if (rating === 'Sell') colorClass = 'bg-destructive/10 text-destructive'
    if (rating === 'Strong Sell') colorClass = 'bg-destructive/20 text-destructive border-destructive/20'

    return (
        <Badge variant="outline" className={cn('border-0 font-medium whitespace-nowrap', colorClass)}>
            {rating}
        </Badge>
    )
}

function SortableHeadCell({
    field,
    label,
    align = 'right',
    activeField,
    sortDirection,
    onSort,
}: {
    field: SortField
    label: string
    align?: 'left' | 'right'
    activeField: SortField
    sortDirection: SortDirection
    onSort: (field: SortField) => void
}) {
    const isActive = activeField === field

    return (
        <TableHead
            className={cn(
                'text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:bg-muted/50',
                align === 'left' ? 'text-left pl-4' : 'text-right',
                isActive ? 'text-foreground' : 'text-muted-foreground'
            )}
            onClick={() => onSort(field)}
        >
            <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
                <span>{label}</span>
                {isActive ? (
                    sortDirection === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    )
                ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
                )}
            </div>
        </TableHead>
    )
}

interface MarketTableProps {
    data: MarketListItem[]
    isLoading?: boolean
    isError?: boolean
    errorMessage?: string
    isInteractive?: boolean
    sortField?: SortField
    sortDirection?: SortDirection
    onSortChange?: (field: SortField) => void
    hasMore?: boolean
    isFetchingMore?: boolean
    onLoadMore?: () => void
    sentinelRef?: RefObject<HTMLDivElement | null>
    total?: number
    marketStatus?: MarketQueryStatus
    onRetry?: () => void
}

function MarketTable({
    data,
    isLoading,
    isError,
    errorMessage,
    isInteractive = false,
    sortField,
    sortDirection,
    onSortChange,
    hasMore,
    isFetchingMore,
    onLoadMore,
    sentinelRef,
    total,
    marketStatus,
    onRetry,
}: MarketTableProps) {
    const router = useRouter()

    const [localSortField, setLocalSortField] = useState<SortField>('changePct')
    const [localSortDirection, setLocalSortDirection] = useState<SortDirection>('desc')

    const activeSortField = sortField ?? localSortField
    const activeSortDirection = sortDirection ?? localSortDirection
    const isServerSorted = Boolean(onSortChange)

    const handleSort = (field: SortField) => {
        if (isServerSorted && onSortChange) {
            onSortChange(field)
            return
        }

        if (localSortField === field) {
            setLocalSortDirection(localSortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setLocalSortField(field)
            setLocalSortDirection('desc')
        }
    }

    const sortedData = useMemo(() => {
        if (isServerSorted) return data

        return [...data].sort((a, b) => {
            const aHasData = a.price !== null
            const bHasData = b.price !== null

            if (aHasData && !bHasData) return -1
            if (!aHasData && bHasData) return 1
            if (!aHasData && !bHasData) return 0

            if (activeSortField === 'ticker') {
                const compare = a.ticker.localeCompare(b.ticker, 'en-US')
                return activeSortDirection === 'asc' ? compare : -compare
            }

            if (activeSortField === 'rating') {
                const aRank = RATING_ORDER[a.rating] || 0
                const bRank = RATING_ORDER[b.rating] || 0
                return activeSortDirection === 'asc' ? aRank - bRank : bRank - aRank
            }

            const aValue = a[activeSortField] ?? 0
            const bValue = b[activeSortField] ?? 0
            return activeSortDirection === 'asc' ? aValue - bValue : bValue - aValue
        })
    }, [activeSortDirection, activeSortField, data, isServerSorted])

    if (isLoading) {
        return (
            <Card className="bg-card border-none rounded-none shadow-none overflow-hidden flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
        )
    }

    if (isError || (marketStatus?.source === 'error' && !marketStatus.hasUsableData)) {
        return (
            <Card className="bg-card border-none rounded-none shadow-none overflow-hidden p-8">
                <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-sm text-destructive">
                        {errorMessage || marketStatus?.errorMessage || 'Failed to load list.'}
                    </span>
                    {onRetry ? (
                        <Button size="sm" variant="outline" onClick={onRetry}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Tekrar Dene
                        </Button>
                    ) : null}
                </div>
            </Card>
        )
    }

    return (
        <>
            <Card className="bg-card border-none rounded-none shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-background hover:bg-background">
                            <TableRow className="border-border hover:bg-background">
                                <SortableHeadCell
                                    field="ticker"
                                    label="Ticker"
                                    align="left"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="price"
                                    label="Price"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="changePct"
                                    label="Change %"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="changeVal"
                                    label="Change"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="high"
                                    label="High"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="low"
                                    label="Low"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="vol"
                                    label="Volume"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="rating"
                                    label="Rating"
                                    activeField={activeSortField}
                                    sortDirection={activeSortDirection}
                                    onSort={handleSort}
                                />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.map((item) => {
                                const hasData = item.price !== null

                                return (
                                    <TableRow
                                        key={item.ticker}
                                        className={cn(
                                            'border-border hover:bg-muted/50 transition-colors group relative',
                                            isInteractive && 'cursor-pointer'
                                        )}
                                        onClick={() => isInteractive && router.push(`/markets/${item.ticker}`)}
                                    >
                                        <TableCell className="font-medium pl-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={cn(
                                                        'h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold',
                                                        hasData
                                                            ? 'bg-secondary text-muted-foreground'
                                                            : 'bg-muted/50 text-muted-foreground/50'
                                                    )}
                                                >
                                                    {item.ticker[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span
                                                        className={cn(
                                                            'text-sm font-bold transition-colors',
                                                            hasData
                                                                ? 'text-foreground group-hover:text-primary'
                                                                : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        {item.ticker}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{item.name}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className={cn('text-right font-mono text-sm', !hasData && 'text-muted-foreground/50')}>
                                            {hasData && item.price !== null ? item.price.toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-medium text-sm',
                                                !hasData
                                                    ? 'text-muted-foreground/50'
                                                    : (item.changePct ?? 0) >= 0
                                                      ? 'text-chart-2'
                                                      : 'text-destructive'
                                            )}
                                        >
                                            {hasData && item.changePct !== null
                                                ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
                                                : '-'}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-medium text-sm',
                                                !hasData
                                                    ? 'text-muted-foreground/50'
                                                    : (item.changeVal ?? 0) >= 0
                                                      ? 'text-chart-2'
                                                      : 'text-destructive'
                                            )}
                                        >
                                            {hasData && item.changeVal !== null
                                                ? `${item.changeVal > 0 ? '+' : ''}${item.changeVal.toFixed(2)}`
                                                : '-'}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-mono text-sm',
                                                hasData ? 'text-muted-foreground' : 'text-muted-foreground/50'
                                            )}
                                        >
                                            {hasData && item.high !== null ? item.high.toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-mono text-sm',
                                                hasData ? 'text-muted-foreground' : 'text-muted-foreground/50'
                                            )}
                                        >
                                            {hasData && item.low !== null ? item.low.toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right text-sm',
                                                hasData ? 'text-muted-foreground' : 'text-muted-foreground/50'
                                            )}
                                        >
                                            {hasData ? formatVolume(item.vol) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <RatingBadge rating={item.rating || 'Neutral'} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}

                            {sortedData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        {marketStatus?.isWarming
                                            ? 'Market data warming up.'
                                            : 'No data available'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <div className="px-1 pt-4 pb-2">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                        Showing {sortedData.length}
                        {typeof total === 'number' ? ` / ${total}` : ''}
                    </span>

                    {hasMore ? (
                        <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={isFetchingMore}
                            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                        >
                            {isFetchingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Load More
                        </button>
                    ) : (
                        <span>All rows loaded</span>
                    )}
                </div>
                <div ref={sentinelRef} className="h-2" aria-hidden="true" />
            </div>
        </>
    )
}

function MarketSummaryCard({
    card,
    defaultTitle,
    icon,
    color,
    isLoading,
}: {
    card?: MarketOverviewCard
    defaultTitle: string
    icon: React.ReactNode
    color: string
    isLoading: boolean
}) {
    const title = card?.label || defaultTitle
    const hasValue = typeof card?.value === 'number'
    const hasChange = typeof card?.changePct === 'number'
    const numericChangePct = hasChange && card ? card.changePct : null
    const sourceLabel = (() => {
        if (!card) return isLoading ? 'Refreshing' : 'data unavailable'
        if (card.source === 'tcmb-official-daily') return 'official daily rate'
        if (card.source === 'error-yahoo-429') return 'source limit (yahoo 429)'
        if (card.source === 'error') return 'data unavailable'
        if (card.stale || card.source.startsWith('stale-cache')) return 'Stale'
        return 'live'
    })()

    const numericValue = hasValue && card ? card.value : null
    const formattedValue = typeof numericValue === 'number'
        ? numericValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: card?.currency === 'TRY' ? 2 : 3,
        })
        : '-'

    return (
        <Card className="p-5 bg-card border-border hover:border-primary/50 transition-all cursor-default group">
            <div className="flex justify-between items-start mb-4">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105', color)}>
                    <div className="text-white">{icon}</div>
                </div>
                <div className="flex flex-col items-end">
                    <span
                        className={cn(
                            'text-sm font-bold',
                            !hasChange
                                ? 'text-muted-foreground'
                                : (numericChangePct ?? 0) >= 0
                                    ? 'text-chart-2'
                                    : 'text-destructive'
                        )}
                    >
                        {typeof numericChangePct === 'number'
                            ? `${numericChangePct > 0 ? '+' : ''}${numericChangePct.toFixed(2)}%`
                            : '--'}
                    </span>
                    <span className="text-xs text-muted-foreground">24h Degisim</span>
                </div>
            </div>
            <div className="space-y-1">
                <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
                <p className="text-2xl font-bold tracking-tight" suppressHydrationWarning>
                    {formattedValue}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {card?.currency || (defaultTitle.includes('USD') ? 'USD' : 'TRY')} | {sourceLabel}
                </p>
            </div>
        </Card>
    )
}

const OVERVIEW_LAYOUT: Array<{
    id: MarketOverviewCard['id']
    title: string
    color: string
    icon: React.ReactNode
}> = [
        { id: 'bist100', title: 'BIST 100', color: 'bg-chart-5', icon: <TrendingUp size={20} /> },
        { id: 'bist30', title: 'BIST 30', color: 'bg-primary', icon: <Activity size={20} /> },
        { id: 'xauusd', title: 'Gold (XAU) / USD', color: 'bg-chart-4', icon: <DollarSign size={20} /> },
        { id: 'usdtry', title: 'USD / TRY', color: 'bg-chart-2', icon: <DollarSign size={20} /> },
    ]

export function MarketsView() {
    const [sortField, setSortField] = useState<SortField>('changePct')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const { items: cryptoItems, isLoading: cryptoLoading, isError: cryptoError } = useCryptoList()

    const {
        data,
        isLoading,
        isError,
        error,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        marketStatus,
        retryNow,
    } = useMarketList({
        view: 'markets',
        limit: 10,
        sortBy: sortField,
        sortDir: sortDirection,
    })

    const rows = useMemo(() => data?.pages.flatMap((page) => page.items) || [], [data])
    const total = data?.pages[0]?.total
    const overviewQuery = useQuery<{ cards: MarketOverviewCard[] }>({
        queryKey: ['market-overview-cards'],
        queryFn: async () => {
            const response = await fetch('/api/market-overview', { cache: 'no-store' })
            if (!response.ok) {
                throw new Error('Failed to fetch overview card data.')
            }
            return response.json() as Promise<{ cards: MarketOverviewCard[] }>
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
        retry: 1,
    })

    const overviewCards = useMemo(() => {
        const byId = new Map(
            (overviewQuery.data?.cards || []).map((card) => [card.id, card] as const)
        )
        return OVERVIEW_LAYOUT.map((item) => ({
            ...item,
            card: byId.get(item.id),
        }))
    }, [overviewQuery.data?.cards])

    const handleSortChange = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                return
            }

            setSortField(field)
            setSortDirection('desc')
        },
        [sortField]
    )

    const handleLoadMore = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage) return
        void fetchNextPage()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    const { sentinelRef } = useInfiniteLoad({
        canLoadMore: Boolean(hasNextPage),
        isLoadingMore: isFetchingNextPage,
        onLoadMore: handleLoadMore,
    })

    return (
        <div className="flex flex-col w-full h-full bg-background">
            <div className="p-6 border-b border-border bg-background">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Markets Overview</h1>
                    <p className="text-muted-foreground">Global insights, stocks, crypto, and currency pairs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {overviewCards.map((item) => (
                        <MarketSummaryCard
                            key={item.id}
                            defaultTitle={item.title}
                            icon={item.icon}
                            color={item.color}
                            card={item.card}
                            isLoading={overviewQuery.isLoading}
                        />
                    ))}
                </div>
            </div>

            <div className="flex-1 p-6">
                <Tabs defaultValue="bist" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="bg-transparent p-0 gap-6 h-auto">
                            <TabsTrigger
                                value="bist"
                                className="bg-transparent p-0 pb-2 text-base rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                BIST
                            </TabsTrigger>
                            <TabsTrigger
                                value="nasdaq"
                                className="bg-transparent p-0 pb-2 text-base rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                NASDAQ
                            </TabsTrigger>
                            <TabsTrigger
                                value="crypto"
                                className="bg-transparent p-0 pb-2 text-base rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                Crypto
                            </TabsTrigger>
                            <TabsTrigger
                                value="forex"
                                className="bg-transparent p-0 pb-2 text-base rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                Forex
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className="text-xs px-2 py-1 gap-1 border-border text-muted-foreground hover:text-foreground cursor-default"
                            >
                                <MoreHorizontal size={14} />
                                More Filters
                            </Badge>
                            <MarketDataStatusChip
                                status={marketStatus}
                                labels={{
                                    refreshing: 'Refreshing',
                                    warming: 'Warming up',
                                    stale: 'Stale',
                                    partial: 'Partial data',
                                    error: 'Connection issue',
                                }}
                            />
                        </div>
                    </div>

                    <TabsContent value="bist" className="mt-0 animate-in fade-in duration-500">
                        <MarketTable
                            data={rows}
                            isLoading={isLoading}
                            isError={isError}
                            errorMessage={error instanceof Error ? error.message : undefined}
                            isInteractive={true}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSortChange={handleSortChange}
                            hasMore={hasNextPage}
                            isFetchingMore={isFetchingNextPage}
                            onLoadMore={handleLoadMore}
                            sentinelRef={sentinelRef}
                            total={total}
                            marketStatus={marketStatus}
                            onRetry={() => void retryNow()}
                        />
                    </TabsContent>

                    <TabsContent value="nasdaq" className="mt-0 animate-in fade-in duration-500">
                        <MarketTable data={mockMarketData.nasdaq} isInteractive={true} />
                    </TabsContent>

                    <TabsContent value="crypto" className="mt-0 animate-in fade-in duration-500">
                        <MarketTable data={cryptoItems} isLoading={cryptoLoading} isError={cryptoError} isInteractive={true} />
                    </TabsContent>

                    <TabsContent value="forex" className="mt-0 animate-in fade-in duration-500">
                        <MarketTable data={mockMarketData.forex} isInteractive={true} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
