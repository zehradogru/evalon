'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Loader2, Play, Rocket, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BACKTEST_STAGE_KEYS, type BacktestStageKey, applyPresetToBlueprint, createEmptyBlueprint } from '@/lib/backtest-blueprint'
import { formatTimeframeLabel } from '@/lib/evalon'
import { readActiveBlueprint, saveActiveBlueprint } from '@/lib/workspace-storage'
import { backtestsService } from '@/services/backtests.service'
import type { BacktestBlueprint, BacktestRunResponse, BacktestSummary, PortfolioCurvePoint, Timeframe } from '@/types'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

function curveToChartData(points?: PortfolioCurvePoint[]) {
  if (!Array.isArray(points)) return []
  return points.map((point, index) => {
    if (typeof point === 'number') return { x: index + 1, value: point }
    const row = point as Record<string, unknown>
    const value = ['equity', 'value', 'portfolio', 'balance', 'close'].map((key) => row[key]).find((candidate) => typeof candidate === 'number')
    const x = row.time ?? row.t ?? row.timestamp ?? index + 1
    return { x: typeof x === 'number' ? x : String(x).slice(0, 19), value: typeof value === 'number' ? value : NaN }
  }).filter((item) => Number.isFinite(item.value))
}

function SummaryCards({ summary }: { summary?: BacktestSummary | null }) {
  if (!summary) return <div className="text-sm text-muted-foreground">Sonuc olustugunda performans ozeti burada gorunecek.</div>
  return <div className="grid gap-3 md:grid-cols-4">
    <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Trades</div><div className="mt-1 text-lg font-semibold">{summary.totalTrades}</div></div>
    <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Win Rate</div><div className="mt-1 text-lg font-semibold">{summary.winRate.toFixed(2)}%</div></div>
    <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Total PnL</div><div className="mt-1 text-lg font-semibold">{summary.totalPnl.toFixed(2)}%</div></div>
    <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Max DD</div><div className="mt-1 text-lg font-semibold">{summary.maxDrawdown.toFixed(2)}%</div></div>
  </div>
}

export function BacktestView() {
  const [blueprint, setBlueprint] = useState<BacktestBlueprint>(() => readActiveBlueprint() || createEmptyBlueprint())
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<BacktestRunResponse | null>(null)
  const [eventsPage, setEventsPage] = useState(1)

  useEffect(() => {
    saveActiveBlueprint(blueprint)
  }, [blueprint])

  const rulesQuery = useQuery({ queryKey: ['backtest-rule-catalog'], queryFn: () => backtestsService.getRuleCatalog(), staleTime: 300000 })
  const presetsQuery = useQuery({ queryKey: ['backtest-preset-catalog'], queryFn: () => backtestsService.getPresetCatalog(), staleTime: 300000 })
  const runSyncMutation = useMutation({
    mutationFn: (body: BacktestBlueprint) => backtestsService.runSync(body),
    onSuccess: (result) => { setSyncResult(result); setActiveRunId(null) },
  })
  const startAsyncMutation = useMutation({
    mutationFn: (body: BacktestBlueprint) => backtestsService.startAsync(body),
    onSuccess: (result) => { setSyncResult(null); setActiveRunId(result.runId); setEventsPage(1) },
  })

  const statusQuery = useQuery({
    queryKey: ['backtest-status', activeRunId],
    queryFn: () => backtestsService.getStatus(activeRunId!),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
  })
  const eventsQuery = useQuery({ queryKey: ['backtest-events', activeRunId, eventsPage], queryFn: () => backtestsService.getEvents(activeRunId!, eventsPage, 25), enabled: Boolean(activeRunId) })
  const curveQuery = useQuery({
    queryKey: ['backtest-curve', activeRunId],
    queryFn: () => backtestsService.getPortfolioCurve(activeRunId!),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
  })

  const groupedRules = useMemo(() => {
    const map = new Map<BacktestStageKey, typeof rulesQuery.data.rules>()
    BACKTEST_STAGE_KEYS.forEach((stage) => map.set(stage, []))
    ;(rulesQuery.data?.rules || []).forEach((rule) => rule.stages.forEach((stage) => {
      if (BACKTEST_STAGE_KEYS.includes(stage as BacktestStageKey)) map.get(stage as BacktestStageKey)?.push(rule)
    }))
    return map
  }, [rulesQuery.data?.rules])

  const updateBlueprint = (updater: (current: BacktestBlueprint) => BacktestBlueprint) => setBlueprint((current) => updater(current))
  const isBusy = runSyncMutation.isPending || startAsyncMutation.isPending
  const currentSummary = statusQuery.data?.summary || syncResult?.summary
  const curveData = curveToChartData(curveQuery.data?.curve)

  const toggleRule = (stage: BacktestStageKey, ruleId: string) => {
    updateBlueprint((current) => {
      const next = structuredClone(current)
      const rules = next.stages[stage].rules
      const existingIndex = rules.findIndex((rule) => rule.id === ruleId)
      if (existingIndex >= 0) rules.splice(existingIndex, 1)
      else rules.push({ id: ruleId, required: true, params: {} })
      return next
    })
  }

  const toggleRequired = (stage: BacktestStageKey, ruleId: string) => {
    updateBlueprint((current) => {
      const next = structuredClone(current)
      const rule = next.stages[stage].rules.find((item) => item.id === ruleId)
      if (rule) rule.required = !rule.required
      return next
    })
  }

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = presetsQuery.data?.presets.find((item) => item.id === presetId)
    if (!preset || !rulesQuery.data) return
    setBlueprint(applyPresetToBlueprint(preset, rulesQuery.data.rules, blueprint.symbol || 'THYAO'))
    setSyncResult(null)
    setActiveRunId(null)
  }

  return <div className="flex flex-col gap-6 p-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight">Blueprint Backtest</h1>
      <p className="text-muted-foreground">Rule catalog, preset catalog ve async run status akisiyla dogrudan backend’e bagli.</p>
    </div>
    <Card className="border-amber-500/30 bg-amber-500/10"><CardContent className="pt-6 text-sm text-amber-100">Async run store memory tabanli. Servis restart olursa aktif run ve event kayitlari kaybolabilir.</CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Blueprint Builder</CardTitle></CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Primary Symbol</span><Input value={blueprint.symbol || ''} onChange={(event) => updateBlueprint((current) => ({ ...current, symbol: event.target.value.toUpperCase(), symbols: [event.target.value.toUpperCase()] }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Preset</span><Select value={selectedPresetId} onChange={(event) => applyPreset(event.target.value)}><option value="">Manual</option>{(presetsQuery.data?.presets || []).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</Select></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Direction</span><Select value={blueprint.direction} onChange={(event) => updateBlueprint((current) => ({ ...current, direction: event.target.value }))}><option value="long">Long</option><option value="short">Short</option></Select></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Stage Threshold</span><Input type="number" min="1" max="3" value={blueprint.stageThreshold} onChange={(event) => updateBlueprint((current) => ({ ...current, stageThreshold: Number(event.target.value) }))} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Window Days</span><Input type="number" value={blueprint.testWindowDays} onChange={(event) => updateBlueprint((current) => ({ ...current, testWindowDays: Number(event.target.value) }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Initial Capital</span><Input type="number" value={blueprint.portfolio?.initialCapital ?? 0} onChange={(event) => updateBlueprint((current) => ({ ...current, portfolio: { ...current.portfolio, initialCapital: Number(event.target.value) } }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Position Size</span><Input type="number" value={blueprint.portfolio?.positionSize ?? 0} onChange={(event) => updateBlueprint((current) => ({ ...current, portfolio: { ...current.portfolio, positionSize: Number(event.target.value) } }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Commission %</span><Input type="number" step="0.01" value={blueprint.portfolio?.commissionPct ?? 0} onChange={(event) => updateBlueprint((current) => ({ ...current, portfolio: { ...current.portfolio, commissionPct: Number(event.target.value) } }))} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Stop %</span><Input type="number" step="0.1" value={blueprint.risk.stopPct} onChange={(event) => updateBlueprint((current) => ({ ...current, risk: { ...current.risk, stopPct: Number(event.target.value) } }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Target %</span><Input type="number" step="0.1" value={blueprint.risk.targetPct} onChange={(event) => updateBlueprint((current) => ({ ...current, risk: { ...current.risk, targetPct: Number(event.target.value) } }))} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Max Bars</span><Input type="number" value={blueprint.risk.maxBars} onChange={(event) => updateBlueprint((current) => ({ ...current, risk: { ...current.risk, maxBars: Number(event.target.value) } }))} /></label>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {BACKTEST_STAGE_KEYS.map((stage) => {
              const selectedRuleIds = blueprint.stages[stage].rules.map((rule) => rule.id)
              return <Card key={stage} className="border-border/70 bg-background/40 py-4">
                <CardHeader className="pb-4"><CardTitle className="text-sm uppercase tracking-wide">{stage}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Timeframe</span><Select value={String(blueprint.stages[stage].timeframe)} onChange={(event) => updateBlueprint((current) => ({ ...current, stages: { ...current.stages, [stage]: { ...current.stages[stage], timeframe: event.target.value as Timeframe } } }))}>{TIMEFRAMES.map((item) => <option key={item} value={item}>{formatTimeframeLabel(item)}</option>)}</Select></label>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"><span className="text-sm text-muted-foreground">Stage required</span><Checkbox checked={blueprint.stages[stage].required} onCheckedChange={(checked) => updateBlueprint((current) => ({ ...current, stages: { ...current.stages, [stage]: { ...current.stages[stage], required: Boolean(checked) } } }))} /></div>
                  <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Min Optional Matches</span><Input type="number" min="0" value={blueprint.stages[stage].minOptionalMatches} onChange={(event) => updateBlueprint((current) => ({ ...current, stages: { ...current.stages, [stage]: { ...current.stages[stage], minOptionalMatches: Number(event.target.value) } } }))} /></label>
                  <div className="space-y-2">{(groupedRules.get(stage) || []).map((rule) => {
                    const isSelected = selectedRuleIds.includes(rule.id)
                    return <div key={rule.id} className="rounded-lg border border-border/70 px-3 py-2">
                      <div className="flex items-start gap-3"><Checkbox checked={isSelected} onCheckedChange={() => toggleRule(stage, rule.id)} /><div className="flex-1"><div className="text-sm font-medium">{rule.label}</div><div className="text-xs text-muted-foreground">{rule.summary}</div></div></div>
                      {isSelected && <div className="mt-3 flex items-center justify-between rounded-lg bg-background/70 px-3 py-2 text-xs"><span className="text-muted-foreground">Rule required</span><Checkbox checked={blueprint.stages[stage].rules.find((item) => item.id === rule.id)?.required ?? true} onCheckedChange={() => toggleRequired(stage, rule.id)} /></div>}
                    </div>
                  })}</div>
                </CardContent>
              </Card>
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => runSyncMutation.mutate(blueprint)} disabled={isBusy}>{runSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Sync Run</Button>
            <Button type="button" variant="secondary" onClick={() => startAsyncMutation.mutate(blueprint)} disabled={isBusy}>{startAsyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Async Start</Button>
            <Button type="button" variant="outline" onClick={() => { setSelectedPresetId(''); setActiveRunId(null); setSyncResult(null); setBlueprint(createEmptyBlueprint()) }}><RotateCcw className="h-4 w-4" />Reset</Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Run Status</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-lg border border-border/70 bg-background/60 p-4"><div className="text-xs text-muted-foreground">Active Run</div><div className="mt-1 font-mono text-sm">{activeRunId || syncResult?.runId || 'Not started'}</div></div>
          {statusQuery.data?.progress && <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-4"><div className="flex items-center justify-between text-sm"><span>{statusQuery.data.progress.phase}</span><span>{statusQuery.data.progress.progressPct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${statusQuery.data.progress.progressPct}%` }} /></div><p className="text-xs text-muted-foreground">{statusQuery.data.progress.message}</p></div>}
          <SummaryCards summary={currentSummary} />
          {(runSyncMutation.error || startAsyncMutation.error || statusQuery.error) && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{String(runSyncMutation.error || startAsyncMutation.error || statusQuery.error)}</div>}
        </CardContent>
      </Card>
    </div>
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Portfolio Curve</CardTitle></CardHeader>
      <CardContent className="pt-6">
        {curveQuery.isLoading ? <div className="flex h-[260px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : curveData.length === 0 ? <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Async run tamamlandiginda portfoy egri verisi burada gosterilecek.</div> : <ResponsiveContainer width="100%" height={260}><AreaChart data={curveData}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" /><XAxis dataKey="x" minTickGap={30} /><YAxis /><Tooltip /><Area type="monotone" dataKey="value" stroke="#22c55e" fill="#22c55e33" strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer>}
      </CardContent>
    </Card>
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Trade Events</CardTitle></CardHeader>
      <CardContent className="space-y-4 pt-6">
        {eventsQuery.isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Eventler yukleniyor...</div> : !eventsQuery.data?.events.length ? <div className="text-sm text-muted-foreground">Event listesi henuz olusmadi.</div> : <>
          <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Symbol</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">PnL</TableHead></TableRow></TableHeader><TableBody>{eventsQuery.data.events.map((event) => <TableRow key={event.id}><TableCell>{event.type}</TableCell><TableCell>{event.symbol}</TableCell><TableCell>{event.reason}</TableCell><TableCell className="text-right">{event.price.toFixed(2)}</TableCell><TableCell className="text-right">{event.pnl === null ? '-' : Number(event.pnl).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>
          <div className="flex items-center justify-between"><Button variant="outline" size="sm" onClick={() => setEventsPage((page) => Math.max(1, page - 1))} disabled={eventsPage <= 1}>Previous</Button><span className="text-sm text-muted-foreground">Page {eventsQuery.data.page} / {eventsQuery.data.totalPages}</span><Button variant="outline" size="sm" onClick={() => setEventsPage((page) => Math.min(eventsQuery.data!.totalPages, page + 1))} disabled={eventsPage >= (eventsQuery.data?.totalPages || 1)}>Next</Button></div>
        </>}
      </CardContent>
    </Card>
  </div>
}
