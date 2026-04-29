'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ExternalLink, Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { backtestsService } from '@/services/backtests.service'
import { cn } from '@/lib/utils'
import type { BacktestStatusResponse } from '@/types'

// Phase ordering used to render the terminal log even before the backend has
// emitted a status update for that phase yet.
const PHASE_ORDER = [
  'queued',
  'loading_market_data',
  'simulating_portfolio',
  'finalizing',
  'completed',
] as const

const PHASE_LABEL: Record<string, string> = {
  queued: 'Job queued',
  loading_market_data: 'Loading market data',
  simulating_portfolio: 'Simulating portfolio',
  finalizing: 'Finalizing results',
  completed: 'Completed',
  failed: 'Failed',
}

function curveToChartData(input: unknown): { i: number; equity: number }[] {
  if (!input) return []
  const arr = Array.isArray(input)
    ? input
    : Array.isArray((input as { points?: unknown }).points)
      ? (input as { points: unknown[] }).points
      : Array.isArray((input as { curve?: { points?: unknown } }).curve?.points)
        ? ((input as { curve: { points: unknown[] } }).curve.points)
        : []
  return arr
    .map((p, i) => {
      if (typeof p === 'number') return { i, equity: p }
      if (p && typeof p === 'object') {
        const obj = p as Record<string, unknown>
        const v = obj.equity ?? obj.balance ?? obj.value ?? obj.portfolio ?? obj.total
        const num = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(num) ? { i, equity: num } : null
      }
      return null
    })
    .filter((x): x is { i: number; equity: number } => x !== null)
}

function fmtCurrency(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // Backend returns ratios (e.g. 0.54 means 0.54%, -0.4 means -0.4%)
  // Values already in percentage range (|n| >= 1) are used as-is
  const pct = Math.abs(n) < 1 ? n * 100 : n
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

interface BacktestToolResultProps {
  runId: string
  initialResult?: Record<string, unknown> | null
}

export function BacktestToolResult({ runId, initialResult }: BacktestToolResultProps) {
  const statusQuery = useQuery<BacktestStatusResponse>({
    queryKey: ['ai-backtest-status', runId],
    queryFn: () => backtestsService.getStatus(runId),
    retry: 2,
    refetchInterval: (query) => {
      if (query.state.error) return false
      const data = query.state.data
      if (!data) return 1500
      const s = data.status
      if (s === 'completed' || s === 'failed' || s === 'cancelled') return false
      return 1500
    },
    refetchOnWindowFocus: false,
  })

  const status = statusQuery.data
  const statusError = statusQuery.error instanceof Error ? statusQuery.error.message : null
  const initialProgress =
    initialResult?.progress && typeof initialResult.progress === 'object'
      ? (initialResult.progress as Record<string, unknown>)
      : null
  const initialSummary =
    initialResult?.summary && typeof initialResult.summary === 'object'
      ? (initialResult.summary as Record<string, unknown>)
      : null
  const initialNestedResult =
    initialResult?.result && typeof initialResult.result === 'object'
      ? (initialResult.result as Record<string, unknown>)
      : null
  const hasInitialCompletedResult = Boolean(initialSummary || initialNestedResult)
  const isDone = status?.status === 'completed' || (!status && hasInitialCompletedResult)
  const isFailed = status?.status === 'failed' || status?.status === 'cancelled'
  const isUnavailable = !status && !hasInitialCompletedResult && Boolean(statusError)
  const phase =
    status?.progress?.phase ??
    (typeof initialProgress?.phase === 'string'
      ? initialProgress.phase
      : hasInitialCompletedResult
        ? 'completed'
        : 'queued')
  const progressPct =
    status?.progress?.progressPct ??
    (typeof initialProgress?.progressPct === 'number'
      ? initialProgress.progressPct
      : hasInitialCompletedResult
        ? 100
        : 0)

  // Build a terminal-style log from phase progression.
  const logLines = useMemo(() => {
    const currentIdx = Math.max(
      0,
      PHASE_ORDER.findIndex((p) => p === phase)
    )
    const lines: { text: string; state: 'done' | 'active' | 'pending' | 'error' }[] = []
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      const p = PHASE_ORDER[i]
      if (i < currentIdx || isDone) {
        lines.push({ text: `✓ ${PHASE_LABEL[p]}`, state: 'done' })
      } else if (i === currentIdx && !isDone) {
        const pct = Math.max(0, Math.min(100, Math.round(progressPct)))
        const sym = status?.progress?.currentSymbol
        const tail = sym ? ` — ${sym}` : ''
        lines.push({ text: `▸ ${PHASE_LABEL[p]} … ${pct}%${tail}`, state: 'active' })
      } else {
        lines.push({ text: `· ${PHASE_LABEL[p]}`, state: 'pending' })
      }
    }
    if (isUnavailable) {
      lines.push({
        text: `✗ Backtest durumu alinamadi: ${statusError ?? 'Bilinmeyen hata'}`,
        state: 'error',
      })
    }
    if (isFailed) {
      lines.push({
        text: `✗ ${status?.error ?? 'Backtest failed'}`,
        state: 'error',
      })
    }
    if (status?.progress?.message) {
      lines.push({ text: `  ${status.progress.message}`, state: 'active' })
    }
    return lines
  }, [isDone, isFailed, isUnavailable, phase, progressPct, status?.error, status?.progress?.currentSymbol, status?.progress?.message, statusError])

  const summary = status?.summary ?? (initialSummary as BacktestStatusResponse['summary'])
  const result = (status?.result ?? initialNestedResult ?? initialResult) as Record<string, unknown> | undefined
  const curveSource =
    (result?.portfolio_curve as unknown) ??
    (result?.portfolioCurve as unknown) ??
    (result?.curve as unknown)
  const chartData = useMemo(() => curveToChartData(curveSource), [curveSource])

  return (
    <div className="rounded-lg border border-border/60 bg-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-black/40">
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <Activity size={11} className="text-blue-400" />
          <span className="text-yellow-400 font-semibold">run_backtest</span>
          <span className="opacity-60">{runId.slice(0, 12)}…</span>
          {isDone ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 size={11} /> done
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1 text-red-400">
              <XCircle size={11} /> failed
            </span>
          ) : isUnavailable ? (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <XCircle size={11} /> unavailable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue-300">
              <Loader2 size={11} className="animate-spin" /> running
            </span>
          )}
        </div>
        <Link
          href={`/backtest?run=${runId}`}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Detayda Aç <ExternalLink size={10} />
        </Link>
      </div>

      {/* Terminal log */}
      <div className="px-3 py-2 font-mono text-[11px] leading-relaxed bg-black/50">
        {logLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre',
              line.state === 'done' && 'text-emerald-400',
              line.state === 'active' && 'text-blue-300',
              line.state === 'pending' && 'text-muted-foreground/50',
              line.state === 'error' && 'text-amber-300'
            )}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Metrics + chart on completion */}
      {isDone && summary && (
        <div className="border-t border-border/40 bg-black/20">
          <div className="grid grid-cols-4 gap-2 px-3 py-2">
            <MetricCard label="Trades" value={String(summary.totalTrades ?? '—')} />
            <MetricCard label="Win Rate" value={fmtPct(summary.winRate)} />
            <MetricCard
              label="Total P&L"
              value={fmtPct(summary.totalPnl)}
              accent={(summary.totalPnl ?? 0) >= 0 ? 'pos' : 'neg'}
            />
            <MetricCard
              label="Max DD"
              value={fmtPct(summary.maxDrawdown)}
              accent="neg"
            />
          </div>
          {chartData.length > 1 && (
            <div className="h-24 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`eq-${runId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0,0,0,0.85)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    labelFormatter={(l) => `Bar ${l}`}
                    formatter={(v: number) => [fmtCurrency(v), 'Equity']}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#3b82f6"
                    fill={`url(#eq-${runId})`}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'pos' | 'neg'
}) {
  return (
    <div className="rounded-md border border-border/40 bg-black/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-xs font-mono font-semibold tabular-nums',
          accent === 'pos' && 'text-emerald-400',
          accent === 'neg' && 'text-red-400',
          !accent && 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  )
}
