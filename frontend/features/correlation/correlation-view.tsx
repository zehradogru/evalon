'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select-native'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchMultipleTickers } from '@/services/price.service'
import { BIST_POPULAR, TICKER_NAMES } from '@/config/markets'
import { cn } from '@/lib/utils'
import type { Timeframe } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIODS = [
  { label: '1 Month',  days: 30  },
  { label: '3 Months', days: 90  },
  { label: '6 Months', days: 180 },
  { label: '1 Year',   days: 365 },
]

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1d', label: 'Daily'   },
  { value: '4h', label: '4-Hour'  },
  { value: '1h', label: 'Hourly'  },
  { value: '1w', label: 'Weekly'  },
]

const DEFAULT_TICKERS = BIST_POPULAR.slice(0, 12)

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Extract close prices from PriceBar array */
function getCloses(candles: { c: number }[]): number[] {
  return candles.map((c) => c.c)
}

/** Log returns: ln(p_t / p_{t-1}) */
function logReturns(prices: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]))
    }
  }
  return returns
}

/** Pearson correlation between two equal-length arrays */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 3) return NaN
  const sliceA = a.slice(a.length - n)
  const sliceB = b.slice(b.length - n)
  const meanA = sliceA.reduce((s, x) => s + x, 0) / n
  const meanB = sliceB.reduce((s, x) => s + x, 0) / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = sliceA[i] - meanA
    const db = sliceB[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const denom = Math.sqrt(denA * denB)
  return denom === 0 ? NaN : num / denom
}

/** Color coding: -1 (red) → 0 (neutral) → +1 (green) */
function corrColor(value: number): string {
  if (isNaN(value)) return 'bg-muted/30 text-muted-foreground'
  const v = Math.max(-1, Math.min(1, value))
  if (v >= 0.8) return 'bg-emerald-500/30 text-emerald-300'
  if (v >= 0.5) return 'bg-emerald-500/15 text-emerald-400'
  if (v >= 0.2) return 'bg-emerald-500/8 text-emerald-500'
  if (v > -0.2) return 'bg-muted/20 text-muted-foreground'
  if (v > -0.5) return 'bg-red-500/8 text-red-500'
  if (v > -0.8) return 'bg-red-500/15 text-red-400'
  return 'bg-red-500/30 text-red-300'
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CorrelationView() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(DEFAULT_TICKERS)
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')
  const [periodDays, setPeriodDays] = useState(90)

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) =>
      prev.includes(ticker)
        ? prev.length > 2
          ? prev.filter((t) => t !== ticker)
          : prev
        : [...prev, ticker],
    )
  }

  const limit = Math.ceil(periodDays * (timeframe === '1d' ? 1 : timeframe === '1w' ? 0.2 : timeframe === '4h' ? 6 : 24))

  const priceQuery = useQuery({
    queryKey: ['correlation-prices', selectedTickers, timeframe, limit],
    queryFn: () => fetchMultipleTickers(selectedTickers, timeframe, limit),
    staleTime: 60_000,
  })

  /** Map: ticker → log returns array */
  const returnsMap = useMemo<Map<string, number[]>>(() => {
    const map = new Map<string, number[]>()
    if (!priceQuery.data) return map
    for (const ticker of selectedTickers) {
      const candles = priceQuery.data.get(ticker)
      if (Array.isArray(candles) && candles.length > 1) {
        map.set(ticker, logReturns(getCloses(candles)))
      }
    }
    return map
  }, [priceQuery.data, selectedTickers])

  /** Full correlation matrix */
  const matrix = useMemo<number[][]>(() => {
    return selectedTickers.map((rowT) =>
      selectedTickers.map((colT) => {
        if (rowT === colT) return 1
        const a = returnsMap.get(rowT)
        const b = returnsMap.get(colT)
        if (!a || !b) return NaN
        return pearson(a, b)
      }),
    )
  }, [returnsMap, selectedTickers])

  /** Top / bottom pairs */
  const sortedPairs = useMemo(() => {
    const pairs: { a: string; b: string; value: number }[] = []
    for (let i = 0; i < selectedTickers.length; i++) {
      for (let j = i + 1; j < selectedTickers.length; j++) {
        const value = matrix[i]?.[j]
        if (!isNaN(value)) {
          pairs.push({ a: selectedTickers[i], b: selectedTickers[j], value })
        }
      }
    }
    return pairs.sort((x, y) => Math.abs(y.value) - Math.abs(x.value))
  }, [matrix, selectedTickers])

  const isLoading = priceQuery.isFetching
  const hasData = returnsMap.size > 0

  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Correlation Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pearson correlation of log-returns across selected BIST stocks.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => priceQuery.refetch()}
          disabled={isLoading}
          className="gap-2 shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Settings
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <Select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="w-36"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.value} value={tf.value}>
                  {tf.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Period</span>
            <Select
              value={String(periodDays)}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="w-36"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {/* Ticker picker */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Stocks <span className="text-foreground font-medium">({selectedTickers.length} selected)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {BIST_POPULAR.map((ticker) => {
              const checked = selectedTickers.includes(ticker)
              return (
                <button
                  key={ticker}
                  onClick={() => toggleTicker(ticker)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    checked
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/40 bg-background/40 text-muted-foreground hover:border-border/70 hover:text-foreground',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTicker(ticker)}
                    className="h-3 w-3 pointer-events-none"
                  />
                  {ticker}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">At least 2 stocks must be selected.</p>
        </div>
      </div>

      {/* Error */}
      {priceQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Price data failed to load: {String(priceQuery.error)}</span>
        </div>
      )}

      {/* Heatmap matrix */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Heatmap
        </p>
        {isLoading && !hasData ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading price data...
          </div>
        ) : !hasData ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="w-20 p-1" />
                  {selectedTickers.map((t) => (
                    <th
                      key={t}
                      className="p-1 font-medium text-muted-foreground whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 72 }}
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedTickers.map((rowT, ri) => (
                  <tr key={rowT}>
                    <td className="p-1 pr-2 text-right font-medium text-muted-foreground whitespace-nowrap text-xs">
                      {rowT}
                    </td>
                    {selectedTickers.map((colT, ci) => {
                      const val = matrix[ri]?.[ci]
                      const isDiag = rowT === colT
                      return (
                        <td
                          key={colT}
                          className={cn(
                            'w-12 h-10 rounded border border-border/20 transition-colors cursor-default',
                            isDiag ? 'bg-primary/10 text-primary font-bold' : corrColor(val),
                          )}
                          title={`${rowT} / ${colT}: ${isNaN(val) ? 'N/A' : val.toFixed(3)}`}
                        >
                          {isNaN(val) ? '—' : isDiag ? '1.00' : val.toFixed(2)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-5 rounded bg-red-500/30" />
            Strong negative
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-5 rounded bg-muted/20" />
            Weak / None
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-5 rounded bg-emerald-500/30" />
            Strong positive
          </div>
        </div>
      </div>

      {/* Sorted pairs table */}
      {sortedPairs.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Strongest Correlations
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="p-3 text-left text-xs text-muted-foreground font-medium">Pair</th>
                <th className="p-3 text-right text-xs text-muted-foreground font-medium">Correlation</th>
                <th className="p-3 text-left text-xs text-muted-foreground font-medium hidden md:table-cell">Strength</th>
                <th className="p-3 text-left text-xs text-muted-foreground font-medium hidden lg:table-cell">Visual</th>
              </tr>
            </thead>
            <tbody>
              {sortedPairs.slice(0, 20).map(({ a, b, value }) => {
                const absV = Math.abs(value)
                const strength =
                  absV >= 0.8 ? 'Very Strong' : absV >= 0.6 ? 'Strong' : absV >= 0.4 ? 'Moderate' : 'Weak'
                const isPos = value >= 0
                return (
                  <tr key={`${a}-${b}`} className="border-b border-border/30 hover:bg-muted/5">
                    <td className="p-3 font-medium">
                      <span className="text-foreground">{a}</span>
                      <span className="text-muted-foreground mx-2 text-xs">vs</span>
                      <span className="text-foreground">{b}</span>
                    </td>
                    <td
                      className={cn(
                        'p-3 text-right font-bold tabular-nums',
                        isPos ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {isPos ? '+' : ''}
                      {value.toFixed(3)}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs',
                          absV >= 0.6
                            ? isPos
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                            : 'bg-muted/30 text-muted-foreground',
                        )}
                      >
                        {strength} {isPos ? 'Positive' : 'Negative'}
                      </span>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            'absolute h-full rounded-full',
                            isPos ? 'bg-emerald-500' : 'bg-red-500',
                          )}
                          style={{
                            width: `${absV * 50}%`,
                            left: isPos ? '50%' : `${50 - absV * 50}%`,
                          }}
                        />
                        <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}