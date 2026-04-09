'use client'

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
} from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select-native'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Download,
    Filter,
    Loader2,
    MoreHorizontal,
    RefreshCcw,
    Search,
    SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInfiniteLoad } from '@/hooks/use-infinite-load'
import { useMarketList } from '@/hooks/use-market-list'
import {
    useDeleteScreenerPreset,
    useSaveScreenerPreset,
    useScreenerPresets,
} from '@/hooks/use-screener-presets'
import type { ListSortDirection, MarketListSortField } from '@/types'

interface ScreenerViewProps {
    isWidget?: boolean
}

function RatingBadge({ rating }: { rating: string }) {
    let colorClass = 'bg-secondary text-muted-foreground'
    if (rating === 'Strong Buy') colorClass = 'bg-chart-2/20 text-chart-2 border-chart-2/20'
    if (rating === 'Buy') colorClass = 'bg-chart-2/10 text-chart-2'
    if (rating === 'Sell') colorClass = 'bg-destructive/10 text-destructive'
    if (rating === 'Strong Sell') colorClass = 'bg-destructive/20 text-destructive border-destructive/20'

    return (
        <Badge variant="outline" className={cn('border font-medium whitespace-nowrap h-5 text-[10px]', colorClass)}>
            {rating}
        </Badge>
    )
}

function formatVolume(vol: number | null) {
    if (vol === null) return '-'
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
    return vol.toFixed(0)
}

function formatNullableNumber(value: number | null | undefined, decimals = 2) {
    if (value === null || value === undefined) return '-'
    return value.toFixed(decimals)
}

function SortableHeadCell({
    field,
    label,
    align = 'right',
    activeField,
    sortDirection,
    onSort,
}: {
    field: MarketListSortField
    label: string
    align?: 'left' | 'right'
    activeField: MarketListSortField
    sortDirection: ListSortDirection
    onSort: (field: MarketListSortField) => void
}) {
    const active = activeField === field

    return (
        <TableHead
            className={cn(
                'text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:bg-muted/40',
                align === 'left' ? 'text-left' : 'text-right',
                active && 'text-foreground'
            )}
            onClick={() => onSort(field)}
        >
            <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
                <span>{label}</span>
                {active ? (
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

export function ScreenerView({ isWidget = false }: ScreenerViewProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortField, setSortField] = useState<MarketListSortField>('changePct')
    const [sortDirection, setSortDirection] = useState<ListSortDirection>('desc')
    const [selectedPresetId, setSelectedPresetId] = useState('')
    const [presetName, setPresetName] = useState('')
    const [presetFeedback, setPresetFeedback] = useState<string | null>(null)

    const { data: screenerPresets = [] } = useScreenerPresets()
    const savePresetMutation = useSaveScreenerPreset()
    const deletePresetMutation = useDeleteScreenerPreset()

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim())
        }, 300)

        return () => clearTimeout(timeout)
    }, [searchTerm])

    const {
        data,
        isLoading,
        isError,
        error,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
        isFetching,
    } = useMarketList({
        view: 'screener',
        limit: 10,
        sortBy: sortField,
        sortDir: sortDirection,
        q: debouncedSearch,
    })

    const rows = useMemo(() => data?.pages.flatMap((page) => page.items) || [], [data])
    const total = data?.pages[0]?.total ?? 0

    const handleLoadMore = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage) return
        void fetchNextPage()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    const { sentinelRef } = useInfiniteLoad({
        canLoadMore: Boolean(hasNextPage),
        isLoadingMore: isFetchingNextPage,
        onLoadMore: handleLoadMore,
    })

    const handleSort = (field: MarketListSortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            return
        }

        setSortField(field)
        setSortDirection('desc')
    }

    const handleSavePreset = async () => {
        setPresetFeedback(null)
        const normalizedName = presetName.trim()
        if (!normalizedName) {
            setPresetFeedback('Preset name is required.')
            return
        }

        try {
            const nextPresets = await savePresetMutation.mutateAsync({
                name: normalizedName,
                search: searchTerm.trim(),
                sortBy: sortField,
                sortDir: sortDirection,
            })

            const savedPreset = nextPresets.find(
                (preset) =>
                    preset.name.toLocaleLowerCase('tr-TR') ===
                    normalizedName.toLocaleLowerCase('tr-TR')
            )
            if (savedPreset) {
                setSelectedPresetId(savedPreset.id)
            }
            setPresetFeedback('Preset saved.')
        } catch (mutationError) {
            setPresetFeedback(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Preset could not be saved.'
            )
        }
    }

    const handleDeletePreset = async () => {
        if (!selectedPresetId) return
        setPresetFeedback(null)
        try {
            await deletePresetMutation.mutateAsync(selectedPresetId)
            setSelectedPresetId('')
            setPresetName('')
            setPresetFeedback('Preset deleted.')
        } catch (mutationError) {
            setPresetFeedback(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Preset could not be deleted.'
            )
        }
    }

    const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const presetId = event.target.value
        setSelectedPresetId(presetId)
        setPresetFeedback(null)

        if (!presetId) {
            setPresetName('')
            return
        }

        const selected = screenerPresets.find((preset) => preset.id === presetId)
        if (!selected) return

        setSearchTerm(selected.search)
        setDebouncedSearch(selected.search)
        setSortField(selected.sortBy)
        setSortDirection(selected.sortDir)
        setPresetName(selected.name)
    }

    if (isWidget) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 shrink-0">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <SlidersHorizontal size={16} />
                        Screener
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                            void refetch()
                        }}
                    >
                        <RefreshCcw size={14} className={cn(isFetching && 'animate-spin')} />
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : isError ? (
                        <div className="px-4 py-6 text-xs text-destructive text-center">
                            {error instanceof Error ? error.message : 'Screener yüklenemedi'}
                        </div>
                    ) : (
                        <>
                            {rows.map((item) => (
                                <div
                                    key={item.ticker}
                                    className="flex items-center justify-between py-2 px-4 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold">{item.ticker}</span>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm">{formatNullableNumber(item.price)}</div>
                                        <div
                                            className={cn(
                                                'text-[10px] font-medium',
                                                (item.changePct ?? 0) >= 0 ? 'text-chart-2' : 'text-destructive'
                                            )}
                                        >
                                            {item.changePct !== null && item.changePct !== undefined
                                                ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
                                                : '-'}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="p-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>
                                    {rows.length} / {total}
                                </span>
                                {hasNextPage ? (
                                    <button
                                        type="button"
                                        onClick={handleLoadMore}
                                        disabled={isFetchingNextPage}
                                        className="underline-offset-2 hover:underline disabled:opacity-60"
                                    >
                                        {isFetchingNextPage ? 'Loading...' : 'Load More'}
                                    </button>
                                ) : (
                                    <span>Done</span>
                                )}
                            </div>
                            <div ref={sentinelRef} className="h-2" aria-hidden="true" />
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col border-b border-border bg-background p-4 gap-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        Stock Screener <Badge variant="secondary" className="text-xs">LIVE</Badge>
                    </h1>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-2 border-border text-muted-foreground hover:text-foreground" disabled>
                            <Download size={14} />
                            Export
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-border text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                void refetch()
                            }}
                            disabled={isFetching}
                        >
                            <RefreshCcw size={14} className={cn(isFetching && 'animate-spin')} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                            placeholder="Symbol or Name..."
                            className="pl-9 h-9 bg-secondary/50 border-border"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>

                    <Badge variant="outline" className="h-9 px-3 gap-2 text-muted-foreground border-border">
                        <Filter size={14} />
                        Server-side filters active
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                        <SlidersHorizontal size={16} />
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={selectedPresetId}
                        onChange={handlePresetChange}
                        className="h-9 w-[220px] bg-secondary/50 border-border text-sm"
                    >
                        <option value="">Select preset</option>
                        {screenerPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.name}
                            </option>
                        ))}
                    </Select>

                    <Input
                        value={presetName}
                        onChange={(event) => setPresetName(event.target.value)}
                        placeholder="Preset name"
                        className="h-9 w-[200px]"
                    />

                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                            void handleSavePreset()
                        }}
                        disabled={savePresetMutation.isPending}
                    >
                        {savePresetMutation.isPending ? 'Saving...' : 'Save Preset'}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                            void handleDeletePreset()
                        }}
                        disabled={!selectedPresetId || deletePresetMutation.isPending}
                    >
                        {deletePresetMutation.isPending ? 'Deleting...' : 'Delete Preset'}
                    </Button>

                    {presetFeedback && (
                        <span className="text-xs text-muted-foreground">{presetFeedback}</span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-background p-4">
                <Card className="bg-card border-border overflow-hidden rounded-md">
                    <Table>
                        <TableHeader className="bg-secondary/30 sticky top-0 z-10 backdrop-blur-sm">
                            <TableRow className="border-border hover:bg-transparent">
                                <SortableHeadCell
                                    field="ticker"
                                    label="Ticker"
                                    align="left"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="price"
                                    label="Price"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="changePct"
                                    label="Change %"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="vol"
                                    label="Volume"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="marketCap"
                                    label="Market Cap"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="pe"
                                    label="P/E"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="eps"
                                    label="EPS (TTM)"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="sector"
                                    label="Sector"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableHeadCell
                                    field="rating"
                                    label="Rating"
                                    activeField={sortField}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center text-sm text-destructive">
                                        {error instanceof Error ? error.message : 'Screener yüklenemedi'}
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                        No data found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((item) => (
                                    <TableRow
                                        key={item.ticker}
                                        className="border-border hover:bg-muted/50 transition-colors group cursor-pointer h-12"
                                    >
                                        <TableCell className="font-medium pl-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-7 w-7 rounded-sm bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                    {item.ticker[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                        {item.ticker}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                        {item.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm font-medium">
                                            {formatNullableNumber(item.price)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right font-medium text-sm',
                                                (item.changePct ?? 0) >= 0 ? 'text-chart-2' : 'text-destructive'
                                            )}
                                        >
                                            {item.changePct !== null && item.changePct !== undefined
                                                ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">{formatVolume(item.vol)}</TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {formatNullableNumber(item.marketCap)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {formatNullableNumber(item.pe)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {formatNullableNumber(item.eps)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">{item.sector || '-'}</TableCell>
                                        <TableCell className="text-center pr-4">
                                            <div className="flex justify-center">
                                                <RatingBadge rating={item.rating || 'Neutral'} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-secondary/10">
                        <span>
                            Showing {rows.length} / {total}
                        </span>
                        <div className="flex items-center gap-2">
                            {hasNextPage ? (
                                <button
                                    type="button"
                                    onClick={handleLoadMore}
                                    disabled={isFetchingNextPage}
                                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-60"
                                >
                                    {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                    Load More
                                </button>
                            ) : (
                                <span>All rows loaded</span>
                            )}
                            <MoreHorizontal size={14} />
                        </div>
                    </div>
                    <div ref={sentinelRef} className="h-2" aria-hidden="true" />
                </Card>
            </div>
        </div>
    )
}
