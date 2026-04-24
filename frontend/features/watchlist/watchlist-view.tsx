'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useDashboardWatchlist } from '@/hooks/use-dashboard-data'
import {
    useAddWatchlistTicker,
    useRemoveWatchlistTicker,
    useUserWatchlist,
} from '@/hooks/use-user-watchlist'
import { Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'

interface WatchlistViewProps {
    isWidget?: boolean
}

interface SearchSuggestion {
    ticker: string
    name: string
}

const EMPTY_TICKERS: string[] = []

function formatVolume(vol: number | null): string {
    if (vol === null) return '-'
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
    return vol.toFixed(0)
}

async function fetchWatchlistSuggestions(
    searchQuery: string
): Promise<SearchSuggestion[]> {
    const params = new URLSearchParams({
        view: 'markets',
        limit: '8',
        sortBy: 'ticker',
        sortDir: 'asc',
        q: searchQuery,
    })

    const response = await fetch(`/api/markets/list?${params.toString()}`)
    if (!response.ok) {
        throw new Error('Failed to search tickers')
    }

    const payload: {
        items: Array<{ ticker: string; name: string }>
    } = await response.json()

    return payload.items.map((item) => ({
        ticker: item.ticker,
        name: item.name,
    }))
}

export function WatchlistView({ isWidget = false }: WatchlistViewProps) {
    const { data: userWatchlist } = useUserWatchlist()
    const {
        data: quoteRows,
        marketStatus,
        retryNow,
    } = useDashboardWatchlist()

    const addTickerMutation = useAddWatchlistTicker()
    const removeTickerMutation = useRemoveWatchlistTicker()

    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [feedback, setFeedback] = useState<string | null>(null)

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedQuery(searchQuery.trim().toUpperCase())
        }, 250)
        return () => clearTimeout(timeout)
    }, [searchQuery])

    const {
        data: suggestions = [],
        isLoading: isSuggestionsLoading,
    } = useQuery({
        queryKey: ['watchlist-suggestions', debouncedQuery],
        queryFn: () => fetchWatchlistSuggestions(debouncedQuery),
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 30,
    })

    const watchlistTickers = useMemo(
        () => userWatchlist?.tickers ?? EMPTY_TICKERS,
        [userWatchlist?.tickers]
    )
    const quotesByTicker = useMemo(
        () => new Map((quoteRows || []).map((row) => [row.ticker, row])),
        [quoteRows]
    )

    const filteredSuggestions = useMemo(
        () =>
            suggestions.filter(
                (item) => !watchlistTickers.includes(item.ticker)
            ),
        [suggestions, watchlistTickers]
    )

    const isBusy = addTickerMutation.isPending || removeTickerMutation.isPending
    const isLoading = marketStatus.isInitialLoading
    const watchlistRows = quoteRows

    const handleAddTicker = async (ticker: string) => {
        setFeedback(null)
        try {
            await addTickerMutation.mutateAsync(ticker)
            setSearchQuery('')
        } catch (error) {
            setFeedback(
                error instanceof Error ? error.message : 'Ticker could not be added.'
            )
        }
    }

    const handleRemoveTicker = async (ticker: string) => {
        setFeedback(null)
        try {
            await removeTickerMutation.mutateAsync(ticker)
        } catch (error) {
            setFeedback(
                error instanceof Error
                    ? error.message
                    : 'Ticker could not be removed.'
            )
        }
    }

    return (
        <div
            className={cn(
                'flex flex-col h-full',
                isWidget ? 'bg-background' : 'h-[calc(100vh-64px)]'
            )}
        >
            {!isWidget && (
                <div className="border-b border-border p-4 bg-card">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h1 className="text-xl font-bold">My Watchlist</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {watchlistTickers.length} / 30
                                </span>
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
                        <div className="relative max-w-md">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Add symbol..."
                                className="pl-8 bg-background border-border"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                disabled={isBusy}
                            />

                            {searchQuery.trim().length > 0 && (
                                <div className="absolute mt-1 w-full rounded-md border border-border bg-card shadow-lg z-30 max-h-64 overflow-auto">
                                    {isSuggestionsLoading ? (
                                        <div className="p-3 text-xs text-muted-foreground">
                                            Searching...
                                        </div>
                                    ) : filteredSuggestions.length === 0 ? (
                                        <div className="p-3 text-xs text-muted-foreground">
                                            No matching ticker found.
                                        </div>
                                    ) : (
                                        filteredSuggestions.map((item) => (
                                            <button
                                                key={item.ticker}
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-2"
                                                onClick={() => handleAddTicker(item.ticker)}
                                                disabled={isBusy}
                                            >
                                                <span className="text-sm font-semibold">
                                                    {item.ticker}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {item.name}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        {feedback && (
                            <p className="text-xs text-destructive">{feedback}</p>
                        )}
                    </div>
                </div>
            )}

            {isWidget && (
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 transition-colors">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        My Watchlist
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                            {watchlistTickers.length} tickers
                        </span>
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
            )}

            <div className={cn('flex-1 overflow-auto bg-background', isWidget ? 'px-0' : '')}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : marketStatus.source === 'error' && !marketStatus.hasUsableData ? (
                    <div className="p-6 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <p className="text-sm text-destructive">
                                {marketStatus.errorMessage || 'Watchlist could not be loaded.'}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => void retryNow()}>
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                Tekrar Dene
                            </Button>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        {!isWidget && (
                            <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 font-medium text-muted-foreground">Symbol</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Last</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Chg</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Chg%</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">High</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Low</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Vol</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {watchlistRows.map((row) => {
                                const quote = quotesByTicker.get(row.ticker)
                                const isPositive = row.changePercent >= 0

                                return (
                                    <tr
                                        key={row.ticker}
                                        className="border-b border-border hover:bg-accent/5 group transition-colors"
                                    >
                                        <td className={cn('p-4', isWidget && 'py-2 px-3')}>
                                            <Link
                                                href={`/markets/${row.ticker}`}
                                                className="flex flex-col"
                                            >
                                                <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                    {row.ticker}
                                                </span>
                                                {!isWidget && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {row.name}
                                                    </span>
                                                )}
                                            </Link>
                                        </td>

                                        <td
                                            className={cn(
                                                'p-4 text-right font-mono text-base',
                                                isWidget && 'py-2 px-3 text-sm'
                                            )}
                                        >
                                            {row.price.toFixed(2)}
                                        </td>

                                        {!isWidget && (
                                            <>
                                                <td
                                                    className={cn(
                                                        'p-4 text-right font-medium',
                                                        isPositive
                                                            ? 'text-chart-2'
                                                            : 'text-destructive'
                                                    )}
                                                >
                                                    {row.change > 0 ? '+' : ''}
                                                    {row.change.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span
                                                        className={cn(
                                                            'px-2 py-1 rounded text-xs font-semibold',
                                                            isPositive
                                                                ? 'bg-chart-2/10 text-chart-2'
                                                                : 'bg-destructive/10 text-destructive'
                                                        )}
                                                    >
                                                        {row.changePercent > 0 ? '+' : ''}
                                                        {row.changePercent.toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-muted-foreground">
                                                    {quote?.high !== null &&
                                                    quote?.high !== undefined
                                                        ? quote.high.toFixed(2)
                                                        : '-'}
                                                </td>
                                                <td className="p-4 text-right text-muted-foreground">
                                                    {quote?.low !== null &&
                                                    quote?.low !== undefined
                                                        ? quote.low.toFixed(2)
                                                        : '-'}
                                                </td>
                                                <td className="p-4 text-right text-muted-foreground">
                                                    {formatVolume(
                                                        quote?.vol ?? null
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                                        onClick={() =>
                                                            handleRemoveTicker(
                                                                row.ticker
                                                            )
                                                        }
                                                        disabled={isBusy}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </td>
                                            </>
                                        )}

                                        {isWidget && (
                                            <td className="p-2 text-right px-3">
                                                <span
                                                    className={cn(
                                                        'text-xs font-medium block',
                                                        isPositive
                                                            ? 'text-chart-2'
                                                            : 'text-destructive'
                                                    )}
                                                >
                                                    {row.changePercent > 0 ? '+' : ''}
                                                    {row.changePercent.toFixed(2)}%
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}

                            {watchlistRows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={isWidget ? 3 : 8}
                                        className="py-8 text-center text-muted-foreground text-sm"
                                    >
                                        {marketStatus.isWarming
                                            ? 'Market data warming up.'
                                            : 'Watchlist is empty. Add a ticker to begin.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {isWidget && (
                <div className="p-2 border-t border-border">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Add ticker"
                            className="h-8 pl-7 text-xs"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            disabled={isBusy}
                        />
                        {searchQuery.trim().length > 0 && (
                            <div className="absolute mt-1 w-full rounded-md border border-border bg-card shadow-lg z-30 max-h-48 overflow-auto">
                                {filteredSuggestions.map((item) => (
                                    <button
                                        key={item.ticker}
                                        type="button"
                                        className="w-full text-left px-2 py-1.5 hover:bg-secondary/50 transition-colors text-xs flex items-center justify-between"
                                        onClick={() => handleAddTicker(item.ticker)}
                                        disabled={isBusy}
                                    >
                                        <span className="font-semibold">
                                            {item.ticker}
                                        </span>
                                        <Plus size={12} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
