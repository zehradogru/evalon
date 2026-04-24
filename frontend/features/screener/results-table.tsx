'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, ChevronsUpDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanResultRow, ScanResponse } from '@/types/screener'

type SortKey = keyof Pick<
  ScanResultRow,
  'ticker' | 'close' | 'change_pct' | 'volume' | 'vol_ratio'
>

function formatVol(v: number | null) {
  if (v === null || v === undefined) return '-'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

function fmt(n: number | null | undefined, d = 2) {
  return n === null || n === undefined ? '-' : n.toFixed(d)
}

function SortHead({
  label,
  field,
  sortKey,
  dir,
  onSort,
  align = 'right',
}: {
  label: string
  field: SortKey
  sortKey: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sortKey === field
  return (
    <TableHead
      className={cn(
        'text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:bg-muted/40',
        align === 'right' ? 'text-right' : 'text-left',
        active && 'text-foreground'
      )}
      onClick={() => onSort(field)}
    >
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  )
}

interface ResultsTableProps {
  response: ScanResponse | null
  onExportCsv?: () => void
}

export function ResultsTable({ response, onExportCsv }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('change_pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  if (!response) return null

  const sorted = [...response.rows].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr')
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          <span className="font-semibold text-foreground">{response.matched}</span> results /{' '}
          {response.total_scanned} scanned · {response.elapsed_ms}ms
          {response.errors.length > 0 && (
            <span className="ml-2 text-destructive">{response.errors.length} errors</span>
          )}
        </span>
        {onExportCsv && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onExportCsv}>
            <Download size={12} />
            CSV
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <SortHead label="Symbol" field="ticker" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">Sector</TableHead>
              <SortHead label="Price" field="close" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHead label="Chg%" field="change_pct" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHead label="Volume" field="volume" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHead label="Vol/Avg" field="vol_ratio" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">Filters</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const chg = row.change_pct ?? 0
              return (
                <TableRow key={row.ticker} className="hover:bg-accent/40 cursor-pointer">
                  <TableCell className="font-bold text-sm">
                    <Link
                      href={`/dashboard/charts/${row.ticker}`}
                      className="hover:text-primary transition-colors"
                    >
                      {row.ticker}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.sector ?? '-'}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmt(row.close)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right text-sm font-medium tabular-nums',
                      chg >= 0 ? 'text-chart-2' : 'text-destructive'
                    )}
                  >
                    {chg > 0 ? '+' : ''}{fmt(chg)}%
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatVol(row.volume)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {fmt(row.vol_ratio, 1)}×
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.matched_filters.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 border-primary/40 text-primary"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
