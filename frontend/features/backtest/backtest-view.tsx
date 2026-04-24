'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers3,
  Loader2,
  Play,
  Rocket,
  RotateCcw,
  Settings2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BACKTEST_STAGE_KEYS,
  type BacktestStageKey,
  applyPresetToBlueprint,
  createEmptyBlueprint,
} from '@/lib/backtest-blueprint'
import { formatTimeframeLabel } from '@/lib/evalon'
import { readActiveBlueprint, saveActiveBlueprint } from '@/lib/workspace-storage'
import { backtestsService } from '@/services/backtests.service'
import { cn } from '@/lib/utils'
import type {
  BacktestBlueprint,
  BacktestCatalogRule,
  BacktestRunResponse,
  BacktestSummary,
  PortfolioCurvePoint,
  Timeframe,
} from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

const STAGE_META: Record<BacktestStageKey, { label: string; icon: React.ReactNode; color: string }> = {
  trend:   { label: 'Trend Filter',    icon: <Layers3   className="h-3.5 w-3.5" />, color: 'text-blue-400    border-blue-400/30    bg-blue-400/5'    },
  setup:   { label: 'Setup',           icon: <Settings2 className="h-3.5 w-3.5" />, color: 'text-amber-400   border-amber-400/30   bg-amber-400/5'   },
  trigger: { label: 'Entry Trigger',   icon: <Zap       className="h-3.5 w-3.5" />, color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function curveToChartData(points?: PortfolioCurvePoint[]) {
  if (!Array.isArray(points)) return []
  return points
    .map((point, index) => {
      if (typeof point === 'number') return { x: index + 1, value: point }
      const row = point as Record<string, unknown>
      const value = ['equity', 'value', 'portfolio', 'balance', 'close']
        .map((k) => row[k])
        .find((v) => typeof v === 'number')
      const x = row.time ?? row.t ?? row.timestamp ?? index + 1
      return {
        x: typeof x === 'number' ? x : String(x).slice(0, 10),
        value: typeof value === 'number' ? value : NaN,
      }
    })
    .filter((item) => Number.isFinite(item.value))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={cn('text-xl font-bold', color ?? 'text-foreground')}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function SummaryCards({ summary }: { summary?: BacktestSummary | null }) {
  if (!summary) return null
  const pnlColor = summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
  const winColor = summary.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Trades" value={String(summary.totalTrades)} />
      <StatCard label="Win Rate" value={`${summary.winRate.toFixed(1)}%`} color={winColor} />
      <StatCard
        label="Total P&L"
        value={`${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)}%`}
        color={pnlColor}
      />
      <StatCard label="Max Drawdown" value={`${summary.maxDrawdown.toFixed(2)}%`} color="text-red-400" />
    </div>
  )
}

function RuleChip({
  rule,
  isSelected,
  isRequired,
  onToggle,
  onToggleRequired,
}: {
  rule: BacktestCatalogRule
  isSelected: boolean
  isRequired: boolean
  onToggle: () => void
  onToggleRequired: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isSelected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/40 bg-background/40 hover:border-border/70 hover:bg-muted/20',
      )}
    >
      <div className="flex items-start gap-2 cursor-pointer" onClick={onToggle}>
        <Checkbox checked={isSelected} onCheckedChange={onToggle} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{rule.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.summary}</div>
        </div>
      </div>
      {isSelected && (
        <div className="mt-2 ml-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={isRequired}
            onCheckedChange={onToggleRequired}
            className="h-3 w-3"
          />
          <span>Required rule</span>
        </div>
      )}
    </div>
  )
}

function StagePanel({
  stageKey,
  blueprint,
  groupedRules,
  onUpdateBlueprint,
}: {
  stageKey: BacktestStageKey
  blueprint: BacktestBlueprint
  groupedRules: Map<BacktestStageKey, BacktestCatalogRule[]>
  onUpdateBlueprint: (updater: (b: BacktestBlueprint) => BacktestBlueprint) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const meta = STAGE_META[stageKey]
  const stage = blueprint.stages[stageKey]
  const selectedRuleIds = stage.rules.map((r) => r.id)
  const stageRules = groupedRules.get(stageKey) ?? []

  const updateStage = (patch: Partial<typeof stage>) =>
    onUpdateBlueprint((b) => ({
      ...b,
      stages: { ...b.stages, [stageKey]: { ...b.stages[stageKey], ...patch } },
    }))

  const toggleRule = (ruleId: string) =>
    onUpdateBlueprint((b) => {
      const next = structuredClone(b)
      const rules = next.stages[stageKey].rules
      const idx = rules.findIndex((r) => r.id === ruleId)
      if (idx >= 0) rules.splice(idx, 1)
      else rules.push({ id: ruleId, required: true, params: {} })
      return next
    })

  const toggleRequired = (ruleId: string) =>
    onUpdateBlueprint((b) => {
      const next = structuredClone(b)
      const rule = next.stages[stageKey].rules.find((r) => r.id === ruleId)
      if (rule) rule.required = !rule.required
      return next
    })

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', meta.color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta.icon}
          <span className="text-sm font-semibold uppercase tracking-wide">{meta.label}</span>
          {selectedRuleIds.length > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
              {selectedRuleIds.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Timeframe</span>
              <Select
                value={String(stage.timeframe)}
                onChange={(e) => updateStage({ timeframe: e.target.value as Timeframe })}
                className="h-8 text-xs"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {formatTimeframeLabel(tf)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Min. optional</span>
              <Input
                type="number"
                min="0"
                value={stage.minOptionalMatches}
                onChange={(e) => updateStage({ minOptionalMatches: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={stage.required}
              onCheckedChange={(c) => updateStage({ required: Boolean(c) })}
              className="h-3.5 w-3.5"
            />
            <span>Stage required</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {stageRules.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">Loading rules...</div>
            ) : (
              stageRules.map((rule) => (
                <RuleChip
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRuleIds.includes(rule.id)}
                  isRequired={stage.rules.find((r) => r.id === rule.id)?.required ?? true}
                  onToggle={() => toggleRule(rule.id)}
                  onToggleRequired={() => toggleRequired(rule.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BacktestView() {
  const [blueprint, setBp] = useState<BacktestBlueprint>(
    () => readActiveBlueprint() ?? createEmptyBlueprint(),
  )
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<BacktestRunResponse | null>(null)
  const [eventsPage, setEventsPage] = useState(1)

  // effective run ID — async runs use activeRunId, sync runs use syncResult.runId
  const queryRunId = activeRunId ?? syncResult?.runId ?? null

  useEffect(() => {
    saveActiveBlueprint(blueprint)
  }, [blueprint])

  // ---- queries ----
  const rulesQuery = useQuery({
    queryKey: ['backtest-rule-catalog'],
    queryFn: () => backtestsService.getRuleCatalog(),
    staleTime: 300_000,
  })
  const presetsQuery = useQuery({
    queryKey: ['backtest-preset-catalog'],
    queryFn: () => backtestsService.getPresetCatalog(),
    staleTime: 300_000,
  })

  // Status polling: only for async runs
  const statusQuery = useQuery({
    queryKey: ['backtest-status', activeRunId],
    queryFn: () => backtestsService.getStatus(activeRunId!),
    enabled: Boolean(activeRunId),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'completed' || s === 'failed' ? false : 2000
    },
  })

  // Events: works for both sync (syncResult.runId) and async (activeRunId)
  const eventsQuery = useQuery({
    queryKey: ['backtest-events', queryRunId, eventsPage],
    queryFn: () => backtestsService.getEvents(queryRunId!, eventsPage, 25),
    enabled: Boolean(queryRunId),
  })

  // Curve: works for both sync and async
  const curveQuery = useQuery({
    queryKey: ['backtest-curve', queryRunId],
    queryFn: () => backtestsService.getPortfolioCurve(queryRunId!),
    enabled: Boolean(queryRunId),
    refetchInterval: (q) => {
      // only keep polling for async runs
      if (!activeRunId) return false
      const s = q.state.data?.status
      return s === 'completed' || s === 'failed' ? false : 2000
    },
  })

  // ---- mutations ----
  const runSyncMutation = useMutation({
    mutationFn: (body: BacktestBlueprint) => backtestsService.runSync(body),
    onSuccess: (result) => {
      setSyncResult(result)
      setActiveRunId(null)
      setEventsPage(1)
    },
  })

  const startAsyncMutation = useMutation({
    mutationFn: (body: BacktestBlueprint) => backtestsService.startAsync(body),
    onSuccess: (result) => {
      setSyncResult(null)
      setActiveRunId(result.runId)
      setEventsPage(1)
    },
  })

  // ---- derived ----
  const ruleCatalog = useMemo(
    () => rulesQuery.data?.rules ?? [],
    [rulesQuery.data?.rules],
  )

  const groupedRules = useMemo(() => {
    const map = new Map<BacktestStageKey, BacktestCatalogRule[]>()
    BACKTEST_STAGE_KEYS.forEach((s) => map.set(s, []))
    ruleCatalog.forEach((rule) =>
      rule.stages.forEach((s) => {
        if (BACKTEST_STAGE_KEYS.includes(s as BacktestStageKey))
          map.get(s as BacktestStageKey)!.push(rule)
      }),
    )
    return map
  }, [ruleCatalog])

  const updateBp = (updater: (b: BacktestBlueprint) => BacktestBlueprint) =>
    setBp((b) => updater(b))

  const isBusy = runSyncMutation.isPending || startAsyncMutation.isPending

  const currentSummary =
    statusQuery.data?.summary ?? curveQuery.data?.summary ?? syncResult?.summary ?? null

  const curveData = curveToChartData(curveQuery.data?.curve)

  const progress = statusQuery.data?.progress

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = presetsQuery.data?.presets.find((p) => p.id === presetId)
    if (!preset || ruleCatalog.length === 0) return
    setBp(applyPresetToBlueprint(preset, ruleCatalog, blueprint.symbol ?? 'THYAO'))
    setSyncResult(null)
    setActiveRunId(null)
  }

  const runError =
    runSyncMutation.error ?? startAsyncMutation.error ?? statusQuery.error ?? null

  return (
    <div className="w-full flex flex-col gap-4 p-5">

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 1 — Header + Run buttons                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backtest</h1>
          <p className="text-sm text-muted-foreground">
            Build a strategy from the rule &amp; preset catalog and monitor results in real time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => runSyncMutation.mutate(blueprint)} disabled={isBusy} className="gap-2">
            {runSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Sync
          </Button>
          <Button variant="secondary" onClick={() => startAsyncMutation.mutate(blueprint)} disabled={isBusy} className="gap-2">
            {startAsyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Async
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setSelectedPresetId(''); setActiveRunId(null); setSyncResult(null); setEventsPage(1); setBp(createEmptyBlueprint()) }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 2 — Config bar (horizontal, full-width)                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        {/* Top row: Blueprint params */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Preset</span>
            <Select value={selectedPresetId} onChange={(e) => applyPreset(e.target.value)} className="h-8 text-xs">
              <option value="">Manual</option>
              {(presetsQuery.data?.presets ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Symbol</span>
            <Input
              value={blueprint.symbol ?? ''}
              onChange={(e) => updateBp((b) => ({ ...b, symbol: e.target.value.toUpperCase(), symbols: [e.target.value.toUpperCase()] }))}
              placeholder="THYAO"
              className="h-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Direction</span>
            <Select value={blueprint.direction} onChange={(e) => updateBp((b) => ({ ...b, direction: e.target.value }))} className="h-8 text-xs">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Window (days)</span>
            <Input
              type="number"
              value={blueprint.testWindowDays}
              onChange={(e) => updateBp((b) => ({ ...b, testWindowDays: Number(e.target.value) }))}
              className="h-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Stage Threshold</span>
            <Input
              type="number" min="1" max="3"
              value={blueprint.stageThreshold}
              onChange={(e) => updateBp((b) => ({ ...b, stageThreshold: Number(e.target.value) }))}
              className="h-8 text-xs"
            />
          </label>
        </div>

        {/* Divider */}
        <div className="border-t border-border/30" />

        {/* Bottom row: Risk / Portfolio params */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Stop %</span>
            <Input type="number" step="0.1" value={blueprint.risk.stopPct}
              onChange={(e) => updateBp((b) => ({ ...b, risk: { ...b.risk, stopPct: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Target %</span>
            <Input type="number" step="0.1" value={blueprint.risk.targetPct}
              onChange={(e) => updateBp((b) => ({ ...b, risk: { ...b.risk, targetPct: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Max Bar</span>
            <Input type="number" value={blueprint.risk.maxBars}
              onChange={(e) => updateBp((b) => ({ ...b, risk: { ...b.risk, maxBars: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Capital</span>
            <Input type="number" value={blueprint.portfolio?.initialCapital ?? 0}
              onChange={(e) => updateBp((b) => ({ ...b, portfolio: { ...b.portfolio, initialCapital: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Position Size</span>
            <Input type="number" value={blueprint.portfolio?.positionSize ?? 0}
              onChange={(e) => updateBp((b) => ({ ...b, portfolio: { ...b.portfolio, positionSize: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Commission %</span>
            <Input type="number" step="0.01" value={blueprint.portfolio?.commissionPct ?? 0}
              onChange={(e) => updateBp((b) => ({ ...b, portfolio: { ...b.portfolio, commissionPct: Number(e.target.value) } }))}
              className="h-8 text-xs" />
          </label>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 3 — Stage panels (3 columns side by side)                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="w-full grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {BACKTEST_STAGE_KEYS.map((key) => (
          <StagePanel
            key={key}
            stageKey={key}
            blueprint={blueprint}
            groupedRules={groupedRules}
            onUpdateBlueprint={updateBp}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 4 — Results (full width)                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Error banner */}
      {runError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{String(runError)}</span>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progress.phase}</span>
            <span className="font-medium">{progress.progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress.progressPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progress.message}</p>
        </div>
      )}

      {/* Summary stat cards */}
      <SummaryCards summary={currentSummary} />

      {/* Idle state */}
      {!activeRunId && !syncResult && !runError && !progress && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 min-h-[220px] gap-4 p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Ready to run</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Configure your strategy above, then click <strong>Sync</strong> for instant results or <strong>Async</strong> to stream results in real time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => runSyncMutation.mutate(blueprint)} disabled={isBusy} className="gap-2">
              <Play className="h-3.5 w-3.5" /> Sync
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startAsyncMutation.mutate(blueprint)} disabled={isBusy} className="gap-2">
              <Rocket className="h-3.5 w-3.5" /> Async
            </Button>
          </div>
        </div>
      )}

      {/* Tabs: Equity Curve + Trades */}
      {(activeRunId || syncResult) && (
        <Tabs defaultValue="curve">
          <TabsList className="mb-3">
            <TabsTrigger value="curve">Equity Curve</TabsTrigger>
            <TabsTrigger value="events">Trades</TabsTrigger>
          </TabsList>

          <TabsContent value="curve">
            <div className="rounded-xl border border-border/50 bg-card p-5">
              {curveQuery.isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : curveData.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <p className="text-sm">Start an async run to see the equity curve here.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={curveData}>
                    <defs>
                      <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="x" minTickGap={40} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#curveGrad)" strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="events">
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {eventsQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : !eventsQuery.data?.events?.length ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No trades yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventsQuery.data.events.map((ev) => (
                          <TableRow key={ev.id}>
                            <TableCell className="text-xs">{ev.type}</TableCell>
                            <TableCell className="font-medium">{ev.symbol}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{ev.reason}</TableCell>
                            <TableCell className="text-right">{ev.price.toFixed(2)}</TableCell>
                            <TableCell className={cn('text-right font-medium', ev.pnl == null ? 'text-muted-foreground' : Number(ev.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {ev.pnl == null ? '-' : Number(ev.pnl).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                    <Button variant="outline" size="sm" onClick={() => setEventsPage((p) => Math.max(1, p - 1))} disabled={eventsPage <= 1}>
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {eventsQuery.data.page} / {eventsQuery.data.totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setEventsPage((p) => Math.min(eventsQuery.data!.totalPages, p + 1))} disabled={eventsPage >= (eventsQuery.data?.totalPages ?? 1)}>
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}