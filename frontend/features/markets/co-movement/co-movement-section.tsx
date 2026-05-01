'use client'

import { useMemo, useState } from 'react'
import {
    AlertCircle,
    BarChart3,
    FileText,
    GitBranch,
    Loader2,
    Network,
    RefreshCw,
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
}: {
    label: string
    value: string
    hint?: string
    tone?: 'default' | 'success' | 'warning'
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {label}
            </p>
            <p
                className={cn(
                    'mt-2 text-2xl font-semibold tracking-tight',
                    tone === 'success'
                        ? 'text-emerald-300'
                        : tone === 'warning'
                          ? 'text-amber-200'
                          : 'text-foreground'
                )}
            >
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    )
}

function ErrorCard({ title, message }: { title: string; message: string }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-destructive/90">{message}</p>
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
        <Card className="border-dashed border-border/60 bg-card/60 shadow-none">
            <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="rounded-full border border-border/60 bg-background/50 p-3 text-muted-foreground">
                    {icon}
                </div>
                <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">{title}</p>
                    <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
                </div>
            </CardContent>
        </Card>
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
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription>
                            Hesaplanan metriklerin kısa bir yorumunu üretir.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onGenerate}
                        disabled={disabled || isLoading}
                        className="gap-2"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="h-4 w-4" />
                        )}
                        Yorum Üret
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                {explanation ? (
                    <>
                        <p className="text-sm leading-6 text-foreground/90">
                            {explanation.summary}
                        </p>
                        <div className="space-y-2">
                            {explanation.warnings.map((warning) => (
                                <div
                                    key={warning}
                                    className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                                >
                                    {warning}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                            <span>Kaynak: {explanation.source}</span>
                            <span>Model: {explanation.model ?? 'fallback'}</span>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Sonuçlar hazır olduğunda bu alandan yorum alınabilir. Çıktı yalnızca
                        hesaplanan metrikleri açıklar; yatırım tavsiyesi içermez.
                    </p>
                )}
            </CardContent>
        </Card>
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
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Tabs defaultValue={matrices[0]?.key}>
                <TabsList className="h-auto flex-wrap gap-2 rounded-2xl bg-muted/40 p-1.5">
                    {matrices.map((item) => (
                        <TabsTrigger
                            key={item.key}
                            value={item.key}
                            className="rounded-xl px-3 py-2 text-xs"
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
}: {
    title: string
    description: string
    pairs: CoMovementPair[]
    limit?: number
}) {
    const rows = pairs.slice(0, limit)

    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pair</TableHead>
                            <TableHead className="text-right">Hybrid</TableHead>
                            <TableHead className="text-right">Pearson</TableHead>
                            <TableHead className="text-right">DTW</TableHead>
                            <TableHead className="text-right">Spearman</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                    Pair verisi bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((pair) => (
                                <TableRow key={`${pair.source}-${pair.target}`}>
                                    <TableCell className="font-medium">
                                        {pair.source}
                                        <span className="mx-2 text-muted-foreground/60">vs</span>
                                        {pair.target}
                                    </TableCell>
                                    <TableCell className="text-right text-cyan-200">
                                        {formatNumber(pair.hybrid_similarity, 3)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(pair.pearson, 3)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(pair.dtw_similarity, 3)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(pair.spearman, 3)}
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

function PairRankingsCard({
    rankings,
}: {
    rankings: CoMovementPairRankings
}) {
    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Pair Rankings</CardTitle>
                <CardDescription>
                    Farklı skor kümelerine göre sıralanan öne çıkan hisse çiftleri.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Tabs defaultValue="hybrid">
                    <TabsList className="h-auto flex-wrap gap-2 rounded-2xl bg-muted/40 p-1.5">
                        <TabsTrigger value="hybrid" className="rounded-xl px-3 py-2 text-xs">
                            Hybrid
                        </TabsTrigger>
                        <TabsTrigger value="pearson" className="rounded-xl px-3 py-2 text-xs">
                            Pearson
                        </TabsTrigger>
                        <TabsTrigger value="dtw" className="rounded-xl px-3 py-2 text-xs">
                            DTW
                        </TabsTrigger>
                    </TabsList>

                    {(['hybrid', 'pearson', 'dtw'] as const).map((key) => (
                        <TabsContent key={key} value={key} className="mt-4">
                            <PairsTable
                                title={`${key.toUpperCase()} sıralaması`}
                                description="İlk 12 eşleşme gösteriliyor."
                                pairs={rankings[key]}
                                limit={12}
                            />
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
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
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Topluluklar</CardTitle>
                <CardDescription>
                    Louvain tabanlı gruplar ve grup içi ortalama benzerlik görünümü.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
                {communities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Community verisi bulunamadı.</p>
                ) : (
                    communities.slice(0, limit).map((community) => {
                        const avgEdge = averageEdgeWeight(community, edges)
                        const isSelected = selectedCommunityId === community.community_id

                        return (
                            <button
                                key={community.community_id}
                                type="button"
                                onClick={() => onSelect?.(community.community_id)}
                                className={cn(
                                    'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                                    isSelected
                                        ? 'border-primary/40 bg-primary/10'
                                        : 'border-border/50 bg-background/40 hover:border-border/70 hover:bg-muted/20'
                                )}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="inline-block h-3 w-3 rounded-full"
                                            style={{
                                                backgroundColor: communityColor(
                                                    community.community_id
                                                ),
                                            }}
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Community {community.community_id}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {community.size} hisse
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 text-xs text-muted-foreground">
                                        <span>Avg sim: {formatNumber(community.avg_similarity, 3)}</span>
                                        <span>Avg edge: {formatNumber(avgEdge, 3)}</span>
                                    </div>
                                </div>
                                <p className="mt-3 line-clamp-2 text-xs leading-6 text-muted-foreground">
                                    {community.stocks.join(', ')}
                                </p>
                            </button>
                        )
                    })
                )}
            </CardContent>
        </Card>
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
}: {
    result: CoMovementResult
    selectedNodeId: string | null
    visibleNodes?: CoMovementResult['graph']['nodes']
    visibleEdges?: CoMovementResult['graph']['edges']
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

    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Hisse Detayı</CardTitle>
                <CardDescription>
                    Seçili hissenin community ve en güçlü bağlantıları.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                {!node ? (
                    <p className="text-sm text-muted-foreground">
                        Grafikten bir hisse seçildiğinde bağlantılar burada görünür.
                    </p>
                ) : (
                    <>
                        <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-lg font-semibold text-foreground">
                                        {node.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Community {node.community_id ?? '—'}
                                    </p>
                                </div>
                                <span
                                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs text-muted-foreground"
                                >
                                    <span
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{
                                            backgroundColor: communityColor(node.community_id),
                                        }}
                                    />
                                    {community?.size ?? 0} hisse
                                </span>
                            </div>
                            <p className="mt-3 text-xs leading-6 text-muted-foreground">
                                Bu community içinde {community?.size ?? 0} hisse var.
                            </p>
                            {communityPreview.visible.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {communityPreview.visible.map((stock) => (
                                        <span
                                            key={stock}
                                            className={cn(
                                                'rounded-md border px-2 py-1 text-[11px]',
                                                stock === node.id
                                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                                    : 'border-border/50 bg-background/50 text-muted-foreground'
                                            )}
                                        >
                                            {stock}
                                        </span>
                                    ))}
                                    {communityPreview.remaining > 0 ? (
                                        <span className="rounded-md border border-border/50 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
                                            +{communityPreview.remaining} diğer
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            {connections.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Bu hisse için kenar bulunamadı.
                                </p>
                            ) : (
                                connections.map((edge) => {
                                    const source = edgeSourceId(edge)
                                    const target = edgeTargetId(edge)
                                    const counterparty =
                                        source === selectedNodeId ? target : source

                                    return (
                                        <div
                                            key={`${source}-${target}`}
                                            className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-medium text-foreground">
                                                    {counterparty}
                                                </span>
                                                <span className="text-sm text-cyan-200">
                                                    {formatNumber(edge.weight, 3)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                                <span>Pearson {formatNumber(edge.pearson, 3)}</span>
                                                <span>DTW {formatNumber(edge.dtw_similarity, 3)}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function snapshotSummaryCards(snapshot: CoMovementSnapshotSummary) {
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Hisse"
                value={String(snapshot.metrics.node_count)}
                hint={`İstenen ${snapshot.requested_symbols.length} sembolden kullanılabilenler`}
            />
            <StatCard
                label="Community"
                value={String(snapshot.metrics.community_count)}
                hint={`${snapshot.metrics.edge_count} edge ile`}
            />
            <StatCard
                label="Modularity"
                value={formatNumber(snapshot.metrics.modularity, 3)}
                hint={snapshot.metrics.louvain_method}
                tone="success"
            />
            <StatCard
                label="Rolling Window"
                value={String(snapshot.metrics.rolling_window_count)}
                hint={`${snapshot.date_range.rows ?? 0} hizalanmış günlük satır`}
                tone="warning"
            />
        </div>
    )
}

function analysisSummaryCards(result: CoMovementAnalyzeResponse) {
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Hybrid Pair"
                value={String(result.top_pairs.length)}
                hint={`Pair count ${result.metrics.pair_count}`}
            />
            <StatCard
                label="Community"
                value={String(result.metrics.community_count)}
                hint={`${result.metrics.edge_count} edge`}
            />
            <StatCard
                label="Modularity"
                value={formatNumber(result.metrics.modularity, 3)}
                hint={result.metrics.louvain_method}
                tone="success"
            />
            <StatCard
                label="Excluded"
                value={String(result.excluded_symbols.length)}
                hint={`Rolling window ${result.metrics.rolling_window_count}`}
                tone="warning"
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
        <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                    {snapshotSummaryCards(snapshot)}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <StatCard
                            label="Date Range"
                            value={`${formatDateLabel(snapshot.date_range.start)} → ${formatDateLabel(snapshot.date_range.end)}`}
                            hint={`Aligned ${formatDateLabel(snapshot.date_range.aligned_start)} → ${formatDateLabel(snapshot.date_range.aligned_end)}`}
                        />
                        <StatCard
                            label="Snapshot Id"
                            value={snapshot.snapshot.snapshot_id}
                            hint={formatDateLabel(snapshot.snapshot.created_at)}
                        />
                        <StatCard
                            label="Config"
                            value={`top_k ${snapshot.config.top_k}`}
                            hint={`min sim ${formatNumber(snapshot.config.min_similarity, 2)} · rolling ${snapshot.config.rolling_window}`}
                        />
                    </div>
                </div>
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

            <Tabs defaultValue="overview" className="space-y-5">
                <TabsList className="h-auto flex-wrap gap-2 rounded-lg bg-muted/40 p-1">
                    <TabsTrigger value="overview" className="rounded-md px-4 py-2">
                        Özet
                    </TabsTrigger>
                    <TabsTrigger value="matrices" className="rounded-md px-4 py-2">
                        Matrisler
                    </TabsTrigger>
                    <TabsTrigger value="details" className="rounded-md px-4 py-2">
                        Detaylar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card className="border-border/60 bg-card/80 shadow-none">
                        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    Graph kapsamı
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {snapshotGraphScope === 'market'
                                        ? `${snapshot.metrics.node_count} hisse ve ${snapshot.metrics.edge_count} bağlantı ile tüm piyasa ağı gösteriliyor.`
                                        : `${snapshotGraphData.nodes.length} hisse ve ${snapshotGraphData.edges.length} bağlantı ile seçili odak gösteriliyor.`}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                        snapshotGraphScope === 'market'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => setSnapshotGraphScope('market')}
                                >
                                    Tüm Piyasa
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                        snapshotGraphScope === 'focus'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => setSnapshotGraphScope('focus')}
                                >
                                    Odaklı Graph
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                        <CoMovementGraph
                            title="Ağ Grafiği"
                            description={
                                snapshotGraphScope === 'market'
                                    ? 'Tüm hisseler ve community ilişkileri tek ağda gösterilir. Kalabalık görünümde etiketler sadece seçili node ve komşularında açılır.'
                                    : 'Seçili odaktaki hisseler gösterilir; renkler community bilgisini, çizgi kalınlığı hybrid similarity gücünü anlatır.'
                            }
                            nodes={snapshotGraphData.nodes}
                            edges={snapshotGraphData.edges}
                            selectedNodeId={effectiveSelectedSnapshotNodeId}
                            onSelectNode={setSelectedSnapshotNodeId}
                        />
                        <NodeDetailCard
                            result={snapshot}
                            selectedNodeId={effectiveSelectedSnapshotNodeId}
                            visibleNodes={snapshotGraphData.nodes}
                            visibleEdges={snapshotGraphData.edges}
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <CommunitiesCard
                            communities={snapshot.communities}
                            edges={snapshot.graph.edges}
                            selectedCommunityId={selectedCommunityId}
                            onSelect={(communityId) => {
                                setSnapshotGraphScope('focus')
                                setSnapshotFocusMode('community')
                                setSelectedCommunityId(communityId)
                            }}
                        />
                        <PairsTable
                            title="En Güçlü Eşleşmeler"
                            description="Hybrid similarity skoruna göre en yakın hareket eden hisseler."
                            pairs={snapshot.top_pairs}
                            limit={12}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="matrices" className="space-y-4">
                    <Card className="border-border/60 bg-card/80 shadow-none">
                        <CardHeader className="border-b border-border/50">
                            <CardTitle className="text-base">Matris Odağı</CardTitle>
                            <CardDescription>
                                Heatmap için küçük ve okunabilir bir hisse grubu seçin.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            <div className="grid gap-4 lg:grid-cols-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Odak</span>
                                    <Select
                                        value={snapshotFocusMode}
                                        onChange={(event) =>
                                            setSnapshotFocusMode(
                                                event.target.value as SnapshotFocusMode
                                            )
                                        }
                                        disabled={snapshotMode !== 'latest'}
                                    >
                                        <option value="community">Community</option>
                                        <option value="pair">Top pair çevresi</option>
                                        <option value="manual">Manuel seçim</option>
                                    </Select>
                                </label>

                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Community</span>
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
                                                {community.community_id} · {community.size} hisse
                                            </option>
                                        ))}
                                    </Select>
                                </label>

                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Top pair</span>
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
                                                {pair.source}-{pair.target}
                                            </option>
                                        ))}
                                    </Select>
                                </label>
                            </div>

                            {snapshotFocusMode === 'manual' ? (
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
                            ) : (
                                <div className="rounded-lg border border-border/60 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                                    Seçili sepet:{' '}
                                    <span className="font-medium text-foreground">
                                        {snapshotMatrixSymbols.join(', ')}
                                    </span>
                                </div>
                            )}

                            {snapshotMode !== 'latest' ? (
                                <div className="rounded-lg border border-dashed border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">
                                    Bu snapshot için summary gösteriliyor. Matris detayı latest
                                    pointer üzerinden okunabiliyor.
                                </div>
                            ) : (
                                <>
                                    <MatrixTabsPanel
                                        title="Ana Matrisler"
                                        description="Pearson, DTW Similarity ve Hybrid görünümü."
                                        symbols={snapshotMatrixSymbols}
                                        matrices={coreSnapshotMatrices}
                                    />

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-semibold text-foreground">
                                                    Ek Matrisler
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Spearman ve DTW Distance gerektiğinde açılır.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setShowAdvancedSnapshotMatrices(
                                                        (value) => !value
                                                    )
                                                }
                                            >
                                                {showAdvancedSnapshotMatrices ? 'Gizle' : 'Göster'}
                                            </Button>
                                        </div>

                                        {showAdvancedSnapshotMatrices ? (
                                            <MatrixTabsPanel
                                                title="Ek Matris Görünümleri"
                                                description="Spearman sıra korelasyonu ve DTW mesafe matrisi."
                                                symbols={snapshotMatrixSymbols}
                                                matrices={advancedSnapshotMatrices}
                                            />
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
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
                </TabsContent>
            </Tabs>
        </>
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

    const [customSymbols, setCustomSymbols] = useState<string[]>(DEFAULT_CUSTOM_SYMBOLS)
    const [customStartDateOverride, setCustomStartDateOverride] = useState<string | null>(
        null
    )
    const [customEndDateOverride, setCustomEndDateOverride] = useState<string | null>(null)
    const [customTopK, setCustomTopK] = useState(3)
    const [customMinSimilarity, setCustomMinSimilarity] = useState(0.6)
    const [customRollingWindow, setCustomRollingWindow] = useState(90)
    const [customResult, setCustomResult] = useState<CoMovementAnalyzeResponse | null>(null)
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
        setSelectedAnalysisNodeId(
            chooseDefaultNode(response.graph.nodes, response.graph.edges)
        )
        setAnalysisExplanation(null)
    }

    const effectiveSelectedAnalysisNodeId =
        customResult?.graph.nodes.some((node) => node.id === selectedAnalysisNodeId)
            ? selectedAnalysisNodeId
            : customResult
              ? chooseDefaultNode(customResult.graph.nodes, customResult.graph.edges)
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
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                        <Network className="h-3.5 w-3.5" />
                        Co-Movement
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            Birlikte hareket eden hisseler
                        </h2>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                            Önce piyasa snapshot&apos;ını inceleyin, sonra seçtiğiniz hisselerle
                            özel analiz çalıştırın. Graf, heatmap ve tablolar ayrı sekmelerde
                            tutulduğu için ekran daha okunabilir kalır.
                        </p>
                    </div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-100">
                    Sonuçlar geçmiş fiyat verilerine dayanır. Sistem hesaplama ve yorum
                    katmanlarını ayrı tutar; yatırım tavsiyesi üretmez.
                </div>
            </div>

            <Tabs defaultValue="snapshot">
                <TabsList className="h-auto flex-wrap gap-2 rounded-lg bg-muted/40 p-1">
                    <TabsTrigger value="snapshot" className="rounded-md px-4 py-2">
                        Piyasa Snapshot
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="rounded-md px-4 py-2">
                        Özel Analiz
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="snapshot" className="mt-6 space-y-6">
                    <Card className="border-border/60 bg-card/80 shadow-none">
                        <CardHeader className="border-b border-border/50">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                <div>
                                    <CardTitle className="text-base">Piyasa Snapshot</CardTitle>
                                    <CardDescription>
                                        Hazır piyasa analizini açar; geçmiş kayıtlar arasında
                                        geçiş yapılabilir.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="flex min-w-[260px] flex-col gap-1.5">
                                        <span className="text-xs text-muted-foreground">
                                            Snapshot
                                        </span>
                                        <Select
                                            value={selectedSnapshotMode}
                                            onChange={(event) =>
                                                setSelectedSnapshotMode(event.target.value)
                                            }
                                        >
                                            <option value="latest">Güncel snapshot</option>
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
                                    </label>
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
                                        <RefreshCw className="h-4 w-4" />
                                        Yenile
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            {(latestSnapshotQuery.isLoading &&
                                selectedSnapshotMode === 'latest') ||
                            (snapshotDetailQuery.isLoading &&
                                selectedSnapshotMode !== 'latest') ? (
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <Skeleton className="h-28 rounded-2xl" />
                                    <Skeleton className="h-28 rounded-2xl" />
                                    <Skeleton className="h-28 rounded-2xl" />
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
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="custom" className="mt-6 space-y-6">
                    <Card className="border-border/60 bg-card/80 shadow-none">
                        <CardHeader className="border-b border-border/50">
                            <CardTitle className="text-base">Özel Analiz</CardTitle>
                            <CardDescription>
                                Seçtiğiniz hisseler için co-movement çıktısını üretir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            <CoMovementSymbolPicker
                                label="Analiz hisseleri"
                                helperText="Minimum 2 hisse seçin. Büyük sepetlerde sonuçlar graph ve tablolar üzerinden özetlenir."
                                selectedSymbols={customSymbols}
                                onChange={setCustomSymbols}
                                disabled={analyzeMutation.isPending}
                            />

                            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                        Başlangıç
                                    </span>
                                    <Input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(event) =>
                                            setCustomStartDateOverride(event.target.value)
                                        }
                                        disabled={analyzeMutation.isPending}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Bitiş</span>
                                    <Input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(event) =>
                                            setCustomEndDateOverride(event.target.value)
                                        }
                                        disabled={analyzeMutation.isPending}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">top_k</span>
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
                                    <span className="text-xs text-muted-foreground">
                                        Rolling window
                                    </span>
                                    <Select
                                        value={String(customRollingWindow)}
                                        onChange={(event) =>
                                            setCustomRollingWindow(
                                                Number(event.target.value)
                                            )
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
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                        Min similarity
                                    </span>
                                    <div className="space-y-2 rounded-2xl border border-border/50 bg-background/50 px-3 py-2.5">
                                        <Input
                                            type="range"
                                            min="0.3"
                                            max="0.95"
                                            step="0.05"
                                            value={customMinSimilarity}
                                            onChange={(event) =>
                                                setCustomMinSimilarity(
                                                    Number(event.target.value)
                                                )
                                            }
                                            disabled={analyzeMutation.isPending}
                                            className="h-3 border-0 bg-transparent px-0"
                                        />
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>0.30</span>
                                            <span className="font-medium text-foreground">
                                                {customMinSimilarity.toFixed(2)}
                                            </span>
                                            <span>0.95</span>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="text-xs text-muted-foreground">
                                    Varsayılan sepet: {DEFAULT_CUSTOM_SYMBOLS.join(', ')}
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => void handleRunAnalysis()}
                                    disabled={
                                        analyzeMutation.isPending ||
                                        customSymbols.length < 2 ||
                                        !customStartDate ||
                                        !customEndDate
                                    }
                                    className="gap-2"
                                >
                                    {analyzeMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <BarChart3 className="h-4 w-4" />
                                    )}
                                    Analizi Çalıştır
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {analyzeMutation.isError ? (
                        <ErrorCard
                            title="Custom analysis başarısız oldu"
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
                        <>
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                                <div className="space-y-4">
                                    {analysisSummaryCards(customResult)}
                                    <div className="grid gap-4 lg:grid-cols-3">
                                        <StatCard
                                            label="Date Range"
                                            value={`${formatDateLabel(customResult.date_range.start)} → ${formatDateLabel(customResult.date_range.end)}`}
                                            hint={`Aligned ${formatDateLabel(customResult.date_range.aligned_start)} → ${formatDateLabel(customResult.date_range.aligned_end)}`}
                                        />
                                        <StatCard
                                            label="Requested"
                                            value={String(
                                                customResult.requested_symbols.length
                                            )}
                                            hint={`${customResult.symbols.length} kullanılabilir hisse`}
                                        />
                                        <StatCard
                                            label="Config"
                                            value={`top_k ${customResult.config.top_k}`}
                                            hint={`min sim ${formatNumber(customResult.config.min_similarity, 2)} · rolling ${customResult.config.rolling_window}`}
                                        />
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

                            <Tabs defaultValue="overview" className="space-y-5">
                                <TabsList className="h-auto flex-wrap gap-2 rounded-lg bg-muted/40 p-1">
                                    <TabsTrigger value="overview" className="rounded-md px-4 py-2">
                                        Özet
                                    </TabsTrigger>
                                    <TabsTrigger value="matrices" className="rounded-md px-4 py-2">
                                        Matrisler
                                    </TabsTrigger>
                                    <TabsTrigger value="details" className="rounded-md px-4 py-2">
                                        Detaylar
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                                        <CoMovementGraph
                                            title="Analiz Grafiği"
                                            description="Seçili hisseler için hybrid similarity ağı ve community renkleri."
                                            nodes={customResult.graph.nodes}
                                            edges={customResult.graph.edges}
                                            selectedNodeId={effectiveSelectedAnalysisNodeId}
                                            onSelectNode={setSelectedAnalysisNodeId}
                                            height={500}
                                        />
                                        <NodeDetailCard
                                            result={customResult}
                                            selectedNodeId={effectiveSelectedAnalysisNodeId}
                                            visibleNodes={customResult.graph.nodes}
                                            visibleEdges={customResult.graph.edges}
                                        />
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <CommunitiesCard
                                            communities={customResult.communities}
                                            edges={customResult.graph.edges}
                                        />
                                        <PairsTable
                                            title="En Güçlü Eşleşmeler"
                                            description="Hybrid similarity skoruna göre sıralanan eşleşmeler."
                                            pairs={customResult.top_pairs}
                                            limit={12}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="matrices" className="space-y-4">
                                    <MatrixTabsPanel
                                        title="Matris Görünümleri"
                                        description={`Heatmap okunabilirliği için ${customMatrixSymbols.length} hisselik en güçlü ilişki sepeti gösteriliyor.`}
                                        symbols={customMatrixSymbols}
                                        matrices={customMatrixPanels}
                                    />
                                </TabsContent>

                                <TabsContent value="details" className="space-y-4">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <PairRankingsCard rankings={customResult.pair_rankings} />
                                        <RollingStabilityCard rows={customResult.rolling_stability} />
                                    </div>

                                    <QualityCard result={customResult} />
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : null}
                </TabsContent>
            </Tabs>
        </section>
    )
}
