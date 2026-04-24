'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
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
import { useScreenerScan } from '@/hooks/use-screener'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { FilterPanel } from './filter-panel/filter-panel'
import { ScanControls } from './scan-controls'
import { ResultsTable } from './results-table'
import type { ListSortDirection, MarketListSortField } from '@/types'
import type {
  FilterLogic,
  ScanRequest,
  ScanResponse,
  ScreenerFilter,
  ScreenerTimeframe,
} from '@/types/screener'

function formatVolume(vol: number | null | undefined) {
  if (vol === null || vol === undefined) return '-'
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
  return vol.toFixed(0)
}

function fmt(v: number | null | undefined, d = 2) {
  return v === null || v === undefined ? '-' : v.toFixed(d)
}

function SortHead({
  field, label, align = 'right', activeField, dir, onSort,
}: {
  field: MarketListSortField
  label: string
  align?: 'left' | 'right'
  activeField: MarketListSortField
  dir: ListSortDirection
  onSort: (f: MarketListSortField) => void
}) {
  const active = activeField === field
  return (
    <TableHead
      className={cn(
        'text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:bg-muted/40',
        align === 'left' ? 'text-left' : 'text-right',
        active && 'text-foreground',
      )}
      onClick={() => onSort(field)}
    >
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
        {label}
        {active
          ? dir === 'asc'
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </TableHead>
  )
}

function exportCsv(response: ScanResponse) {
  const header = 'Symbol,Sector,Price,Chg%,Volume,Vol/Avg,Filters'
  const csvRows = response.rows.map((r) =>
    [r.ticker, r.sector ?? '', r.close, r.change_pct, r.volume, r.vol_ratio?.toFixed(2) ?? '', r.matched_filters.join('; ')].join(','),
  )
  const blob = new Blob(['\uFEFF' + [header, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `screener_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface ScreenerViewProps { isWidget?: boolean }

export function ScreenerView({ isWidget = false }: ScreenerViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState<MarketListSortField>('changePct')
  const [sortDirection, setSortDirection] = useState<ListSortDirection>('desc')
  const [filters, setFilters] = useState<ScreenerFilter[]>([])
  const [filterLogic, setFilterLogic] = useState<FilterLogic>('AND')
  const [timeframe, setTimeframe] = useState<ScreenerTimeframe>('1d')
  const [sectors, setSectors] = useState<string[]>([])
  const [lookbackBars, setLookbackBars] = useState(100)
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null)
  const [activeChipId, setActiveChipId] = useState<string | undefined>()
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null)

  const { data: screenerPresets = [] } = useScreenerPresets()
  const savePresetMutation = useSaveScreenerPreset()
  const deletePresetMutation = useDeleteScreenerPreset()
  const scanMutation = useScreenerScan()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isFetching, marketStatus, retryNow } = useMarketList({
    view: 'screener', limit: 50, sortBy: sortField, sortDir: sortDirection, q: debouncedSearch,
  })

  const rows = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])

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
    if (sortField === field) setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('desc') }
  }

  async function handleScan() {
    const req: ScanRequest = {
      tickers: 'all',
      sectors: sectors.length > 0 ? sectors : undefined,
      timeframe,
      lookback_bars: lookbackBars,
      filters,
      logic: filterLogic,
      sort_by: 'change_pct',
      sort_dir: 'desc',
      limit: 200,
    }
    try { setScanResponse(await scanMutation.mutateAsync(req)) } catch { /* handled via isError */ }
  }

  function handleQuickApply(newFilters: ScreenerFilter[], tf?: ScreenerTimeframe, lg?: FilterLogic) {
    setFilters(newFilters)
    if (tf) setTimeframe(tf)
    if (lg) setFilterLogic(lg)
  }

  const handleSavePreset = async () => {
    setPresetFeedback(null)
    const name = presetName.trim()
    if (!name) { setPresetFeedback('Name required.'); return }
    try {
      const saved = await savePresetMutation.mutateAsync({
        name, search: searchTerm.trim(), sortBy: sortField, sortDir: sortDirection,
      })
      const found = saved.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (found) setSelectedPresetId(found.id)
      setPresetFeedback('Saved.')
    } catch (e) { setPresetFeedback(e instanceof Error ? e.message : 'Could not save.') }
  }

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return
    setPresetFeedback(null)
    try {
      await deletePresetMutation.mutateAsync(selectedPresetId)
      setSelectedPresetId('')
      setPresetName('')
      setPresetFeedback('Deleted.')
    } catch (e) { setPresetFeedback(e instanceof Error ? e.message : 'Could not delete.') }
  }

  const handlePresetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedPresetId(id)
    setPresetFeedback(null)
    if (!id) { setPresetName(''); return }
    const p = screenerPresets.find((x) => x.id === id)
    if (!p) return
    setSearchTerm(p.search)
    setDebouncedSearch(p.search)
    setSortField(p.sortBy)
    setSortDirection(p.sortDir)
    setPresetName(p.name)
  }

  // ── Widget mode ──────────────────────────────────────────────────────────────
  if (isWidget) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 shrink-0">
          <span className="font-semibold text-sm flex items-center gap-2">
            <SlidersHorizontal size={16} />
            Stock Screener
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void retryNow()}>
            <div className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}>↻</div>
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {rows.map((item) => (
            <div key={item.ticker} className="flex items-center justify-between py-2 px-4 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0">
              <div className="flex flex-col">
                <span className="text-sm font-bold">{item.ticker}</span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{item.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm">{fmt(item.price)}</div>
                <div className={cn('text-[10px] font-medium', (item.changePct ?? 0) >= 0 ? 'text-chart-2' : 'text-destructive')}>
                  {item.changePct != null ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Full page ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-background shrink-0">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          Stock Screener
          <Badge variant="secondary" className="text-xs font-medium">BIST</Badge>
        </h1>
        <MarketDataStatusChip
          status={marketStatus}
          labels={{
            refreshing: 'Refreshing',
            warming: 'Loading',
            stale: 'Delayed',
            partial: 'Partial data',
            error: 'Connection error',
          }}
        />
      </div>

      <Tabs defaultValue="scan" className="flex flex-col flex-1 overflow-hidden">

        {/* Tab list */}
        <div className="px-8 pt-3 shrink-0 bg-background">
          <TabsList className="h-9 bg-muted/50">
            <TabsTrigger value="browse" className="text-sm px-5">Browse</TabsTrigger>
            <TabsTrigger value="scan" className="text-sm px-5">Scan</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Browse tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="browse" className="flex flex-col flex-1 overflow-hidden mt-0">

          {/* Toolbar */}
          <div className="px-8 py-3 flex flex-wrap items-center gap-2 bg-background shrink-0">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search symbol..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={selectedPresetId}
              onChange={handlePresetChange}
              className="h-9 w-44 text-sm"
            >
              <option value="">Select preset</option>
              {screenerPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="h-9 w-36"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
              onClick={() => void handleSavePreset()}
              disabled={savePresetMutation.isPending}
            >
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4"
              onClick={() => void handleDeletePreset()}
              disabled={!selectedPresetId || deletePresetMutation.isPending}
            >
              Delete
            </Button>
            {presetFeedback && (
              <span className="text-xs text-muted-foreground">{presetFeedback}</span>
            )}
          </div>

          {/* Data table */}
          <div className="flex-1 overflow-auto px-8 py-4">
            <div className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <SortHead field="ticker" label="Symbol" align="left" activeField={sortField} dir={sortDirection} onSort={handleSort} />
                    <SortHead field="price" label="Price" activeField={sortField} dir={sortDirection} onSort={handleSort} />
                    <SortHead field="changePct" label="Chg%" activeField={sortField} dir={sortDirection} onSort={handleSort} />
                    <SortHead field="vol" label="Volume" activeField={sortField} dir={sortDirection} onSort={handleSort} />
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketStatus.isInitialLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                        No results found.
                      </TableCell>
                    </TableRow>
                  ) : rows.map((item) => (
                    <TableRow key={item.ticker} className="hover:bg-accent/40">
                      <TableCell className="font-bold text-sm">
                        <Link href={`/dashboard/charts/${item.ticker}`} className="hover:text-primary transition-colors">
                          {item.ticker}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{fmt(item.price)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums text-sm font-medium', (item.changePct ?? 0) >= 0 ? 'text-chart-2' : 'text-destructive')}>
                        {item.changePct != null ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {formatVolume(item.vol)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground truncate max-w-[180px]">
                        {item.name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div ref={sentinelRef} className="h-4" aria-hidden />
          </div>
        </TabsContent>

        {/* ── Scan tab ───────────────────────────────────────────────────────── */}
        <TabsContent value="scan" className="flex flex-row flex-1 overflow-hidden mt-0">

          {/* Left sidebar: filters + scan controls */}
          <aside className="w-80 shrink-0 border-r border-border/40 flex flex-col overflow-y-auto">

            {/* Filters section */}
            <div className="px-5 pt-5 pb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Filters</p>
              <FilterPanel
                filters={filters}
                logic={filterLogic}
                activeChipId={activeChipId}
                onFiltersChange={setFilters}
                onLogicChange={setFilterLogic}
                onQuickApply={handleQuickApply}
              />
            </div>

            <div className="mx-5 border-t border-border/40" />

            {/* Scan controls section */}
            <div className="px-5 pt-4 pb-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Scan Settings</p>
              <ScanControls
                timeframe={timeframe}
                sectors={sectors}
                lookbackBars={lookbackBars}
                isScanning={scanMutation.isPending}
                onTimeframeChange={setTimeframe}
                onSectorsChange={setSectors}
                onLookbackChange={setLookbackBars}
                onScan={() => void handleScan()}
              />

              {scanMutation.isError && (
                <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 leading-relaxed">
                  Scan failed:{' '}
                  {scanMutation.error instanceof Error
                    ? scanMutation.error.message
                    : 'Unknown error'}
                </p>
              )}
            </div>
          </aside>

          {/* Right: results */}
          <main className="flex-1 overflow-auto">
            {scanMutation.isPending ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
                <Loader2 className="h-9 w-9 animate-spin" />
                <p className="text-sm font-medium">Scanning BIST...</p>
                <p className="text-xs opacity-70">This may take up to 60 seconds</p>
              </div>
            ) : scanResponse ? (
              <div className="px-8 py-5">
                <ResultsTable response={scanResponse} onExportCsv={() => exportCsv(scanResponse)} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
                <SlidersHorizontal className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">No scan results yet</p>
                <p className="text-xs opacity-70 text-center max-w-xs">
                  Set your filters on the left and click <span className="font-semibold text-foreground">Scan</span> to find matching stocks
                </p>
              </div>
            )}
          </main>

        </TabsContent>
      </Tabs>
    </div>
  )
}
