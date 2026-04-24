'use client'

import { useMemo, useState } from 'react'
import {
  BarChart2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarketDataStatusChip } from '@/components/market-data-status-chip'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import {
  useAddWatchlistTicker,
  useRemoveWatchlistTicker,
  useUserWatchlist,
} from '@/hooks/use-user-watchlist'
import { cn } from '@/lib/utils'
import { useDashboardWatchlist, DashboardTicker } from '@/hooks/use-dashboard-data'

interface LiveWatchlistProps {
  onSelectTicker?: (ticker: string, name: string) => void
  activeTicker?: string
}

export function LiveWatchlist({ onSelectTicker, activeTicker }: LiveWatchlistProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const { data: rawWatchlistData, marketStatus, retryNow } = useDashboardWatchlist()
  const { data: userWatchlist } = useUserWatchlist()
  const addTickerMutation = useAddWatchlistTicker()
  const removeTickerMutation = useRemoveWatchlistTicker()
  const items = useMemo<DashboardTicker[]>(
    () => rawWatchlistData || [],
    [rawWatchlistData]
  )
  const watchlistTickers = useMemo(
    () => userWatchlist?.tickers ?? [],
    [userWatchlist?.tickers]
  )
  const normalizedQuery = searchQuery.trim().toUpperCase()
  const isMutating =
    addTickerMutation.isPending || removeTickerMutation.isPending

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items

    return items.filter((item) => {
      const ticker = item.ticker.toUpperCase()
      const name = item.name.toUpperCase()
      return (
        ticker.includes(normalizedQuery) ||
        name.includes(normalizedQuery)
      )
    })
  }, [items, normalizedQuery])

  const suggestions = useMemo(() => {
    if (!normalizedQuery) return []

    return BIST_AVAILABLE
      .filter((ticker) => !watchlistTickers.includes(ticker))
      .filter((ticker) => {
        const name = (TICKER_NAMES[ticker] || ticker).toUpperCase()
        return (
          ticker.includes(normalizedQuery) ||
          name.includes(normalizedQuery)
        )
      })
      .slice(0, 6)
      .map((ticker) => ({
        ticker,
        name: TICKER_NAMES[ticker] || ticker,
      }))
  }, [normalizedQuery, watchlistTickers])

  const handleAddTicker = async (ticker: string) => {
    setFeedback(null)
    try {
      await addTickerMutation.mutateAsync(ticker)
      setSearchQuery('')
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Ticker eklenemedi.'
      )
    }
  }

  const handleRemoveTicker = async (ticker: string) => {
    setFeedback(null)
    try {
      await removeTickerMutation.mutateAsync(ticker)
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Ticker silinemedi.'
      )
    }
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-[#ff9800]" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Watchlist</h3>
            <p className="text-[10px] text-muted-foreground">
              {marketStatus.isInitialLoading ? 'Loading...' : `${items.length} tickers`}
            </p>
          </div>
          <MarketDataStatusChip status={marketStatus} className="ml-auto" />
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Watchlist ara veya ticker ekle"
            className="h-8 border-border bg-background pl-8 pr-8 text-xs"
            disabled={isMutating}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setFeedback(null)
              }}
              className="absolute right-2.5 top-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {normalizedQuery && suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              {suggestions.map((item) => (
                <button
                  key={item.ticker}
                  type="button"
                  onClick={() => void handleAddTicker(item.ticker)}
                  disabled={isMutating}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/30 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/50 disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">
                      {item.ticker}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {item.name}
                    </div>
                  </div>
                  <Plus className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {feedback ? (
          <p className="mt-2 text-[10px] text-destructive">{feedback}</p>
        ) : null}
      </div>

      {/* Pinned Indices */}
      <div className="border-b border-border/40">
        <div className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Endeksler
        </div>
        {([{ ticker: 'XU100', name: 'BIST 100' }, { ticker: 'XU030', name: 'BIST 30' }] as const).map((idx) => {
          const isActive = idx.ticker === activeTicker
          return (
            <div
              key={idx.ticker}
              onClick={() => onSelectTicker?.(idx.ticker, idx.name)}
              className={cn(
                'flex items-center gap-2.5 border-b border-border/20 px-4 py-2.5 cursor-pointer transition-all duration-150',
                isActive
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50'
              )}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
                <BarChart2 className="h-3 w-3 text-primary" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">{idx.name}</div>
                <div className="text-[10px] text-muted-foreground">{idx.ticker}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {marketStatus.isInitialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : marketStatus.source === 'error' && !marketStatus.hasUsableData ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <span className="text-xs text-muted-foreground">
              {marketStatus.errorMessage || 'Watchlist quotes are temporarily unavailable.'}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retryNow()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {marketStatus.isWarming ? 'Market data is starting...' : 'No data available'}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <span className="text-xs text-muted-foreground">
              Watchlist içinde eslesen ticker bulunamadi.
            </span>
            {normalizedQuery && suggestions.length > 0 ? (
              <span className="text-[10px] text-muted-foreground">
                Asagidaki sonuclardan ekleme yapabilirsiniz.
              </span>
            ) : null}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPositive = item.changePercent >= 0
            const isActive = item.ticker === activeTicker

            return (
              <div
                key={item.ticker}
                onClick={() => onSelectTicker?.(item.ticker, item.name)}
                className={cn(
                  "group flex items-center justify-between gap-2 border-b border-border/20 px-4 py-3 cursor-pointer transition-all duration-150",
                  isActive
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                      isPositive ? "bg-[#089981]/10" : "bg-[#f23645]/10"
                    )}>
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 text-[#089981]" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-[#f23645]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{item.ticker}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{item.name}</div>
                  </div>
                </div>

                <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-medium text-foreground">
                      {item.price.toFixed(2)}
                    </div>
                    <div className={cn(
                      "text-[10px] font-semibold",
                      isPositive ? "text-[#089981]" : "text-[#f23645]"
                    )}>
                      {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleRemoveTicker(item.ticker)
                    }}
                    disabled={isMutating}
                    title="Watchlistten sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
