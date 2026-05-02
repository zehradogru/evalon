'use client'

import { useMemo, useState } from 'react'
import {
    Activity,
    AlertCircle,
    BarChart3,
    ChevronDown,
    FileText,
    GitBranch,
    Info,
    Layers,
    Loader2,
    Network,
    RefreshCw,
    Sparkles,
    TrendingUp,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    useAnalyzeCoMovement,
    useCoMovementSnapshot,
    useCoMovementSnapshots,
    useExplainCoMovement,
    useLatestCoMovementMatrix,
    useLatestCoMovementSnapshot,
} from '@/hooks/use-co-movement'
import { cn } from '@/lib/utils'
import type {
    CoMovementAnalyzeResponse,
    CoMovementCommunity,
    CoMovementExplainResponse,
    CoMovementMatrixDictionary,
    CoMovementMatrixName,
    CoMovementPair,
    CoMovementPairRankings,
    CoMovementRollingStabilityRow,
    CoMovementSnapshotSummary,
} from '@/types'
import { CoMovementGraph } from './co-movement-graph'
import { CoMovementHeatmap } from './co-movement-heatmap'
import { CoMovementSymbolPicker } from './co-movement-symbol-picker'
import {
    averageEdgeWeight,
    buildCommunitySubset,
    buildPairSubset,
    communityColor,
    createPairKey,
    edgeSourceId,
    edgeTargetId,
    formatDateLabel,
    formatNumber,
    formatPercent,
    getLargestCommunity,
    getTopPairOptions,
    normalizeManualSubset,
    topExcludedRows,
    topMissingRows,
    topStablePairs,
} from './co-movement-utils'

const DEFAULT_CUSTOM_SYMBOLS = ['AKBNK', 'GARAN', 'ISCTR', 'YKBNK', 'THYAO', 'PGSUS']
const CUSTOM_MATRIX_ORDER: Array<{
    key: CoMovementMatrixName
    label: string
    description: string
    variant: 'correlation' | 'similarity' | 'distance'
}> = [
    {
        key: 'pearson',
        label: 'Pearson',
        description: 'Log-return serileri üzerinden doğrusal korelasyon.',
        variant: 'correlation',
    },
    {
        key: 'spearman',
        label: 'Spearman',
        description: 'Sıra bazlı ilişkiyi ölçen korelasyon görünümü.',
        variant: 'correlation',
    },
    {
        key: 'dtw_distance',
        label: 'DTW Distance',
        description: 'Fiyat eğrileri arasındaki hizalanmış uzaklık.',
        variant: 'distance',
    },
    {
        key: 'dtw_similarity',
        label: 'DTW Similarity',
        description: 'DTW uzaklığından türetilmiş benzerlik skoru.',
        variant: 'similarity',
    },
    {
        key: 'hybrid_similarity',
        label: 'Hybrid',
        description: 'Pearson ve DTW bileşenlerinden üretilen birleşik skor.',
        variant: 'similarity',
    },
]

type SnapshotFocusMode = 'community' | 'pair' | 'manual'
type SnapshotGraphScope = 'market' | 'focus'
type CoMovementResult = CoMovementSnapshotSummary | CoMovementAnalyzeResponse

function filterGraphBySymbols(result: CoMovementResult, symbols: string[]) {
    const symbolSet = new Set(symbols)
    const edges = result.graph.edges
        .map((edge) => ({
            ...edge,
            source: edgeSourceId(edge),
            target: edgeTargetId(edge),
        }))
        .filter(
            (edge) => symbolSet.has(edge.source) && symbolSet.has(edge.target)
        )

    return {
        nodes: result.graph.nodes.filter((node) => symbolSet.has(node.id)),
        edges,
    }
}

function chooseDefaultNode(
    nodes: CoMovementResult['graph']['nodes'],
    edges: CoMovementResult['graph']['edges']
) {
    if (nodes.length === 0) return null

    const degreeMap = new Map<string, number>()
    for (const node of nodes) {
        degreeMap.set(node.id, 0)
    }

    for (const edge of edges) {
        const source = edgeSourceId(edge)
        const target = edgeTargetId(edge)
        if (degreeMap.has(source)) {
            degreeMap.set(source, (degreeMap.get(source) ?? 0) + 1)
        }
        if (degreeMap.has(target)) {
            degreeMap.set(target, (degreeMap.get(target) ?? 0) + 1)
        }
    }

    return [...nodes].sort(
        (left, right) =>
            (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0) ||
            left.id.localeCompare(right.id)
    )[0].id
}

function compactStockPreview(stocks: string[], limit = 8) {
    return {
        visible: stocks.slice(0, limit),
        remaining: Math.max(0, stocks.length - limit),
    }
}

function isoDateDaysAgo(days: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().slice(0, 10)
}

function StatCard({
    label,
    value,
    hint,
    tone = 'default',
    icon,
}: {
    label: string
    value: string
    hint?: string
    tone?: 'default' | 'success' | 'warning'
    icon?: React.ReactNode
}) {
    const accentColor =
        tone === 'success' ? '#24a693' : tone === 'warning' ? '#ef9005' : '#2862ff'
    const valueColor =
        tone === 'success'
            ? 'text-emerald-300'
            : tone === 'warning'
              ? 'text-amber-200'
              : 'text-foreground'

    return (
        <div
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-[#080808] p-4"
            style={{ borderLeft: `3px solid ${accentColor}` }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    background: `radial-gradient(ellipse 70% 60% at 0% 50%, ${accentColor}18, transparent)`,
                }}
            />
            <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        {label}
                    </p>
                    <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', valueColor)}>
                        {value}
                    </p>
                    {hint ? (
                        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                    ) : null}
                </div>
                {icon ? (
                    <div
                        className="mt-0.5 shrink-0 rounded-xl p-2 text-muted-foreground/60"
                        style={{ backgroundColor: `${accentColor}18` }}
                    >
                        {icon}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function ErrorCard({ title, message }: { title: string; message: string }) {
    return (
        <div
            className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            style={{ borderLeft: '3px solid #f23645' }}
        >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-destructive/80">{message}</p>
            </div>
        </div>
    )
}

function EmptyCard({
    title,
    description,
    icon,
}: {
    title: string
    description: string
    icon: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-dashed border-border/40 bg-muted/5 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/50 bg-[#0f0f0f] text-muted-foreground">
                {icon}
            </div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground">{description}</p>
        </div>
    )
}

function ExplanationCard({
    explanation,
    onGenerate,
    isLoading,
    disabled,
    title,
}: {
    explanation: CoMovementExplainResponse | null
    onGenerate: () => void
    isLoading: boolean
    disabled: boolean
    title: string
}) {
    return (
        <div
            className="relative rounded-2xl p-[1px]"
            style={{
                background:
                    'linear-gradient(135deg, #2862ff40, #24a69340, #2e2e2e80)',
            }}
        >
            <div className="h-full rounded-[calc(1rem-1px)] bg-[#0a0a0a]">
                <div className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <p className="text-[11px] text-muted-foreground">
                                Hesaplanan metriklerin kısa bir yorumunu üretir.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onGenerate}
                        disabled={disabled || isLoading}
                        className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    >
                        {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Yorum Üret
                    </Button>
                </div>
                <div className="space-y-4 px-5 py-4">
                    {explanation ? (
                        <>
                            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                                {explanation.summary}
                            </p>
                            <div className="space-y-2">
                                {explanation.warnings.map((warning) => (
                                    <div
                                        key={warning}
                                        className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200"
                                    >
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                                        {warning}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground/60">
                                <span>Kaynak: {explanation.source}</span>
                                <span>Model: {explanation.model ?? 'fallback'}</span>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs leading-6 text-muted-foreground">
                            Sonuçlar hazır olduğunda bu alandan yorum alınabilir.
                            Çıktı yalnızca hesaplanan metrikleri açıklar; yatırım tavsiyesi
                            içermez.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

function MatrixTabsPanel({
    title,
    description,
    symbols,
    matrices,
}: {
    title: string
    description: string
    symbols: string[]
    matrices: Array<{
        key: string
        label: string
        description: string
        variant: 'correlation' | 'similarity' | 'distance'
        matrix?: CoMovementMatrixDictionary
        isLoading?: boolean
        error?: string | null
    }>
}) {
    if (matrices.length === 0) return null

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Tabs defaultValue={matrices[0]?.key}>
                <TabsList className="flex h-auto flex-wrap gap-1.5 rounded-2xl bg-[#111111] p-1.5">
                    {matrices.map((item) => (
                        <TabsTrigger
                            key={item.key}
                            value={item.key}
                            className="rounded-xl px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground aria-selected:bg-[#1c1c1c] aria-selected:text-foreground aria-selected:shadow-sm"
                        >
                            {item.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {matrices.map((item) => (
                    <TabsContent key={item.key} value={item.key} className="mt-4">
                        {item.isLoading ? (
                            <Card className="border-border/60 bg-card/80 shadow-none">
                                <CardHeader className="border-b border-border/50">
                                    <CardTitle className="text-base">{item.label}</CardTitle>
                                    <CardDescription>{item.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <Skeleton className="h-8 w-40" />
                                    <Skeleton className="h-72 w-full rounded-2xl" />
                                </CardContent>
                            </Card>
                        ) : item.error ? (
                            <ErrorCard
                                title={`${item.label} verisi yüklenemedi`}
                                message={item.error}
                            />
                        ) : (
                            <CoMovementHeatmap
                                title={item.label}
                                description={item.description}
                                matrix={item.matrix}
                                symbols={symbols}
                                variant={item.variant}
                            />
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}

function PairsTable({
    title,
    description,
    pairs,
    limit = 20,
    bare = false,
}: {
    title: string
    description: string
    pairs: CoMovementPair[]
    limit?: number
    bare?: boolean
}) {
    const rows = pairs.slice(0, limit)
    const maxHybrid = Math.max(...rows.map((p) => p.hybrid_similarity ?? 0), 1)

    return (
        <div
            className={cn(
                'overflow-hidden rounded-2xl border border-border/60 bg-[#080808]',
                bare && 'rounded-none border-0'
            )}
        >
            {!bare && (
                <div className="border-b border-border/50 px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
            )}
            <div className="divide-y divide-border/30">
                {rows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        Pair verisi bulunamadı.
                    </p>
                ) : (
                    rows.map((pair) => (
                        <div
                            key={`${pair.source}-${pair.target}`}
                            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/10"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="inline-flex items-center rounded-lg border border-[#2862ff]/30 bg-[#2862ff]/8 px-2 py-0.5 text-[11px] font-semibold text-[#2862ff]/90">
                                    {pair.source}
                                </span>
                                <span className="text-[10px] text-muted-foreground/40">vs</span>
                                <span className="inline-flex items-center rounded-lg border border-[#2862ff]/30 bg-[#2862ff]/8 px-2 py-0.5 text-[11px] font-semibold text-[#2862ff]/90">
                                    {pair.target}
                                </span>
                            </div>
                            <div className="w-28 shrink-0">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground/50">hybrid</span>
                                    <span className="text-xs font-semibold text-cyan-300">
                                        {formatNumber(pair.hybrid_similarity, 3)}
                                    </span>
                                </div>
                                <div className="h-[3px] w-full rounded-full bg-border/30">
                                    <div
                                        className="cmo-progress-bar h-full rounded-full"
                                        style={{
                                            width: `${((pair.hybrid_similarity ?? 0) / maxHybrid) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="hidden w-36 shrink-0 flex-col gap-0.5 text-right lg:flex">
                                <span className="text-[10px] text-muted-foreground/60">
                                    P {formatNumber(pair.pearson, 3)} · D{' '}
                                    {formatNumber(pair.dtw_similarity, 3)}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">
                                    Sp {formatNumber(pair.spearman, 3)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function PairRankingsCard({
    rankings,
}: {
    rankings: CoMovementPairRankings
}) {
    const [activeRankTab, setActiveRankTab] = useState<'hybrid' | 'pearson' | 'dtw'>('hybrid')

    return (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
                <div>
                    <p className="text-sm font-semibold text-foreground">Pair Sıralamaları</p>
                    <p className="text-[11px] text-muted-foreground">
                        Farklı skor kümelerine göre öne çıkan çiftler
                    </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                    {(['hybrid', 'pearson', 'dtw'] as const).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveRankTab(key)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition-all',
                                activeRankTab === key
                                    ? 'bg-[#1e1e1e] text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground/70'
                            )}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>
            <PairsTable
                title=""
                description=""
                pairs={rankings[activeRankTab]}
                limit={12}
                bare
            />
        </div>
    )
}

function CommunitiesCard({
    communities,
    edges,
    selectedCommunityId,
    onSelect,
    limit = 12,
}: {
    communities: CoMovementCommunity[]
    edges: CoMovementResult['graph']['edges']
    selectedCommunityId?: number | null
    onSelect?: (communityId: number) => void
    limit?: number
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
            <div className="border-b border-border/50 px-5 py-4">
                <p className="text-sm font-semibold text-foreground">Topluluklar</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Louvain tabanlı gruplar · grup içi ortalama benzerlik
                </p>
            </div>
            <div className="space-y-2 p-3">
                {communities.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                        Community verisi bulunamadı.
                    </p>
                ) : (
                    communities.slice(0, limit).map((community) => {
                        const avgEdge = averageEdgeWeight(community, edges)
                        const isSelected = selectedCommunityId === community.community_id
                        const color = communityColor(community.community_id)
                        const { visible, remaining } = compactStockPreview(community.stocks, 7)

                        return (
                            <button
                                key={community.community_id}
                                type="button"
                                onClick={() => onSelect?.(community.community_id)}
                                className="relative w-full overflow-hidden rounded-xl border px-4 py-3.5 text-left transition-all"
                                style={{
                                    borderLeft: `3px solid ${color}`,
                                    borderColor: isSelected ? `${color}60` : undefined,
                                    borderTopColor: isSelected ? `${color}60` : undefined,
                                    borderRightColor: isSelected ? `${color}60` : undefined,
                                    borderBottomColor: isSelected ? `${color}60` : undefined,
                                    backgroundColor: isSelected
                                        ? `${color}0a`
                                        : 'rgba(255,255,255,0.02)',
                                }}
                            >
                                {isSelected && (
                                    <div
                                        className="pointer-events-none absolute inset-0"
                                        style={{
                                            background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${color}12, transparent)`,
                                        }}
                                    />
                                )}
                                <div className="relative flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-white/10"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="text-sm font-semibold text-foreground">
                                            Grup {community.community_id}
                                        </span>
                                        <span className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            {community.size} hisse
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                                        <span>sim {formatNumber(community.avg_similarity, 3)}</span>
                                        <span>edge {formatNumber(avgEdge, 3)}</span>
                                    </div>
                                </div>
                                <div className="relative mt-2.5 flex flex-wrap gap-1.5">
                                    {visible.map((stock) => (
                                        <span
                                            key={stock}
                                            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                                            style={{
                                                backgroundColor: `${color}18`,
                                                color: color,
                                                border: `1px solid ${color}30`,
                                            }}
                                        >
                                            {stock}
                                        </span>
                                    ))}
                                    {remaining > 0 && (
                                        <span className="rounded-md border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground/60">
                                            +{remaining}
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}

function RollingStabilityCard({
    rows,
}: {
    rows: CoMovementRollingStabilityRow[]
}) {
    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Rolling Stability</CardTitle>
                <CardDescription>
                    Farklı pencerelerde güçlü kalmaya devam eden eşleşmeler.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pair</TableHead>
                            <TableHead className="text-right">Stability</TableHead>
                            <TableHead className="text-right">Strong Windows</TableHead>
                            <TableHead className="text-right">Hybrid</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                    Rolling stability verisi bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            topStablePairs(rows).map((row) => (
                                <TableRow key={row.pair}>
                                    <TableCell className="font-medium">{row.pair}</TableCell>
                                    <TableCell className="text-right text-cyan-200">
                                        {formatPercent(row.stability, 0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {row.strong_windows} / {row.total_windows}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(row.hybrid_similarity, 3)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function QualityCard({
    result,
}: {
    result: CoMovementResult
}) {
    const mostFilled = topMissingRows(result.data_quality)
    const excluded = topExcludedRows(result.excluded_symbols)

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/60 bg-card/80 shadow-none">
                <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-base">Data Quality</CardTitle>
                    <CardDescription>
                        Dolgu uygulanan ve eksik oranı öne çıkan seriler.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead className="text-right">Observed</TableHead>
                                <TableHead className="text-right">Filled</TableHead>
                                <TableHead className="text-right">Missing</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mostFilled.map((row) => (
                                <TableRow key={row.symbol}>
                                    <TableCell className="font-medium">{row.symbol}</TableCell>
                                    <TableCell className="text-right">
                                        {row.observed_rows} / {row.rows}
                                    </TableCell>
                                    <TableCell className="text-right">{row.filled_rows}</TableCell>
                                    <TableCell className="text-right">
                                        {formatPercent(row.missing_ratio, 1)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-none">
                <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-base">Excluded Symbols</CardTitle>
                    <CardDescription>
                        Minimum geçmiş veya kalite eşiğini sağlayamayan hisseler.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Rows</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {excluded.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                        Hariç tutulan hisse yok.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                excluded.map((row) => (
                                    <TableRow key={`${row.symbol}-${row.reason}`}>
                                        <TableCell className="font-medium">{row.symbol}</TableCell>
                                        <TableCell>{row.reason}</TableCell>
                                        <TableCell className="text-right">
                                            {row.rows ?? '—'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function NodeDetailCard({
    result,
    selectedNodeId,
    visibleNodes,
    visibleEdges,
    onClose,
}: {
    result: CoMovementResult
    selectedNodeId: string | null
    visibleNodes?: CoMovementResult['graph']['nodes']
    visibleEdges?: CoMovementResult['graph']['edges']
    onClose?: () => void
}) {
    const nodes = visibleNodes ?? result.graph.nodes
    const edges = visibleEdges ?? result.graph.edges
    const node = nodes.find((item) => item.id === selectedNodeId) ?? null
    const community = result.communities.find(
        (item) => item.community_id === node?.community_id
    )
    const connections = edges
        .filter(
            (edge) =>
                edgeSourceId(edge) === selectedNodeId ||
                edgeTargetId(edge) === selectedNodeId
        )
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 10)
    const communityPreview = compactStockPreview(community?.stocks ?? [], 8)

    const nodeColor = communityColor(node?.community_id)

    return (
        <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Hisse Detayı
                </p>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground/40 transition-colors hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {!node ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="mb-3 rounded-2xl border border-border/40 bg-muted/10 p-3 text-muted-foreground/40">
                            <Network className="h-5 w-5" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Grafikten bir hisse seçin
                        </p>
                    </div>
                ) : (
                    <>
                        <div
                            className="rounded-2xl border p-3.5"
                            style={{
                                borderColor: `${nodeColor}40`,
                                backgroundColor: `${nodeColor}0c`,
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p
                                        className="text-lg font-bold tracking-tight"
                                        style={{ color: nodeColor }}
                                    >
                                        {node.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Grup {node.community_id ?? '—'} · {community?.size ?? 0} hisse
                                    </p>
                                </div>
                                <span
                                    className="mt-1.5 h-3 w-3 rounded-full ring-2 ring-inset ring-white/20"
                                    style={{ backgroundColor: nodeColor }}
                                />
                            </div>
                            {communityPreview.visible.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {communityPreview.visible.map((stock) => (
                                        <span
                                            key={stock}
                                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                            style={
                                                stock === node.id
                                                    ? {
                                                          backgroundColor: `${nodeColor}30`,
                                                          color: nodeColor,
                                                          border: `1px solid ${nodeColor}50`,
                                                      }
                                                    : {
                                                          backgroundColor: 'rgba(255,255,255,0.04)',
                                                          color: '#787b86',
                                                          border: '1px solid #2e2e2e',
                                                      }
                                            }
                                        >
                                            {stock}
                                        </span>
                                    ))}
                                    {communityPreview.remaining > 0 && (
                                        <span className="rounded border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/50">
                                            +{communityPreview.remaining}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <p className="pt-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                            En Güçlü Bağlantılar
                        </p>

                        <div className="space-y-1.5">
                            {connections.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Bu hisse için kenar bulunamadı.
                                </p>
                            ) : (
                                connections.map((edge) => {
                                    const source = edgeSourceId(edge)
                                    const target = edgeTargetId(edge)
                                    const counterparty =
                                        source === selectedNodeId ? target : source
                                    const counterColor = communityColor(
                                        result.graph.nodes.find((n) => n.id === counterparty)
                                            ?.community_id
                                    )

                                    return (
                                        <div
                                            key={`${source}-${target}`}
                                            className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/5 px-3 py-2.5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2 w-2 shrink-0 rounded-full"
                                                    style={{ backgroundColor: counterColor }}
                                                />
                                                <span className="text-sm font-medium text-foreground">
                                                    {counterparty}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-semibold text-cyan-300">
                                                    {formatNumber(edge.weight, 3)}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground/50">
                                                    P {formatNumber(edge.pearson, 3)} · D{' '}
                                                    {formatNumber(edge.dtw_similarity, 3)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function snapshotSummaryCards(snapshot: CoMovementSnapshotSummary) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Hisse"
                value={String(snapshot.metrics.node_count)}
                hint={`İstenen ${snapshot.requested_symbols.length} sembolden kullanılabilenler`}
                icon={<Activity className="h-4 w-4" />}
            />
            <StatCard
                label="Topluluk"
                value={String(snapshot.metrics.community_count)}
                hint={`${snapshot.metrics.edge_count} bağlantı ile`}
                icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
                label="Modularity"
                value={formatNumber(snapshot.metrics.modularity, 3)}
                hint={snapshot.metrics.louvain_method}
                tone="success"
                icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
                label="Rolling Window"
                value={String(snapshot.metrics.rolling_window_count)}
                hint={`${snapshot.date_range.rows ?? 0} hizalanmış günlük satır`}
                tone="warning"
                icon={<RefreshCw className="h-4 w-4" />}
            />
        </div>
    )
}

function analysisSummaryCards(result: CoMovementAnalyzeResponse) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Hybrid Pair"
                value={String(result.top_pairs.length)}
                hint={`Pair count ${result.metrics.pair_count}`}
                icon={<Activity className="h-4 w-4" />}
            />
            <StatCard
                label="Topluluk"
                value={String(result.metrics.community_count)}
                hint={`${result.metrics.edge_count} bağlantı`}
                icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
                label="Modularity"
                value={formatNumber(result.metrics.modularity, 3)}
                hint={result.metrics.louvain_method}
                tone="success"
                icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
                label="Dışlanan"
                value={String(result.excluded_symbols.length)}
                hint={`Rolling window ${result.metrics.rolling_window_count}`}
                tone="warning"
                icon={<RefreshCw className="h-4 w-4" />}
            />
        </div>
    )
}

function SnapshotExplorerView({
    snapshot,
    snapshotMode,
}: {
    snapshot: CoMovementSnapshotSummary
    snapshotMode: 'latest' | string
}) {
    const largestCommunity = getLargestCommunity(snapshot)
    const leadPair = getTopPairOptions(snapshot.top_pairs, 1)[0]
    const defaultCommunitySubset = buildCommunitySubset(largestCommunity, 12)
    const explainMutation = useExplainCoMovement()

    const [snapshotFocusMode, setSnapshotFocusMode] =
        useState<SnapshotFocusMode>('community')
    const [snapshotGraphScope, setSnapshotGraphScope] =
        useState<SnapshotGraphScope>('market')
    const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(
        largestCommunity?.community_id ?? null
    )
    const [selectedPairKey, setSelectedPairKey] = useState(
        leadPair ? createPairKey(leadPair.source, leadPair.target) : ''
    )
    const [manualSnapshotSymbols, setManualSnapshotSymbols] = useState<string[]>(
        defaultCommunitySubset.length >= 2
            ? defaultCommunitySubset
            : snapshot.symbols.slice(0, 6)
    )
    const [showAdvancedSnapshotMatrices, setShowAdvancedSnapshotMatrices] =
        useState(false)
    const [showMatrices, setShowMatrices] = useState(false)
    const [showDetails, setShowDetails] = useState(false)
    const [selectedSnapshotNodeId, setSelectedSnapshotNodeId] = useState<string | null>(null)
    const [snapshotExplanation, setSnapshotExplanation] =
        useState<CoMovementExplainResponse | null>(null)

    const selectedCommunity = useMemo(
        () =>
            snapshot.communities.find(
                (item) => item.community_id === selectedCommunityId
            ) ?? largestCommunity,
        [largestCommunity, selectedCommunityId, snapshot.communities]
    )

    const selectedPair = useMemo(
        () =>
            snapshot.top_pairs.find(
                (item) => createPairKey(item.source, item.target) === selectedPairKey
            ) ?? snapshot.top_pairs[0],
        [selectedPairKey, snapshot.top_pairs]
    )

    const snapshotMatrixSymbols = useMemo(() => {
        const universe = new Set(snapshot.symbols)
        const byCommunity = buildCommunitySubset(selectedCommunity, 12)
        const byPair = buildPairSubset(selectedPair, snapshot.top_pairs, 12)
        const manual = normalizeManualSubset(manualSnapshotSymbols, 12)

        const raw =
            snapshotFocusMode === 'manual'
                ? manual
                : snapshotFocusMode === 'pair'
                  ? byPair
                  : byCommunity

        const filtered = raw.filter((symbol) => universe.has(symbol))
        if (filtered.length >= 2) return filtered

        const fallback = buildCommunitySubset(largestCommunity, 12).filter((symbol) =>
            universe.has(symbol)
        )
        if (fallback.length >= 2) return fallback

        return snapshot.symbols.slice(0, 12)
    }, [
        largestCommunity,
        manualSnapshotSymbols,
        selectedCommunity,
        selectedPair,
        snapshot.symbols,
        snapshot.top_pairs,
        snapshotFocusMode,
    ])

    const snapshotGraphSymbols = useMemo(() => {
        if (snapshotFocusMode === 'pair') {
            const pairSubset = buildPairSubset(selectedPair, snapshot.top_pairs, 48)
            if (pairSubset.length >= 2) return pairSubset
        }

        const communitySubset = buildCommunitySubset(selectedCommunity, 72)
        if (communitySubset.length >= 2) return communitySubset

        return snapshotMatrixSymbols
    }, [selectedCommunity, selectedPair, snapshot.top_pairs, snapshotFocusMode, snapshotMatrixSymbols])

    const snapshotGraphData = useMemo(() => {
        if (snapshotGraphScope === 'market') {
            return {
                nodes: snapshot.graph.nodes,
                edges: snapshot.graph.edges.map((edge) => ({
                    ...edge,
                    source: edgeSourceId(edge),
                    target: edgeTargetId(edge),
                })),
            }
        }

        return filterGraphBySymbols(snapshot, snapshotGraphSymbols)
    }, [snapshot, snapshotGraphScope, snapshotGraphSymbols])

    const defaultSnapshotNodeId = useMemo(
        () => chooseDefaultNode(snapshotGraphData.nodes, snapshotGraphData.edges),
        [snapshotGraphData.edges, snapshotGraphData.nodes]
    )

    const effectiveSelectedSnapshotNodeId = snapshotGraphData.nodes.some(
        (node) => node.id === selectedSnapshotNodeId
    )
        ? selectedSnapshotNodeId
        : defaultSnapshotNodeId

    const snapshotPearsonMatrix = useLatestCoMovementMatrix(
        'pearson',
        snapshotMatrixSymbols,
        snapshotMode === 'latest'
    )
    const snapshotHybridMatrix = useLatestCoMovementMatrix(
        'hybrid_similarity',
        snapshotMatrixSymbols,
        snapshotMode === 'latest'
    )
    const snapshotDtwSimilarityMatrix = useLatestCoMovementMatrix(
        'dtw_similarity',
        snapshotMatrixSymbols,
        snapshotMode === 'latest'
    )
    const snapshotSpearmanMatrix = useLatestCoMovementMatrix(
        'spearman',
        snapshotMatrixSymbols,
        snapshotMode === 'latest' && showAdvancedSnapshotMatrices
    )
    const snapshotDtwDistanceMatrix = useLatestCoMovementMatrix(
        'dtw_distance',
        snapshotMatrixSymbols,
        snapshotMode === 'latest' && showAdvancedSnapshotMatrices
    )

    const coreSnapshotMatrices = [
        {
            key: 'pearson',
            label: 'Pearson',
            description: 'Log-return serileri üzerinden doğrusal korelasyon.',
            variant: 'correlation' as const,
            matrix: snapshotPearsonMatrix.data?.matrix,
            isLoading: snapshotPearsonMatrix.isLoading,
            error:
                snapshotPearsonMatrix.error instanceof Error
                    ? snapshotPearsonMatrix.error.message
                    : null,
        },
        {
            key: 'dtw_similarity',
            label: 'DTW Similarity',
            description: 'Normalize edilmiş fiyat eğrileri arasındaki zaman-esnek benzerlik.',
            variant: 'similarity' as const,
            matrix: snapshotDtwSimilarityMatrix.data?.matrix,
            isLoading: snapshotDtwSimilarityMatrix.isLoading,
            error:
                snapshotDtwSimilarityMatrix.error instanceof Error
                    ? snapshotDtwSimilarityMatrix.error.message
                    : null,
        },
        {
            key: 'hybrid_similarity',
            label: 'Hybrid Similarity',
            description: 'Pearson ve DTW skorlarının birleşik görünümü.',
            variant: 'similarity' as const,
            matrix: snapshotHybridMatrix.data?.matrix,
            isLoading: snapshotHybridMatrix.isLoading,
            error:
                snapshotHybridMatrix.error instanceof Error
                    ? snapshotHybridMatrix.error.message
                    : null,
        },
    ]

    const advancedSnapshotMatrices = [
        {
            key: 'spearman',
            label: 'Spearman',
            description: 'Sıra korelasyonu görünümü.',
            variant: 'correlation' as const,
            matrix: snapshotSpearmanMatrix.data?.matrix,
            isLoading: snapshotSpearmanMatrix.isLoading,
            error:
                snapshotSpearmanMatrix.error instanceof Error
                    ? snapshotSpearmanMatrix.error.message
                    : null,
        },
        {
            key: 'dtw_distance',
            label: 'DTW Distance',
            description: 'Ham zaman-esnek mesafe matrisi.',
            variant: 'distance' as const,
            matrix: snapshotDtwDistanceMatrix.data?.matrix,
            isLoading: snapshotDtwDistanceMatrix.isLoading,
            error:
                snapshotDtwDistanceMatrix.error instanceof Error
                    ? snapshotDtwDistanceMatrix.error.message
                    : null,
        },
    ]

    return (
        <div className="space-y-4">
            {/* A: Ana metrik kartlar */}
            {snapshotSummaryCards(snapshot)}

            {/* A2: İkincil bilgi kartları */}
            <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                    label="Tarih Aralığı"
                    value={`${formatDateLabel(snapshot.date_range.start)} → ${formatDateLabel(snapshot.date_range.end)}`}
                    hint={`Hizalanmış: ${formatDateLabel(snapshot.date_range.aligned_start)} → ${formatDateLabel(snapshot.date_range.aligned_end)}`}
                />
                <StatCard
                    label="Oluşturulma"
                    value={formatDateLabel(snapshot.snapshot.created_at)}
                    hint={snapshot.snapshot.snapshot_id}
                />
                <StatCard
                    label="Yapılandırma"
                    value={`top_k ${snapshot.config.top_k}`}
                    hint={`min sim ${formatNumber(snapshot.config.min_similarity, 2)} · rolling ${snapshot.config.rolling_window}`}
                />
            </div>

            {/* B: Ağ grafiği + topluluk / hisse detay kenar paneli */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
                <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2862ff]/10 text-[#2862ff]">
                            <Network className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Ağ Grafiği</p>
                            <p className="text-[11px] text-muted-foreground">
                                {snapshotGraphData.nodes.length} hisse · {snapshotGraphData.edges.length} bağlantı
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                        {(['market', 'focus'] as const).map((scope) => (
                            <button
                                key={scope}
                                type="button"
                                onClick={() => setSnapshotGraphScope(scope)}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                                    snapshotGraphScope === scope
                                        ? 'bg-[#1e1e1e] text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground/70'
                                )}
                            >
                                {scope === 'market' ? 'Tüm Piyasa' : 'Odaklı'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex" style={{ height: 550 }}>
                    {/* Grafik */}
                    <div className="relative min-w-0 flex-1 overflow-hidden">
                        <CoMovementGraph
                            title=""
                            description=""
                            nodes={snapshotGraphData.nodes}
                            edges={snapshotGraphData.edges}
                            selectedNodeId={effectiveSelectedSnapshotNodeId}
                            onSelectNode={setSelectedSnapshotNodeId}
                            height={550}
                            bare
                        />
                    </div>

                    {/* Kenar panel: topluluklar veya hisse detayı */}
                    <div className="flex w-[270px] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-[#060606]">
                        {selectedSnapshotNodeId ? (
                            <NodeDetailCard
                                result={snapshot}
                                selectedNodeId={selectedSnapshotNodeId}
                                visibleNodes={snapshotGraphData.nodes}
                                visibleEdges={snapshotGraphData.edges}
                                onClose={() => setSelectedSnapshotNodeId(null)}
                            />
                        ) : (
                            <>
                                <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                        Topluluklar
                                    </p>
                                    <span className="text-[10px] text-muted-foreground/50">
                                        {snapshot.communities.length} grup
                                    </span>
                                </div>
                                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                                    {snapshot.communities.map((community) => {
                                        const color = communityColor(community.community_id)
                                        const isSelected = selectedCommunityId === community.community_id
                                        const { visible } = compactStockPreview(community.stocks, 4)
                                        return (
                                            <button
                                                key={community.community_id}
                                                type="button"
                                                onClick={() => {
                                                    setSnapshotGraphScope('focus')
                                                    setSnapshotFocusMode('community')
                                                    setSelectedCommunityId(community.community_id)
                                                }}
                                                className="relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all"
                                                style={{
                                                    borderLeftWidth: 3,
                                                    borderLeftColor: color,
                                                    borderTopColor: isSelected ? `${color}40` : 'transparent',
                                                    borderRightColor: isSelected ? `${color}40` : 'transparent',
                                                    borderBottomColor: isSelected ? `${color}40` : 'transparent',
                                                    backgroundColor: isSelected ? `${color}0a` : 'rgba(255,255,255,0.01)',
                                                }}
                                            >
                                                {isSelected && (
                                                    <div
                                                        className="pointer-events-none absolute inset-0"
                                                        style={{
                                                            background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${color}10, transparent)`,
                                                        }}
                                                    />
                                                )}
                                                <div className="relative flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="h-2 w-2 shrink-0 rounded-full"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                        <span className="text-xs font-semibold text-foreground">
                                                            G{community.community_id}
                                                        </span>
                                                        <span className="rounded border border-border/40 px-1 text-[9px] text-muted-foreground/60">
                                                            {community.size}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-cyan-300/70">
                                                        {formatNumber(community.avg_similarity, 3)}
                                                    </span>
                                                </div>
                                                <div className="relative mt-1.5 flex flex-wrap gap-1">
                                                    {visible.map((stock) => (
                                                        <span
                                                            key={stock}
                                                            className="rounded px-1 py-0.5 text-[9px] font-medium"
                                                            style={{
                                                                backgroundColor: `${color}18`,
                                                                color: color,
                                                                border: `1px solid ${color}30`,
                                                            }}
                                                        >
                                                            {stock}
                                                        </span>
                                                    ))}
                                                    {community.stocks.length > 4 && (
                                                        <span className="rounded border border-border/40 px-1 py-0.5 text-[9px] text-muted-foreground/50">
                                                            +{community.stocks.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 border-t border-border/40 px-5 py-2.5 text-[10px] text-muted-foreground/50">
                    <span>Node rengi community kimliğini gösterir</span>
                    <span>Node boyutu bağlantı yoğunluğuna göre ölçeklenir</span>
                    <span>Kenar kalınlığı hybrid similarity ağırlığını gösterir</span>
                </div>
            </div>

            {/* C: En güçlü eşleşmeler */}
            <PairsTable
                title="En Güçlü Eşleşmeler"
                description="Hybrid similarity skoruna göre en yakın hareket eden hisseler."
                pairs={snapshot.top_pairs}
                limit={15}
            />

            {/* D: Matrisler — collapsible */}
            <div className="overflow-hidden rounded-2xl border border-border/60">
                <button
                    type="button"
                    onClick={() => setShowMatrices((v) => !v)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/5"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-[#2862ff]/10 p-1.5">
                            <BarChart3 className="h-4 w-4 text-[#2862ff]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Matris Görünümleri</p>
                            <p className="text-[11px] text-muted-foreground">
                                Pearson · DTW · Hybrid similarity heatmap&apos;leri
                            </p>
                        </div>
                    </div>
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground cmo-chevron',
                            showMatrices ? 'cmo-chevron-open' : 'cmo-chevron-close'
                        )}
                    />
                </button>

                {showMatrices && (
                    <div className="space-y-5 border-t border-border/50 px-5 py-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xs text-muted-foreground">Odak:</p>
                            <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                                {(['community', 'pair', 'manual'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setSnapshotFocusMode(mode)}
                                        disabled={snapshotMode !== 'latest'}
                                        className={cn(
                                            'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-40',
                                            snapshotFocusMode === mode
                                                ? 'bg-[#1e1e1e] text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground/70'
                                        )}
                                    >
                                        {mode === 'community'
                                            ? 'Topluluk'
                                            : mode === 'pair'
                                              ? 'Top Pair'
                                              : 'Manuel'}
                                    </button>
                                ))}
                            </div>
                            {snapshotFocusMode === 'community' && (
                                <Select
                                    value={String(
                                        selectedCommunityId ??
                                            snapshot.communities[0]?.community_id ??
                                            ''
                                    )}
                                    onChange={(event) => {
                                        setSnapshotFocusMode('community')
                                        setSelectedCommunityId(Number(event.target.value))
                                    }}
                                    disabled={snapshotMode !== 'latest'}
                                >
                                    {snapshot.communities.map((community) => (
                                        <option
                                            key={community.community_id}
                                            value={community.community_id}
                                        >
                                            Grup {community.community_id} · {community.size} hisse
                                        </option>
                                    ))}
                                </Select>
                            )}
                            {snapshotFocusMode === 'pair' && (
                                <Select
                                    value={
                                        selectedPairKey ||
                                        createPairKey(
                                            snapshot.top_pairs[0]?.source ?? '',
                                            snapshot.top_pairs[0]?.target ?? ''
                                        )
                                    }
                                    onChange={(event) => {
                                        setSnapshotFocusMode('pair')
                                        setSelectedPairKey(event.target.value)
                                    }}
                                    disabled={snapshotMode !== 'latest'}
                                >
                                    {getTopPairOptions(snapshot.top_pairs).map((pair) => (
                                        <option
                                            key={createPairKey(pair.source, pair.target)}
                                            value={createPairKey(pair.source, pair.target)}
                                        >
                                            {pair.source}–{pair.target}
                                        </option>
                                    ))}
                                </Select>
                            )}
                        </div>

                        {snapshotFocusMode === 'manual' && (
                            <CoMovementSymbolPicker
                                label="Manuel heatmap sepeti"
                                helperText="2-12 hisse seçin."
                                selectedSymbols={manualSnapshotSymbols}
                                onChange={(symbols) => {
                                    setSnapshotFocusMode('manual')
                                    setManualSnapshotSymbols(symbols)
                                }}
                                maxSymbols={12}
                                disabled={snapshotMode !== 'latest'}
                                allowedSymbols={snapshot.symbols}
                            />
                        )}

                        {snapshotMode !== 'latest' ? (
                            <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
                                Bu snapshot için özet gösteriliyor. Matris detayı latest pointer üzerinden okunabilir.
                            </div>
                        ) : (
                            <>
                                <MatrixTabsPanel
                                    title="Ana Matrisler"
                                    description="Pearson · DTW Similarity · Hybrid"
                                    symbols={snapshotMatrixSymbols}
                                    matrices={coreSnapshotMatrices}
                                />
                                <div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowAdvancedSnapshotMatrices((v) => !v)
                                        }
                                        className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'h-3.5 w-3.5 cmo-chevron',
                                                showAdvancedSnapshotMatrices
                                                    ? 'cmo-chevron-open'
                                                    : 'cmo-chevron-close'
                                            )}
                                        />
                                        {showAdvancedSnapshotMatrices
                                            ? 'Ek matrisleri gizle'
                                            : 'Spearman + DTW Distance göster'}
                                    </button>
                                    {showAdvancedSnapshotMatrices && (
                                        <div className="mt-4">
                                            <MatrixTabsPanel
                                                title="Ek Matris Görünümleri"
                                                description="Spearman · DTW Distance"
                                                symbols={snapshotMatrixSymbols}
                                                matrices={advancedSnapshotMatrices}
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* E: Detaylar — collapsible */}
            <div className="overflow-hidden rounded-2xl border border-border/60">
                <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/5"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-[#ef9005]/10 p-1.5">
                            <FileText className="h-4 w-4 text-[#ef9005]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Detaylar</p>
                            <p className="text-[11px] text-muted-foreground">
                                Pair sıralamaları · Rolling stability · Veri kalitesi
                            </p>
                        </div>
                    </div>
                    <ChevronDown
                        className={cn(
                            'h-4 w-4 text-muted-foreground cmo-chevron',
                            showDetails ? 'cmo-chevron-open' : 'cmo-chevron-close'
                        )}
                    />
                </button>

                {showDetails && (
                    <div className="space-y-4 border-t border-border/50 px-5 py-5">
                        <CommunitiesCard
                            communities={snapshot.communities}
                            edges={snapshot.graph.edges}
                            selectedCommunityId={selectedCommunityId}
                            onSelect={(communityId) => {
                                setSnapshotGraphScope('focus')
                                setSnapshotFocusMode('community')
                                setSelectedCommunityId(communityId)
                            }}
                            limit={snapshot.communities.length}
                        />
                        <div className="grid gap-4 xl:grid-cols-2">
                            <PairRankingsCard rankings={snapshot.pair_rankings} />
                            <RollingStabilityCard rows={snapshot.rolling_stability} />
                        </div>
                        <QualityCard result={snapshot} />
                    </div>
                )}
            </div>

            {/* F: Yorum */}
            <ExplanationCard
                title="Özet Yorum"
                explanation={snapshotExplanation}
                onGenerate={() =>
                    void explainMutation
                        .mutateAsync({
                            top_pairs: snapshot.top_pairs,
                            communities: snapshot.communities,
                            metrics: snapshot.metrics,
                            language: 'tr',
                            symbols: snapshot.symbols,
                            date_range: snapshot.date_range,
                        })
                        .then(setSnapshotExplanation)
                }
                isLoading={explainMutation.isPending}
                disabled={explainMutation.isPending}
            />
        </div>
    )
}

export function CoMovementSection() {
    const latestSnapshotQuery = useLatestCoMovementSnapshot()
    const snapshotsQuery = useCoMovementSnapshots()
    const analyzeMutation = useAnalyzeCoMovement()
    const analysisExplainMutation = useExplainCoMovement()
    const [selectedSnapshotMode, setSelectedSnapshotMode] = useState<'latest' | string>('latest')
    const [selectedAnalysisNodeId, setSelectedAnalysisNodeId] = useState<string | null>(null)
    const [analysisExplanation, setAnalysisExplanation] = useState<CoMovementExplainResponse | null>(null)

    const snapshotDetailQuery = useCoMovementSnapshot(
        selectedSnapshotMode === 'latest' ? null : selectedSnapshotMode
    )

    const currentSnapshot =
        selectedSnapshotMode === 'latest'
            ? latestSnapshotQuery.data ?? null
            : snapshotDetailQuery.data ?? null

    const historicalSnapshots = useMemo(() => {
        const latestId = latestSnapshotQuery.data?.snapshot.snapshot_id
        return (snapshotsQuery.data?.snapshots ?? []).filter(
            (item) => item.snapshot_id !== latestId
        )
    }, [latestSnapshotQuery.data?.snapshot.snapshot_id, snapshotsQuery.data?.snapshots])

    const [activeMode, setActiveMode] = useState<'snapshot' | 'custom'>('snapshot')
    const [customSymbols, setCustomSymbols] = useState<string[]>(DEFAULT_CUSTOM_SYMBOLS)
    const [customStartDateOverride, setCustomStartDateOverride] = useState<string | null>(
        null
    )
    const [customEndDateOverride, setCustomEndDateOverride] = useState<string | null>(null)
    const [customTopK, setCustomTopK] = useState(3)
    const [customMinSimilarity, setCustomMinSimilarity] = useState(0.6)
    const [customRollingWindow, setCustomRollingWindow] = useState(90)
    const [customResult, setCustomResult] = useState<CoMovementAnalyzeResponse | null>(null)
    const [selectedCustomCommunityId, setSelectedCustomCommunityId] = useState<number | null>(null)
    const [customGraphScope, setCustomGraphScope] = useState<SnapshotGraphScope>('market')
    const customStartDate =
        customStartDateOverride ??
        latestSnapshotQuery.data?.date_range.start ??
        isoDateDaysAgo(365)
    const customEndDate =
        customEndDateOverride ??
        latestSnapshotQuery.data?.date_range.end ??
        isoDateDaysAgo(1)

    const handleRunAnalysis = async () => {
        const response = await analyzeMutation.mutateAsync({
            symbols: customSymbols,
            start_date: customStartDate,
            end_date: customEndDate,
            top_k: customTopK,
            min_similarity: customMinSimilarity,
            rolling_window: customRollingWindow,
            rolling_step: 20,
            max_missing_ratio: 0.15,
            min_history_rows: 60,
            timeframe: '1d',
        })

        setCustomResult(response)
        setSelectedAnalysisNodeId(chooseDefaultNode(response.graph.nodes, response.graph.edges))
        setSelectedCustomCommunityId(null)
        setCustomGraphScope('market')
        setAnalysisExplanation(null)
    }

    const customGraphData = useMemo(() => {
        if (!customResult) return { nodes: [] as CoMovementResult['graph']['nodes'], edges: [] as CoMovementResult['graph']['edges'] }
        if (customGraphScope === 'market') {
            return {
                nodes: customResult.graph.nodes,
                edges: customResult.graph.edges.map((edge) => ({
                    ...edge,
                    source: edgeSourceId(edge),
                    target: edgeTargetId(edge),
                })),
            }
        }
        const community = customResult.communities.find(
            (c) => c.community_id === selectedCustomCommunityId
        )
        if (!community) return { nodes: customResult.graph.nodes, edges: [] as typeof customResult.graph.edges }
        return filterGraphBySymbols(customResult, community.stocks)
    }, [customResult, customGraphScope, selectedCustomCommunityId])

    const effectiveSelectedAnalysisNodeId =
        customGraphData.nodes.some((node) => node.id === selectedAnalysisNodeId)
            ? selectedAnalysisNodeId
            : customResult
              ? chooseDefaultNode(customGraphData.nodes, customGraphData.edges)
              : null

    const customMatrixSymbols = useMemo(() => {
        if (!customResult) return []

        const leadPair = customResult.top_pairs[0]
        const pairSubset = buildPairSubset(leadPair, customResult.top_pairs, 12)
        if (pairSubset.length >= 2) return pairSubset

        return customResult.symbols.slice(0, 12)
    }, [customResult])

    const customMatrixPanels = CUSTOM_MATRIX_ORDER.map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description,
        variant: item.variant,
        matrix: customResult?.matrices[item.key],
        isLoading: analyzeMutation.isPending && !customResult,
        error: null,
    }))

    return (
        <section className="space-y-6">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-[#030303] px-6 py-8">
                <div className="pointer-events-none absolute inset-0 cmo-hero-glow" />
                <div className="relative space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/8 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                        <Network className="h-3 w-3" />
                        Network Analysis
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-6">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">
                                Birlikte Hareket Eden Hisseler
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Louvain topluluğu, hybrid benzerlik ve rolling stability metrikleri üzerinden
                                BIST hisselerinin ağ yapısını analiz eder.
                            </p>
                        </div>
                        {currentSnapshot && (
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: 'Hisse', value: currentSnapshot.metrics.node_count },
                                    { label: 'Bağlantı', value: currentSnapshot.metrics.edge_count },
                                    { label: 'Grup', value: currentSnapshot.metrics.community_count },
                                ].map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className="rounded-2xl border border-border/50 bg-[#0f0f0f] px-4 py-2 text-center"
                                    >
                                        <p className="text-lg font-bold text-foreground">{value}</p>
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                            {label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                        <Info className="h-3 w-3 shrink-0" />
                        Sonuçlar geçmiş fiyat verilerine dayanır. Yatırım tavsiyesi içermez.
                    </div>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 rounded-2xl border border-border/50 bg-[#080808] p-1.5">
                {[
                    { value: 'snapshot' as const, label: 'Piyasa Görünümü', icon: <BarChart3 className="h-4 w-4" /> },
                    { value: 'custom' as const, label: 'Özel Analiz', icon: <GitBranch className="h-4 w-4" /> },
                ].map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => setActiveMode(tab.value)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                            activeMode === tab.value
                                ? 'bg-[#1e1e1e] text-foreground shadow-md'
                                : 'text-muted-foreground hover:text-foreground/70'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Snapshot Paneli */}
            {activeMode === 'snapshot' && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-[#080808] px-5 py-3.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className="h-2 w-2 rounded-full bg-[#24a693] animate-pulse" />
                            Piyasa Görünümü
                        </div>
                        <div className="flex items-center gap-2">
                            <Select
                                value={selectedSnapshotMode}
                                onChange={(event) =>
                                    setSelectedSnapshotMode(event.target.value)
                                }
                            >
                                <option value="latest">Güncel</option>
                                {historicalSnapshots.map((snapshot) => (
                                    <option
                                        key={snapshot.snapshot_id}
                                        value={snapshot.snapshot_id}
                                    >
                                        {snapshot.snapshot_id} ·{' '}
                                        {formatDateLabel(snapshot.created_at)}
                                    </option>
                                ))}
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    void latestSnapshotQuery.refetch()
                                    void snapshotsQuery.refetch()
                                    if (selectedSnapshotMode !== 'latest') {
                                        void snapshotDetailQuery.refetch()
                                    }
                                }}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Yenile
                            </Button>
                        </div>
                    </div>

                    {(latestSnapshotQuery.isLoading && selectedSnapshotMode === 'latest') ||
                    (snapshotDetailQuery.isLoading && selectedSnapshotMode !== 'latest') ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-2xl" />
                            ))}
                        </div>
                    ) : currentSnapshot ? (
                        <SnapshotExplorerView
                            key={`${selectedSnapshotMode}-${currentSnapshot.snapshot.snapshot_id}`}
                            snapshot={currentSnapshot}
                            snapshotMode={selectedSnapshotMode}
                        />
                    ) : latestSnapshotQuery.isError ||
                      snapshotDetailQuery.isError ||
                      snapshotsQuery.isError ? (
                        <ErrorCard
                            title="Snapshot verisi yüklenemedi"
                            message={
                                String(
                                    latestSnapshotQuery.error ??
                                        snapshotDetailQuery.error ??
                                        snapshotsQuery.error
                                ) || 'Bilinmeyen hata'
                            }
                        />
                    ) : null}
                </div>
            )}

            {/* Özel Analiz Paneli */}
            {activeMode === 'custom' && (
                <div className="space-y-5">
                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
                        <div className="border-b border-border/50 px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="rounded-lg bg-[#2862ff]/10 p-1.5 text-[#2862ff]">
                                    <GitBranch className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Özel Analiz</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Seçtiğiniz hisseler için co-movement pipeline çalıştırın.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 px-5 py-5">
                            <CoMovementSymbolPicker
                                label="Analiz hisseleri"
                                helperText="Minimum 2 hisse seçin. Büyük sepetlerde sonuçlar graph ve tablolar üzerinden özetlenir."
                                selectedSymbols={customSymbols}
                                onChange={setCustomSymbols}
                                disabled={analyzeMutation.isPending}
                            />

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Başlangıç
                                    </span>
                                    <Input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(event) =>
                                            setCustomStartDateOverride(event.target.value)
                                        }
                                        disabled={analyzeMutation.isPending}
                                        className="h-9 text-sm"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Bitiş
                                    </span>
                                    <Input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(event) =>
                                            setCustomEndDateOverride(event.target.value)
                                        }
                                        disabled={analyzeMutation.isPending}
                                        className="h-9 text-sm"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Top K
                                    </span>
                                    <Select
                                        value={String(customTopK)}
                                        onChange={(event) =>
                                            setCustomTopK(Number(event.target.value))
                                        }
                                        disabled={analyzeMutation.isPending}
                                    >
                                        {[2, 3, 4, 5, 6].map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </Select>
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Rolling
                                    </span>
                                    <Select
                                        value={String(customRollingWindow)}
                                        onChange={(event) =>
                                            setCustomRollingWindow(Number(event.target.value))
                                        }
                                        disabled={analyzeMutation.isPending}
                                    >
                                        {[60, 90, 120, 180].map((value) => (
                                            <option key={value} value={value}>
                                                {value} gün
                                            </option>
                                        ))}
                                    </Select>
                                </label>
                            </div>

                            <div className="space-y-2 rounded-2xl border border-border/50 bg-[#0a0a0a] px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Min Benzerlik
                                    </span>
                                    <span className="text-sm font-bold text-foreground">
                                        {customMinSimilarity.toFixed(2)}
                                    </span>
                                </div>
                                <Input
                                    type="range"
                                    min="0.3"
                                    max="0.95"
                                    step="0.05"
                                    value={customMinSimilarity}
                                    onChange={(event) =>
                                        setCustomMinSimilarity(Number(event.target.value))
                                    }
                                    disabled={analyzeMutation.isPending}
                                    className="h-2 w-full cursor-pointer border-0 bg-transparent px-0 accent-[#2862ff]"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground/50">
                                    <span>0.30</span>
                                    <span>0.95</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleRunAnalysis()}
                                disabled={
                                    analyzeMutation.isPending ||
                                    customSymbols.length < 2 ||
                                    !customStartDate ||
                                    !customEndDate
                                }
                                className={cn(
                                    'relative w-full overflow-hidden rounded-2xl px-6 py-3.5 text-sm font-semibold text-white transition-all',
                                    'disabled:cursor-not-allowed disabled:opacity-50',
                                    'bg-gradient-to-r from-[#2862ff] to-[#1a4fd9]',
                                    'hover:from-[#3570ff] hover:to-[#2060e8]',
                                    'active:scale-[0.99]',
                                    analyzeMutation.isPending && 'animate-pulse-glow'
                                )}
                            >
                                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {analyzeMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Analiz Çalışıyor...
                                        </>
                                    ) : (
                                        <>
                                            <BarChart3 className="h-4 w-4" />
                                            Analizi Çalıştır
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>

                    {analyzeMutation.isError ? (
                        <ErrorCard
                            title="Analiz başarısız oldu"
                            message={
                                analyzeMutation.error instanceof Error
                                    ? analyzeMutation.error.message
                                    : 'İstek tamamlanamadı.'
                            }
                        />
                    ) : null}

                    {!customResult && !analyzeMutation.isPending ? (
                        <EmptyCard
                            title="Özel analiz henüz çalıştırılmadı"
                            description="Hisse sepetini ve tarih aralığını belirledikten sonra tam co-movement pipeline çıktıları burada gösterilecek."
                            icon={<GitBranch className="h-5 w-5" />}
                        />
                    ) : null}

                    {customResult ? (
                        <div className="space-y-4">
                            {analysisSummaryCards(customResult)}

                            <div className="grid gap-3 md:grid-cols-3">
                                <StatCard
                                    label="Tarih Aralığı"
                                    value={`${formatDateLabel(customResult.date_range.start)} → ${formatDateLabel(customResult.date_range.end)}`}
                                    hint={`Hizalanmış: ${formatDateLabel(customResult.date_range.aligned_start)} → ${formatDateLabel(customResult.date_range.aligned_end)}`}
                                />
                                <StatCard
                                    label="İstenen Hisse"
                                    value={String(customResult.requested_symbols.length)}
                                    hint={`${customResult.symbols.length} kullanılabilir hisse`}
                                />
                                <StatCard
                                    label="Yapılandırma"
                                    value={`top_k ${customResult.config.top_k}`}
                                    hint={`min sim ${formatNumber(customResult.config.min_similarity, 2)} · rolling ${customResult.config.rolling_window}`}
                                />
                            </div>

                            {/* Analiz grafiği + topluluk kenar paneli */}
                            <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
                                <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2862ff]/10 text-[#2862ff]">
                                            <Network className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Analiz Grafiği</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {customGraphData.nodes.length} hisse · {customGraphData.edges.length} bağlantı
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                                        {(['market', 'focus'] as const).map((scope) => (
                                            <button
                                                key={scope}
                                                type="button"
                                                onClick={() => setCustomGraphScope(scope)}
                                                className={cn(
                                                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                                                    customGraphScope === scope
                                                        ? 'bg-[#1e1e1e] text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground/70'
                                                )}
                                            >
                                                {scope === 'market' ? 'Tüm' : 'Odaklı'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex" style={{ height: 500 }}>
                                    <div className="relative min-w-0 flex-1 overflow-hidden">
                                        <CoMovementGraph
                                            title=""
                                            description=""
                                            nodes={customGraphData.nodes}
                                            edges={customGraphData.edges}
                                            selectedNodeId={effectiveSelectedAnalysisNodeId}
                                            onSelectNode={setSelectedAnalysisNodeId}
                                            height={500}
                                            bare
                                        />
                                    </div>

                                    <div className="flex w-[270px] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-[#060606]">
                                        {selectedAnalysisNodeId ? (
                                            <NodeDetailCard
                                                result={customResult}
                                                selectedNodeId={selectedAnalysisNodeId}
                                                visibleNodes={customGraphData.nodes}
                                                visibleEdges={customGraphData.edges}
                                                onClose={() => setSelectedAnalysisNodeId(null)}
                                            />
                                        ) : (
                                            <>
                                                <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                                        Topluluklar
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground/50">
                                                        {customResult.communities.length} grup
                                                    </span>
                                                </div>
                                                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                                                    {customResult.communities.map((community) => {
                                                        const color = communityColor(community.community_id)
                                                        const isSelected = selectedCustomCommunityId === community.community_id
                                                        const { visible } = compactStockPreview(community.stocks, 4)
                                                        return (
                                                            <button
                                                                key={community.community_id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setCustomGraphScope('focus')
                                                                    setSelectedCustomCommunityId(community.community_id)
                                                                }}
                                                                className="relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all"
                                                                style={{
                                                                    borderLeftWidth: 3,
                                                                    borderLeftColor: color,
                                                                    borderTopColor: isSelected ? `${color}40` : 'transparent',
                                                                    borderRightColor: isSelected ? `${color}40` : 'transparent',
                                                                    borderBottomColor: isSelected ? `${color}40` : 'transparent',
                                                                    backgroundColor: isSelected ? `${color}0a` : 'rgba(255,255,255,0.01)',
                                                                }}
                                                            >
                                                                {isSelected && (
                                                                    <div
                                                                        className="pointer-events-none absolute inset-0"
                                                                        style={{
                                                                            background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${color}10, transparent)`,
                                                                        }}
                                                                    />
                                                                )}
                                                                <div className="relative flex items-center justify-between gap-1.5">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span
                                                                            className="h-2 w-2 shrink-0 rounded-full"
                                                                            style={{ backgroundColor: color }}
                                                                        />
                                                                        <span className="text-xs font-semibold text-foreground">
                                                                            G{community.community_id}
                                                                        </span>
                                                                        <span className="rounded border border-border/40 px-1 text-[9px] text-muted-foreground/60">
                                                                            {community.size}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-cyan-300/70">
                                                                        {formatNumber(community.avg_similarity, 3)}
                                                                    </span>
                                                                </div>
                                                                <div className="relative mt-1.5 flex flex-wrap gap-1">
                                                                    {visible.map((stock) => (
                                                                        <span
                                                                            key={stock}
                                                                            className="rounded px-1 py-0.5 text-[9px] font-medium"
                                                                            style={{
                                                                                backgroundColor: `${color}18`,
                                                                                color: color,
                                                                                border: `1px solid ${color}30`,
                                                                            }}
                                                                        >
                                                                            {stock}
                                                                        </span>
                                                                    ))}
                                                                    {community.stocks.length > 4 && (
                                                                        <span className="rounded border border-border/40 px-1 py-0.5 text-[9px] text-muted-foreground/50">
                                                                            +{community.stocks.length - 4}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 border-t border-border/40 px-5 py-2.5 text-[10px] text-muted-foreground/50">
                                    <span>Node rengi community kimliğini gösterir</span>
                                    <span>Kenar kalınlığı hybrid similarity ağırlığını gösterir</span>
                                </div>
                            </div>

                            <PairsTable
                                title="En Güçlü Eşleşmeler"
                                description="Hybrid similarity skoruna göre sıralanan eşleşmeler."
                                pairs={customResult.top_pairs}
                                limit={15}
                            />

                            <div className="overflow-hidden rounded-2xl border border-border/60">
                                <div className="px-5 py-4">
                                    <MatrixTabsPanel
                                        title="Matris Görünümleri"
                                        description={`Heatmap okunabilirliği için ${customMatrixSymbols.length} hisselik en güçlü ilişki sepeti gösteriliyor.`}
                                        symbols={customMatrixSymbols}
                                        matrices={customMatrixPanels}
                                    />
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-border/60">
                                <div className="border-b border-border/50 px-5 py-4">
                                    <p className="text-sm font-semibold text-foreground">Detaylar</p>
                                    <p className="text-[11px] text-muted-foreground">Pair sıralamaları · Rolling stability · Veri kalitesi</p>
                                </div>
                                <div className="space-y-4 px-5 py-5">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <PairRankingsCard rankings={customResult.pair_rankings} />
                                        <RollingStabilityCard rows={customResult.rolling_stability} />
                                    </div>
                                    <QualityCard result={customResult} />
                                </div>
                            </div>

                            <ExplanationCard
                                title="Sonuç Yorumu"
                                explanation={analysisExplanation}
                                onGenerate={() =>
                                    void analysisExplainMutation
                                        .mutateAsync({
                                            top_pairs: customResult.top_pairs,
                                            communities: customResult.communities,
                                            metrics: customResult.metrics,
                                            language: 'tr',
                                            symbols: customResult.symbols,
                                            date_range: customResult.date_range,
                                        })
                                        .then(setAnalysisExplanation)
                                }
                                isLoading={analysisExplainMutation.isPending}
                                disabled={analysisExplainMutation.isPending}
                            />
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    )
}
