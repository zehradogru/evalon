'use client'

import { useId, useMemo, useState } from 'react'
import {
    AlertCircle,
    BarChart3,
    ChevronDown,
    FolderOpen,
    GitBranch,
    List,
    Loader2,
    Network,
    Pencil,
    RefreshCw,
    Save,
    Search,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    useAnalyzeCoMovement,
    useLatestCoMovementMatrix,
    useLatestCoMovementSnapshot,
} from '@/hooks/use-co-movement'
import {
    useDeleteSavedCoMovementAnalysis,
    useOpenSavedCoMovementAnalysis,
    useRenameSavedCoMovementAnalysis,
    useSaveCoMovementAnalysis,
    useSavedCoMovementAnalyses,
} from '@/hooks/use-co-movement-saved-analyses'
import type {
    SavedCoMovementAnalysisSummary,
    SavedCoMovementExplainScope,
} from '@/services/co-movement-saved-analyses.service'
import { streamCoMovementExplanation } from '@/services/co-movement.service'
import { useAuthStore } from '@/store/use-auth-store'
import { cn } from '@/lib/utils'
import type {
    CoMovementAnalyzeRequest,
    CoMovementAnalyzeResponse,
    CoMovementCommunity,
    CoMovementExplainRequest,
    CoMovementExplainResponse,
    CoMovementInsightContext,
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
type ExplainScope =
    | { type: 'market'; label: string; description: string }
    | { type: 'community'; label: string; description: string; community: CoMovementCommunity }
    | { type: 'pair'; label: string; description: string; pair: CoMovementPair }
    | { type: 'symbols'; label: string; description: string; symbols: string[] }
type GraphSearchNode = CoMovementResult['graph']['nodes'][number]

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

function isOrderedDateRange(start?: string, end?: string) {
    if (!start || !end) return false

    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false

    return startTime <= endTime
}

function filterPairsInsideSymbols(pairs: CoMovementPair[], symbols: string[], limit = 20) {
    const symbolSet = new Set(symbols)
    return pairs
        .filter((pair) => symbolSet.has(pair.source) && symbolSet.has(pair.target))
        .slice(0, limit)
}

function isSamePair(left: CoMovementPair, right: CoMovementPair) {
    return (
        (left.source === right.source && left.target === right.target) ||
        (left.source === right.target && left.target === right.source)
    )
}

function filterPairsForScope(
    pairs: CoMovementPair[],
    scope: ExplainScope,
    limit = 24
) {
    if (scope.type === 'market') return pairs.slice(0, limit)

    if (scope.type === 'pair') {
        const exact = pairs.filter((pair) => isSamePair(pair, scope.pair))
        return (exact.length > 0 ? exact : [scope.pair]).slice(0, limit)
    }

    const symbols =
        scope.type === 'community' ? scope.community.stocks : scope.symbols
    return filterPairsInsideSymbols(pairs, symbols, limit)
}

function buildScopedPairRankings(
    rankings: CoMovementPairRankings,
    scope: ExplainScope
): CoMovementPairRankings {
    return {
        hybrid: filterPairsForScope(rankings.hybrid, scope, 24),
        pearson: filterPairsForScope(rankings.pearson, scope, 24),
        dtw: filterPairsForScope(rankings.dtw, scope, 24),
    }
}

function filterRollingRowsInsideSymbols(
    rows: CoMovementRollingStabilityRow[],
    symbols: string[],
    limit = 12
) {
    const symbolSet = new Set(symbols)
    return rows
        .filter((row) => symbolSet.has(row.source) && symbolSet.has(row.target))
        .slice(0, limit)
}

function buildQualitySummary(rows: CoMovementResult['data_quality']) {
    if (rows.length === 0) {
        return {
            row_count: 0,
            worst_missing: [],
        }
    }

    const totalMissing = rows.reduce((total, row) => total + row.missing_ratio, 0)
    const maxMissing = Math.max(...rows.map((row) => row.missing_ratio))

    return {
        row_count: rows.length,
        average_missing_ratio: Number((totalMissing / rows.length).toFixed(6)),
        max_missing_ratio: Number(maxMissing.toFixed(6)),
        worst_missing: topMissingRows(rows, 8),
    }
}

function buildInsightContext(
    result: CoMovementResult,
    scope: ExplainScope,
    symbols: string[],
    topPairs: CoMovementPair[],
    communities: CoMovementCommunity[]
): CoMovementInsightContext {
    const symbolSet = new Set(symbols)
    const scopedRankings = buildScopedPairRankings(result.pair_rankings, scope)
    const scopedQualityRows =
        scope.type === 'market'
            ? result.data_quality
            : result.data_quality.filter((row) => symbolSet.has(row.symbol))
    const scopedExcludedRows =
        scope.type === 'market'
            ? result.excluded_symbols
            : result.excluded_symbols.filter((row) => symbolSet.has(row.symbol))
    const scopedRollingRows =
        scope.type === 'market'
            ? result.rolling_stability.slice(0, 12)
            : filterRollingRowsInsideSymbols(result.rolling_stability, symbols, 12)
    const densestCommunities = [...communities]
        .sort(
            (left, right) =>
                right.avg_similarity - left.avg_similarity ||
                right.size - left.size ||
                left.community_id - right.community_id
        )
        .slice(0, 5)

    return {
        scope: {
            type: scope.type,
            label: scope.label,
            description: scope.description,
            symbol_count: symbols.length,
            pair_count: topPairs.length,
        },
        date_range: result.date_range,
        config: result.config,
        rankings: {
            hybrid: scopedRankings.hybrid.slice(0, 8),
            pearson: scopedRankings.pearson.slice(0, 8),
            dtw: scopedRankings.dtw.slice(0, 8),
        },
        rolling_stability: scopedRollingRows,
        data_quality: buildQualitySummary(scopedQualityRows),
        excluded_symbols: {
            count: scopedExcludedRows.length,
            samples: scopedExcludedRows.slice(0, 8),
        },
        communities: {
            largest:
                [...communities].sort(
                    (left, right) =>
                        right.size - left.size ||
                        right.avg_similarity - left.avg_similarity ||
                        left.community_id - right.community_id
                )[0] ?? null,
            densest: densestCommunities,
        },
        graph: {
            node_count: result.metrics.node_count,
            edge_count: result.metrics.edge_count,
        },
        notes: [
            'Yorum yalnızca hesaplanmış co-movement metriklerine dayanır.',
            'Pair rankingleri hybrid, Pearson ve DTW metriklerinde ayrı sıralanır.',
        ],
    }
}

function filterCommunitiesBySymbols(
    communities: CoMovementCommunity[],
    symbols: string[],
    limit = 6
) {
    const symbolSet = new Set(symbols)
    return communities
        .filter((community) => community.stocks.some((stock) => symbolSet.has(stock)))
        .map((community) => {
            const stocks = community.stocks.filter((stock) => symbolSet.has(stock))
            return {
                ...community,
                stocks,
                size: stocks.length,
            }
        })
        .filter((community) => community.size > 0)
        .slice(0, limit)
}

function getNodeNeighborhoodSymbols(
    result: CoMovementResult,
    nodeId: string | null,
    limit = 12
) {
    if (!nodeId) return []

    const ordered = [nodeId]
    const relatedEdges = result.graph.edges
        .map((edge) => ({
            source: edgeSourceId(edge),
            target: edgeTargetId(edge),
            weight: edge.weight,
        }))
        .filter((edge) => edge.source === nodeId || edge.target === nodeId)
        .sort((left, right) => right.weight - left.weight)

    for (const edge of relatedEdges) {
        const candidate = edge.source === nodeId ? edge.target : edge.source
        if (!ordered.includes(candidate)) ordered.push(candidate)
        if (ordered.length >= limit) break
    }

    return ordered
}

function getExplainScopeKey(scope: ExplainScope) {
    if (scope.type === 'community') {
        return `community:${scope.community.community_id}`
    }
    if (scope.type === 'pair') {
        return `pair:${createPairKey(scope.pair.source, scope.pair.target)}`
    }
    if (scope.type === 'symbols') {
        return `symbols:${scope.symbols.join(',')}`
    }
    return 'market'
}

function toSavedExplainScope(scope: ExplainScope): SavedCoMovementExplainScope {
    const base = {
        type: scope.type,
        key: getExplainScopeKey(scope),
        label: scope.label,
        description: scope.description,
    }

    if (scope.type === 'community') {
        return {
            ...base,
            communityId: scope.community.community_id,
        }
    }
    if (scope.type === 'pair') {
        return {
            ...base,
            pairKey: createPairKey(scope.pair.source, scope.pair.target),
        }
    }
    if (scope.type === 'symbols') {
        return {
            ...base,
            symbols: scope.symbols,
        }
    }

    return base
}

function buildScopedExplainPayload(
    result: CoMovementResult,
    scope: ExplainScope
): CoMovementExplainRequest {
    let symbols = result.symbols
    let topPairs = result.top_pairs.slice(0, 20)
    let communities = result.communities.slice(0, 8)

    if (scope.type === 'community') {
        symbols = scope.community.stocks
        topPairs = filterPairsInsideSymbols(result.top_pairs, symbols, 20)
        communities = [scope.community]
    } else if (scope.type === 'pair') {
        symbols = [scope.pair.source, scope.pair.target]
        topPairs = [scope.pair]
        communities = filterCommunitiesBySymbols(result.communities, symbols, 4)
    } else if (scope.type === 'symbols') {
        symbols = scope.symbols
        topPairs = filterPairsInsideSymbols(result.top_pairs, symbols, 20)
        communities = filterCommunitiesBySymbols(result.communities, symbols, 6)
    }

    const metrics = {
        ...result.metrics,
        focus_scope: scope.type,
        focus_label: scope.label,
        focus_description: scope.description,
        focus_symbol_count: symbols.length,
        focus_pair_count: topPairs.length,
    } as CoMovementExplainRequest['metrics']

    return {
        top_pairs: topPairs,
        communities,
        metrics,
        language: 'tr',
        symbols,
        date_range: result.date_range,
        insight_context: buildInsightContext(result, scope, symbols, topPairs, communities),
    }
}

function AnalysisReadinessStrip({
    ready,
    issues,
    items,
}: {
    ready: boolean
    issues: string[]
    items: Array<{ label: string; value: string }>
}) {
    const status = ready ? 'Analize hazır' : issues[0] ?? 'Eksik bilgi var'

    return (
        <div
            className={cn(
                'rounded-2xl border px-4 py-3',
                ready
                    ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                    : 'border-amber-500/25 bg-amber-500/[0.04]'
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span
                        className={cn(
                            'h-2.5 w-2.5 shrink-0 rounded-full',
                            ready ? 'bg-emerald-400' : 'bg-amber-400'
                        )}
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{status}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {ready
                                ? 'Sepet, dönem ve ayarlar kontrol edildi.'
                                : 'Eksik alan tamamlanınca analiz çalıştırılabilir.'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {items.map((item) => (
                        <span
                            key={item.label}
                            className="rounded-lg border border-border/40 bg-[#080808] px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                            <span className="text-muted-foreground/50">{item.label}</span>{' '}
                            <span className="font-medium text-foreground">{item.value}</span>
                        </span>
                    ))}
                </div>
            </div>
            {!ready && issues.length > 1 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                    {issues.slice(1).map((issue) => (
                        <span key={issue} className="text-[11px] text-amber-200/80">
                            {issue}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function GraphFocusBar({
    label,
    description,
    isFocused,
    onReset,
}: {
    label: string
    description: string
    isFocused: boolean
    onReset: () => void
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-[#060606] px-5 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground/50">Odak</span>
                <span className="font-semibold text-foreground">{label}</span>
                <span className="text-muted-foreground/60">{description}</span>
            </div>
            {isFocused ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                    Tüm piyasaya dön
                </Button>
            ) : null}
        </div>
    )
}

function GraphNodeSearch({
    nodes,
    value,
    onValueChange,
    onSelectNode,
    placeholder = "Graph'ta hisse ara...",
}: {
    nodes: GraphSearchNode[]
    value: string
    onValueChange: (value: string) => void
    onSelectNode: (nodeId: string | null) => void
    placeholder?: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const trimmedValue = value.trim()
    const normalizedValue = trimmedValue.toUpperCase()
    const matches = useMemo(() => {
        if (!normalizedValue) return []

        return nodes
            .filter((node) => {
                const searchable = `${node.id} ${node.label}`.toUpperCase()
                return searchable.includes(normalizedValue)
            })
            .slice(0, 8)
    }, [nodes, normalizedValue])

    const selectNode = (node: GraphSearchNode) => {
        onValueChange(node.id)
        onSelectNode(node.id)
        setIsOpen(false)
    }

    const clearSearch = () => {
        onValueChange('')
        onSelectNode(null)
        setIsOpen(false)
    }

    return (
        <div className="relative w-full sm:w-64 xl:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value)
                    setIsOpen(true)
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => {
                    window.setTimeout(() => setIsOpen(false), 120)
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault()
                        if (matches[0]) {
                            selectNode(matches[0])
                        }
                    } else if (event.key === 'Escape') {
                        setIsOpen(false)
                    }
                }}
                disabled={nodes.length === 0}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-8 rounded-xl border-border/50 bg-[#111111] pl-8 pr-8 text-xs"
            />
            {trimmedValue ? (
                <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    aria-label="Graph aramasını temizle"
                >
                    <X className="h-3 w-3" />
                </button>
            ) : null}
            {isOpen && trimmedValue ? (
                <div className="absolute right-0 z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border/70 bg-[#0b0b0b] shadow-xl">
                    {matches.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            Görünen graph içinde eşleşme yok.
                        </div>
                    ) : (
                        matches.map((node) => (
                            <button
                                key={node.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectNode(node)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: communityColor(node.community_id) }}
                                    />
                                    <span className="truncate font-medium text-foreground">
                                        {node.id}
                                    </span>
                                </span>
                                <span className="truncate text-[11px] text-muted-foreground">
                                    {node.label}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    )
}

function formatCoMovementUserError(message: string) {
    const normalized = message.toLowerCase()

    if (
        normalized.includes('failed to fetch') ||
        normalized.includes('network') ||
        normalized.includes('econnrefused') ||
        normalized.includes('timeout')
    ) {
        return 'Analiz servisine şu anda ulaşılamıyor. Bağlantıyı kontrol edip tekrar deneyin.'
    }

    if (
        normalized.includes('at least 2') ||
        normalized.includes('minimum 2') ||
        normalized.includes('min 2') ||
        normalized.includes('2 symbols') ||
        normalized.includes('two symbols')
    ) {
        return 'Analiz için en az 2 hisse seçmeniz gerekiyor.'
    }

    if (
        normalized.includes('date') ||
        normalized.includes('start') ||
        normalized.includes('end')
    ) {
        return 'Tarih aralığını kontrol edin. Başlangıç tarihi bitiş tarihinden sonra olamaz.'
    }

    if (
        normalized.includes('insufficient') ||
        normalized.includes('not enough') ||
        normalized.includes('history') ||
        normalized.includes('no data')
    ) {
        return 'Seçilen hisse veya dönem için yeterli fiyat verisi bulunamadı. Daha uzun bir dönem ya da farklı hisseler deneyin.'
    }

    if (
        normalized.includes('permission') ||
        normalized.includes('unauth') ||
        normalized.includes('auth')
    ) {
        return 'Bu işlem için giriş yapmanız veya oturumunuzu yenilemeniz gerekiyor.'
    }

    return message.replace(/^error:\s*/i, '').trim() || 'İstek tamamlanamadı.'
}

function ErrorCard({ title, message }: { title: string; message: string }) {
    const readableMessage = formatCoMovementUserError(message)

    return (
        <div
            className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            style={{ borderLeft: '3px solid #f23645' }}
        >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-destructive/80">{readableMessage}</p>
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
    icon?: React.ReactNode
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
    error,
    liveSummary,
    onGenerate,
    isLoading,
    disabled,
    title,
    scopeLabel,
    scopeDescription,
}: {
    explanation: CoMovementExplainResponse | null
    error: string | null
    liveSummary: string
    onGenerate: () => void
    isLoading: boolean
    disabled: boolean
    title: string
    scopeLabel: string
    scopeDescription: string
}) {
    const visibleSummary = explanation?.summary || liveSummary

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
                                Hesaplanan metriklerin seçili kapsam için detaylı yorumunu üretir.
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
                        {isLoading ? 'Hazırlanıyor' : 'Yorum Üret'}
                    </Button>
                </div>
                <div className="space-y-4 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-[#080808] px-3 py-2 text-[11px]">
                        <span className="text-muted-foreground/60">Kapsam</span>
                        <span className="font-semibold text-foreground">{scopeLabel}</span>
                        <span className="text-muted-foreground/50">{scopeDescription}</span>
                    </div>
                    {error ? (
                        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : null}
                    {visibleSummary ? (
                        <>
                            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                                {visibleSummary}
                                {isLoading ? (
                                    <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-primary/70 align-middle" />
                                ) : null}
                            </p>
                            {explanation ? (
                                <>
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
                                        <span>Kapsam: {scopeLabel}</span>
                                        <span>Kaynak: {explanation.source}</span>
                                        <span>Model: {explanation.model ?? 'fallback'}</span>
                                    </div>
                                </>
                            ) : null}
                        </>
                    ) : isLoading ? (
                        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary/90">
                            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                            <span>Yorum hazırlanıyor. İlk parçalar gelir gelmez burada akmaya başlayacak.</span>
                        </div>
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

function savedAnalysisMeta(analysis: SavedCoMovementAnalysisSummary) {
    return [
        `${formatDateLabel(analysis.dateRange.start)} – ${formatDateLabel(analysis.dateRange.end)}`,
        `${analysis.metrics.node_count} hisse`,
        `${analysis.metrics.community_count} grup`,
        analysis.leadPair
            ? `${analysis.leadPair.source}-${analysis.leadPair.target} ${formatNumber(analysis.leadPair.hybrid_similarity, 3)}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ')
}

function SavedAnalysisRow({
    analysis,
    active,
    disabled,
    onOpen,
    onRename,
    onDelete,
}: {
    analysis: SavedCoMovementAnalysisSummary
    active: boolean
    disabled: boolean
    onOpen: (analysis: SavedCoMovementAnalysisSummary) => void
    onRename: (analysis: SavedCoMovementAnalysisSummary) => void
    onDelete: (analysis: SavedCoMovementAnalysisSummary) => void
}) {
    return (
        <div
            className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5',
                active && 'bg-primary/5'
            )}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
                    <p className="truncate text-xs font-semibold text-foreground">
                        {analysis.title}
                    </p>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                    {savedAnalysisMeta(analysis)}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    type="button"
                    variant={active ? 'ghost' : 'outline'}
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs"
                    disabled={disabled || active}
                    onClick={() => onOpen(analysis)}
                >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {active ? 'Açık' : 'Aç'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    disabled={disabled}
                    onClick={() => onRename(analysis)}
                    aria-label={`${analysis.title} adını değiştir`}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    onClick={() => onDelete(analysis)}
                    aria-label={`${analysis.title} kaydını sil`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}

function SavedAnalysisPreviewRow({
    analysis,
    active,
    disabled,
    onOpen,
}: {
    analysis: SavedCoMovementAnalysisSummary
    active: boolean
    disabled: boolean
    onOpen: (analysis: SavedCoMovementAnalysisSummary) => void
}) {
    return (
        <button
            type="button"
            disabled={disabled || active}
            onClick={() => onOpen(analysis)}
            className={cn(
                'flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/30 bg-white/[0.015] px-3 py-2.5 text-left transition-colors',
                active
                    ? 'border-emerald-400/30 bg-emerald-400/[0.04]'
                    : 'hover:border-border/60 hover:bg-white/[0.03]',
                (disabled || active) && 'cursor-default'
            )}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
                    <p className="truncate text-xs font-semibold text-foreground">
                        {analysis.title}
                    </p>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground/65">
                    {savedAnalysisMeta(analysis)}
                </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-primary">
                {active ? 'Açık' : 'Aç'}
            </span>
        </button>
    )
}

function SavedAnalysesPanel({
    analyses,
    activeAnalysisId,
    isAuthenticated,
    isLoading,
    isBusy,
    onDelete,
    onOpen,
    onRename,
}: {
    analyses: SavedCoMovementAnalysisSummary[]
    activeAnalysisId: string | null
    isAuthenticated: boolean
    isLoading: boolean
    isBusy: boolean
    onDelete: (analysisId: string) => Promise<void>
    onOpen: (analysisId: string) => Promise<void>
    onRename: (analysisId: string, title: string) => Promise<void>
}) {
    const [showAll, setShowAll] = useState(false)
    const [renameTarget, setRenameTarget] =
        useState<SavedCoMovementAnalysisSummary | null>(null)
    const [renameTitle, setRenameTitle] = useState('')
    const [deleteTarget, setDeleteTarget] =
        useState<SavedCoMovementAnalysisSummary | null>(null)
    const visibleAnalyses = analyses.slice(0, 2)

    const beginRename = (analysis: SavedCoMovementAnalysisSummary) => {
        setRenameTarget(analysis)
        setRenameTitle(analysis.title)
    }

    const handleRenameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!renameTarget) return

        const nextTitle = renameTitle.trim()
        if (!nextTitle) return

        try {
            await onRename(renameTarget.id, nextTitle)
            setRenameTarget(null)
            setRenameTitle('')
        } catch {
            // Parent mutation state renders the error card without closing the dialog.
        }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return

        try {
            await onDelete(deleteTarget.id)
            setDeleteTarget(null)
        } catch {
            // Parent mutation state renders the error card without closing the dialog.
        }
    }

    const renderRow = (analysis: SavedCoMovementAnalysisSummary) => (
        <SavedAnalysisRow
            key={analysis.id}
            analysis={analysis}
            active={activeAnalysisId === analysis.id}
            disabled={isBusy}
            onOpen={(item) => {
                void onOpen(item.id)
                    .then(() => setShowAll(false))
                    .catch(() => {
                        // Parent mutation state renders the error card.
                    })
            }}
            onRename={beginRename}
            onDelete={setDeleteTarget}
        />
    )

    const renderPreviewRow = (analysis: SavedCoMovementAnalysisSummary) => (
        <SavedAnalysisPreviewRow
            key={analysis.id}
            analysis={analysis}
            active={activeAnalysisId === analysis.id}
            disabled={isBusy}
            onOpen={(item) => {
                void onOpen(item.id).catch(() => {
                    // Parent mutation state renders the error card.
                })
            }}
        />
    )

    return (
        <div className="rounded-2xl border border-border/35 bg-white/[0.015] px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2862ff]/10 text-[#2862ff]">
                        <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                            Kayıtlı analiz aç
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                            {isAuthenticated
                                ? analyses.length > 0
                                    ? `${analyses.length} kayıt hesabınızda hazır`
                                    : 'Kaydettiğiniz özel analizler burada görünür'
                                : 'Kaydetmek ve tekrar açmak için giriş yapın'}
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAll(true)}
                    disabled={!isAuthenticated || isLoading}
                >
                    <List className="h-3.5 w-3.5" />
                    Tüm kayıtlar
                </Button>
            </div>

            {!isAuthenticated ? (
                null
            ) : isLoading ? (
                <div className="mt-3 space-y-2">
                    <Skeleton className="h-9 rounded-xl" />
                    <Skeleton className="h-9 rounded-xl" />
                </div>
            ) : analyses.length === 0 ? (
                null
            ) : (
                <div className="mt-3 space-y-2">
                    <div className="grid gap-2 lg:grid-cols-2">
                        {visibleAnalyses.map(renderPreviewRow)}
                    </div>
                    {analyses.length > visibleAnalyses.length ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                        >
                            +{analyses.length - visibleAnalyses.length} kayıt daha
                        </button>
                    ) : null}
                </div>
            )}

            <Sheet open={showAll} onOpenChange={setShowAll}>
                <SheetContent
                    side="right"
                    className="w-full border-border/60 bg-[#050505] p-0 sm:max-w-2xl"
                >
                    <SheetHeader>
                        <SheetTitle>Kayıtlı Analizler</SheetTitle>
                        <SheetDescription>
                            Daha önce kaydettiğiniz özel co-movement analizlerini açın, yeniden adlandırın veya silin.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                        {analyses.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-border/40 px-4 py-8 text-center text-sm text-muted-foreground">
                                Henüz kayıtlı özel analiz yok.
                            </p>
                        ) : (
                            <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-[#080808]">
                                {analyses.map(renderRow)}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog
                open={renameTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRenameTarget(null)
                }}
            >
                <DialogContent className="border-border/60 bg-[#080808]">
                    <form onSubmit={handleRenameSubmit}>
                        <DialogHeader>
                            <DialogTitle>Analizi yeniden adlandır</DialogTitle>
                            <DialogDescription>
                                Kayıtlı analizi daha sonra kolay bulabileceğiniz kısa bir isimle kaydedin.
                            </DialogDescription>
                        </DialogHeader>
                        <Input
                            value={renameTitle}
                            onChange={(event) => setRenameTitle(event.target.value)}
                            placeholder="Örn. Bankalar - 2025"
                            disabled={isBusy}
                            className="h-10"
                            autoFocus
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setRenameTarget(null)}
                                disabled={isBusy}
                            >
                                Vazgeç
                            </Button>
                            <Button
                                type="submit"
                                disabled={isBusy || renameTitle.trim().length === 0}
                            >
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <DialogContent className="border-destructive/30 bg-[#080808]">
                    <DialogHeader>
                        <DialogTitle>Kayıtlı analiz silinsin mi?</DialogTitle>
                        <DialogDescription>
                            {deleteTarget
                                ? `${deleteTarget.title} kaydı Firebase hesabınızdan silinecek. Bu işlem geri alınamaz.`
                                : 'Bu kayıt Firebase hesabınızdan silinecek. Bu işlem geri alınamaz.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setDeleteTarget(null)}
                            disabled={isBusy}
                        >
                            Vazgeç
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                void handleConfirmDelete()
                            }}
                            disabled={isBusy}
                        >
                            Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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

type PairMetricKey = 'hybrid' | 'pearson' | 'dtw'

const PAIR_METRIC_COPY: Record<
    PairMetricKey,
    {
        label: string
        shortLabel: string
        description: string
        emptyText: string
    }
> = {
    hybrid: {
        label: 'Hybrid',
        shortLabel: 'Hybrid',
        description: 'Pearson ve DTW similarity birlikte yüksek olan çiftleri gösterir.',
        emptyText: 'Hybrid skor taşıyan pair verisi bulunamadı.',
    },
    pearson: {
        label: 'Pearson',
        shortLabel: 'Pearson',
        description: 'Getiri serileri aynı yönde hareket eden çiftleri gösterir.',
        emptyText: 'Pearson skor taşıyan pair verisi bulunamadı.',
    },
    dtw: {
        label: 'DTW',
        shortLabel: 'DTW',
        description: 'Fiyat yolu ve şekli birbirine benzeyen çiftleri gösterir.',
        emptyText: 'DTW skor taşıyan pair verisi bulunamadı.',
    },
}

function pairMetricValue(pair: CoMovementPair, metric: PairMetricKey): number | null {
    const value =
        metric === 'hybrid'
            ? pair.hybrid_similarity
            : metric === 'pearson'
              ? pair.pearson
              : pair.dtw_similarity

    return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

function pairSupportScores(pair: CoMovementPair, metric: PairMetricKey) {
    return [
        {
            key: 'hybrid',
            label: 'H',
            value: metric === 'hybrid' ? null : pair.hybrid_similarity,
        },
        {
            key: 'pearson',
            label: 'P',
            value: metric === 'pearson' ? null : pair.pearson,
        },
        {
            key: 'dtw',
            label: 'D',
            value: metric === 'dtw' ? null : pair.dtw_similarity,
        },
    ].filter(
        (item): item is { key: string; label: string; value: number } =>
            typeof item.value === 'number' && !Number.isNaN(item.value)
    )
}

function PairsTable({
    title,
    description,
    pairs,
    metric = 'hybrid',
    limit = 20,
    bare = false,
}: {
    title?: string
    description?: string
    pairs: CoMovementPair[]
    metric?: PairMetricKey
    limit?: number
    bare?: boolean
}) {
    const rows = pairs
        .map((pair) => ({
            pair,
            score: pairMetricValue(pair, metric),
        }))
        .filter((row): row is { pair: CoMovementPair; score: number } => row.score !== null)
        .slice(0, limit)
    const maxScore = Math.max(...rows.map((row) => Math.max(row.score, 0)), 1)
    const metricCopy = PAIR_METRIC_COPY[metric]

    return (
        <div
            className={cn(
                'overflow-hidden rounded-2xl border border-border/60 bg-[#080808]',
                bare && 'rounded-none border-0 bg-transparent'
            )}
        >
            {!bare && (
                <div className="border-b border-border/50 px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
            )}
            <div className="divide-y divide-border/20">
                {rows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        {metricCopy.emptyText}
                    </p>
                ) : (
                    rows.map(({ pair, score }, index) => {
                        const supportScores = pairSupportScores(pair, metric)

                        return (
                            <div
                                key={`${pair.source}-${pair.target}`}
                                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                            >
                                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/30">
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold tracking-tight text-foreground">
                                            {pair.source}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/30">·</span>
                                        <span className="text-sm font-bold tracking-tight text-foreground">
                                            {pair.target}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-border/20">
                                        <div
                                            className="cmo-progress-bar h-full rounded-full"
                                            style={{
                                                width: `${(Math.max(score, 0) / maxScore) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    {supportScores.length > 0 ? (
                                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground/45">
                                            {supportScores.map((item) => (
                                                <span key={item.key}>
                                                    {item.label} {formatNumber(item.value, 3)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                    <span className="text-base font-bold tabular-nums text-cyan-300">
                                        {formatNumber(score, 3)}
                                    </span>
                                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                        {metricCopy.shortLabel}
                                    </p>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

function PairRankingsCard({
    rankings,
    bare = false,
}: {
    rankings: CoMovementPairRankings
    bare?: boolean
}) {
    const [activeRankTab, setActiveRankTab] = useState<'hybrid' | 'pearson' | 'dtw'>('hybrid')
    const activeMetric = PAIR_METRIC_COPY[activeRankTab]

    return (
        <div
            className={cn(
                'overflow-hidden rounded-2xl border border-border/60 bg-[#080808]',
                bare && 'rounded-none border-0 bg-transparent'
            )}
        >
            <div
                className={cn(
                    'flex items-center justify-between border-b border-border/50 px-5 py-3.5',
                    bare && 'px-0 pt-0'
                )}
            >
                <div>
                    <p className="text-sm font-semibold text-foreground">Metrik Liderleri</p>
                    <p className="text-[11px] text-muted-foreground">
                        Her tab kendi metriğine göre bağımsız lider çiftleri sıralar.
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
                            {PAIR_METRIC_COPY[key].label}
                        </button>
                    ))}
                </div>
            </div>
            <div className={cn('border-b border-border/30 px-5 py-3', bare && 'px-0')}>
                <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{activeMetric.label}:</span>{' '}
                    {activeMetric.description}
                </p>
            </div>
            <PairsTable
                pairs={rankings[activeRankTab]}
                metric={activeRankTab}
                limit={12}
                bare
            />
        </div>
    )
}

function RollingStabilityCard({
    rows,
    bare = false,
}: {
    rows: CoMovementRollingStabilityRow[]
    bare?: boolean
}) {
    const content = (
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
    )

    if (bare) {
        return (
            <div>
                <div className="border-b border-border/50 pb-3.5">
                    <p className="text-sm font-semibold text-foreground">Rolling Stability</p>
                    <p className="text-[11px] text-muted-foreground">
                        Farklı pencerelerde güçlü kalmaya devam eden eşleşmeler.
                    </p>
                </div>
                <div className="pt-4">{content}</div>
            </div>
        )
    }

    return (
        <Card className="border-border/60 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Rolling Stability</CardTitle>
                <CardDescription>
                    Farklı pencerelerde güçlü kalmaya devam eden eşleşmeler.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">{content}</CardContent>
        </Card>
    )
}

function QualityCard({
    result,
    bare = false,
}: {
    result: CoMovementResult
    bare?: boolean
}) {
    const mostFilled = topMissingRows(result.data_quality)
    const excluded = topExcludedRows(result.excluded_symbols)

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <div
                className={cn(
                    'overflow-hidden rounded-2xl border border-border/60 bg-card/80',
                    bare && 'rounded-none border-0 bg-transparent'
                )}
            >
                <div className={cn('border-b border-border/50 px-6 py-4', bare && 'px-0 pt-0')}>
                    <p className="text-sm font-semibold text-foreground">Data Quality</p>
                    <p className="text-[11px] text-muted-foreground">
                        Dolgu uygulanan ve eksik oranı öne çıkan seriler.
                    </p>
                </div>
                <div className={cn('px-6 py-5', bare && 'px-0 pb-0')}>
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
                </div>
            </div>

            <div
                className={cn(
                    'overflow-hidden rounded-2xl border border-border/60 bg-card/80',
                    bare && 'rounded-none border-0 bg-transparent'
                )}
            >
                <div className={cn('border-b border-border/50 px-6 py-4', bare && 'px-0 pt-0')}>
                    <p className="text-sm font-semibold text-foreground">Excluded Symbols</p>
                    <p className="text-[11px] text-muted-foreground">
                        Minimum geçmiş veya kalite eşiğini sağlayamayan hisseler.
                    </p>
                </div>
                <div className={cn('px-6 py-5', bare && 'px-0 pb-0')}>
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
                </div>
            </div>
        </div>
    )
}

function DetailsWorkspace({
    topPairs,
    pairRankings,
    rollingRows,
    result,
    heatmapContent,
    defaultTab = 'pairs',
    scopeLabel,
}: {
    topPairs: CoMovementPair[]
    pairRankings: CoMovementPairRankings
    rollingRows: CoMovementRollingStabilityRow[]
    result: CoMovementResult
    heatmapContent: React.ReactNode
    defaultTab?: 'pairs' | 'heatmap' | 'rolling' | 'quality'
    scopeLabel?: string
}) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(true)
    const detailsContentId = useId()

    return (
        <div className="overflow-hidden rounded-[1.75rem] border border-border/50 bg-[#080808]">
            <button
                type="button"
                onClick={() => setIsDetailsOpen((open) => !open)}
                aria-expanded={isDetailsOpen}
                aria-controls={detailsContentId}
                aria-label={isDetailsOpen ? 'Detaylar panelini kapat' : 'Detaylar panelini aç'}
                className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-border/45 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
            >
                <span>
                    <span className="block text-sm font-semibold text-foreground">Detaylar</span>
                    <span className="block text-[11px] text-muted-foreground">
                        {scopeLabel
                            ? `${scopeLabel} odağına göre pair, heatmap, rolling stability ve veri kalitesi.`
                            : 'Pair, heatmap, rolling stability ve veri kalitesi tek çalışma alanında.'}
                    </span>
                </span>
                <span className="flex items-center gap-2">
                    <span className="rounded-full border border-border/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                        {scopeLabel ?? 'Talep üzerine'}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground">
                        <ChevronDown
                            className={cn(
                                'h-4 w-4 transition-transform',
                                isDetailsOpen && 'rotate-180'
                            )}
                        />
                    </span>
                </span>
            </button>

            <Tabs
                id={detailsContentId}
                defaultValue={defaultTab}
                className={cn('p-5', !isDetailsOpen && 'hidden')}
            >
                <TabsList className="flex h-auto flex-wrap gap-1.5 rounded-2xl bg-[#111111] p-1.5">
                    {[
                        { value: 'pairs', label: 'Pairler' },
                        { value: 'heatmap', label: 'Heatmap' },
                        { value: 'rolling', label: 'Rolling' },
                        { value: 'quality', label: 'Veri Kalitesi' },
                    ].map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="rounded-xl px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground aria-selected:bg-[#1c1c1c] aria-selected:text-foreground aria-selected:shadow-sm"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="pairs" className="mt-5">
                    <div className="space-y-5">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <div>
                                <div className="mb-3 border-b border-border/45 pb-3.5">
                                    <p className="text-sm font-semibold text-foreground">
                                        Graph Eşleşmeleri
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Graph ve toplulukları besleyen hybrid-konsensüs eşleşmeler.
                                    </p>
                                </div>
                                <PairsTable
                                    pairs={topPairs}
                                    metric="hybrid"
                                    limit={15}
                                    bare
                                />
                            </div>
                            <PairRankingsCard rankings={pairRankings} bare />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="heatmap" className="mt-5">
                    {heatmapContent}
                </TabsContent>

                <TabsContent value="rolling" className="mt-5">
                    <RollingStabilityCard rows={rollingRows} bare />
                </TabsContent>

                <TabsContent value="quality" className="mt-5">
                    <QualityCard result={result} bare />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function NodeDetailCard({
    result,
    selectedNodeId,
    visibleNodes,
    visibleEdges,
    onClose,
    onSelectCommunity,
}: {
    result: CoMovementResult
    selectedNodeId: string | null
    visibleNodes?: CoMovementResult['graph']['nodes']
    visibleEdges?: CoMovementResult['graph']['edges']
    onClose?: () => void
    onSelectCommunity?: (communityId: number) => void
}) {
    const nodes = visibleNodes ?? result.graph.nodes
    const edges = visibleEdges ?? result.graph.edges
    const node = nodes.find((item) => item.id === selectedNodeId) ?? null
    const nodeCommunities = result.communities.filter((item) =>
        selectedNodeId ? item.stocks.includes(selectedNodeId) : false
    )
    const community =
        nodeCommunities[0] ??
        result.communities.find((item) => item.community_id === node?.community_id)
    const connections = edges
        .filter(
            (edge) =>
                edgeSourceId(edge) === selectedNodeId ||
                edgeTargetId(edge) === selectedNodeId
        )
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 10)

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
                            className="rounded-2xl border p-4"
                            style={{
                                borderColor: `${nodeColor}40`,
                                backgroundColor: `${nodeColor}0c`,
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p
                                        className="text-lg font-bold tracking-tight"
                                        style={{ color: nodeColor }}
                                    >
                                        {node.label}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Grup {node.community_id ?? '—'}
                                        {community ? ` · ${community.size} hisse` : ''}
                                    </p>
                                    {nodeCommunities.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {nodeCommunities.map((item) => {
                                                const color = communityColor(item.community_id)
                                                return (
                                                    <button
                                                        key={item.community_id}
                                                        type="button"
                                                        onClick={() => onSelectCommunity?.(item.community_id)}
                                                        disabled={!onSelectCommunity}
                                                        className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-background/30 disabled:cursor-default"
                                                        style={{
                                                            borderColor: `${color}35`,
                                                            backgroundColor: `${color}10`,
                                                            color,
                                                        }}
                                                        aria-label={`G${item.community_id} grubunu göster`}
                                                    >
                                                        <span
                                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                        <span>Grubu göster</span>
                                                        <span className="font-semibold">
                                                            G{item.community_id}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {item.size}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                                <span
                                    className="mt-1.5 h-3 w-3 rounded-full ring-2 ring-inset ring-white/20"
                                    style={{ backgroundColor: nodeColor }}
                                />
                            </div>
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

function SnapshotExplorerView({
    snapshot,
    snapshotMode,
    onRefresh,
    isRefreshing,
}: {
    snapshot: CoMovementSnapshotSummary
    snapshotMode: 'latest' | string
    onRefresh?: () => void
    isRefreshing?: boolean
}) {
    const largestCommunity = getLargestCommunity(snapshot)
    const leadPair = getTopPairOptions(snapshot.top_pairs, 1)[0]
    const defaultCommunitySubset = buildCommunitySubset(largestCommunity, 12)

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
    const [snapshotGraphSearch, setSnapshotGraphSearch] = useState('')
    const [snapshotExplanation, setSnapshotExplanation] =
        useState<CoMovementExplainResponse | null>(null)
    const [snapshotExplainDraft, setSnapshotExplainDraft] = useState('')
    const [snapshotExplainError, setSnapshotExplainError] = useState<string | null>(null)
    const [snapshotExplainLoading, setSnapshotExplainLoading] = useState(false)
    const [snapshotExplanationScopeKey, setSnapshotExplanationScopeKey] = useState('')

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

    const selectSnapshotGraphNode = (nodeId: string | null) => {
        setSelectedSnapshotNodeId(nodeId)
        setSnapshotGraphSearch(nodeId ?? '')
    }

    const resetSnapshotGraphSelection = () => {
        setSelectedSnapshotNodeId(null)
        setSnapshotGraphSearch('')
    }

    const handleSnapshotRefresh = () => {
        resetSnapshotGraphSelection()
        onRefresh?.()
    }

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

    const snapshotExplainScope = useMemo<ExplainScope>(() => {
        const nodeSymbols = getNodeNeighborhoodSymbols(snapshot, selectedSnapshotNodeId, 12)
        if (selectedSnapshotNodeId && nodeSymbols.length >= 2) {
            return {
                type: 'symbols',
                label: `${selectedSnapshotNodeId} odağı`,
                description: `${nodeSymbols.length} hisse · en güçlü komşular`,
                symbols: nodeSymbols,
            }
        }

        if (snapshotGraphScope === 'focus') {
            if (snapshotFocusMode === 'pair' && selectedPair) {
                return {
                    type: 'pair',
                    label: `${selectedPair.source}-${selectedPair.target}`,
                    description: `Hybrid ${formatNumber(selectedPair.hybrid_similarity, 3)}`,
                    pair: selectedPair,
                }
            }

            if (snapshotFocusMode === 'manual') {
                const manualSymbols = normalizeManualSubset(manualSnapshotSymbols, 12)
                const symbols =
                    manualSymbols.length >= 2 ? manualSymbols : snapshotMatrixSymbols
                return {
                    type: 'symbols',
                    label: `${symbols.length} seçili hisse`,
                    description: 'Manuel odak sepeti',
                    symbols,
                }
            }

            if (selectedCommunity) {
                return {
                    type: 'community',
                    label: `G${selectedCommunity.community_id}`,
                    description: `${selectedCommunity.size} hisse · avg ${formatNumber(selectedCommunity.avg_similarity, 3)}`,
                    community: selectedCommunity,
                }
            }
        }

        return {
            type: 'market',
            label: 'Tüm piyasa',
            description: `${snapshot.metrics.node_count} hisse · ${snapshot.metrics.edge_count} bağlantı`,
        }
    }, [
        manualSnapshotSymbols,
        selectedCommunity,
        selectedPair,
        selectedSnapshotNodeId,
        snapshot,
        snapshotFocusMode,
        snapshotGraphScope,
        snapshotMatrixSymbols,
    ])
    const currentSnapshotExplainScopeKey = getExplainScopeKey(snapshotExplainScope)
    const isSnapshotExplanationCurrent =
        snapshotExplanationScopeKey === currentSnapshotExplainScopeKey
    const scopedSnapshotPairs = useMemo(
        () => filterPairsForScope(snapshot.top_pairs, snapshotExplainScope, 15),
        [snapshot.top_pairs, snapshotExplainScope]
    )
    const scopedSnapshotPairRankings = useMemo(
        () => buildScopedPairRankings(snapshot.pair_rankings, snapshotExplainScope),
        [snapshot.pair_rankings, snapshotExplainScope]
    )

    const handleGenerateSnapshotExplanation = async () => {
        setSnapshotExplanationScopeKey(currentSnapshotExplainScopeKey)
        setSnapshotExplanation(null)
        setSnapshotExplainDraft('')
        setSnapshotExplainError(null)
        setSnapshotExplainLoading(true)

        try {
            const explanation = await streamCoMovementExplanation(
                buildScopedExplainPayload(snapshot, snapshotExplainScope),
                {
                    onText: (_chunk, fullText) => {
                        setSnapshotExplainDraft(fullText)
                    },
                }
            )
            setSnapshotExplainDraft(explanation.summary)
            setSnapshotExplanation(explanation)
        } catch (error) {
            setSnapshotExplainError(
                error instanceof Error ? error.message : 'Yorum üretilemedi.'
            )
        } finally {
            setSnapshotExplainLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* B: Ağ grafiği + topluluk / hisse detay kenar paneli */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
                <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
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
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                        <GraphNodeSearch
                            nodes={snapshotGraphData.nodes}
                            value={snapshotGraphSearch}
                            onValueChange={setSnapshotGraphSearch}
                            onSelectNode={selectSnapshotGraphNode}
                            placeholder="Snapshot graph'ta hisse ara..."
                        />
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                                {(['market', 'focus'] as const).map((scope) => (
                                    <button
                                        key={scope}
                                        type="button"
                                        onClick={() => {
                                            setSnapshotGraphScope(scope)
                                            resetSnapshotGraphSelection()
                                        }}
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
                            {onRefresh ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 rounded-xl p-0"
                                    onClick={handleSnapshotRefresh}
                                    disabled={isRefreshing}
                                    aria-label="Snapshot yenile"
                                >
                                    <RefreshCw
                                        className={cn(
                                            'h-3.5 w-3.5',
                                            isRefreshing && 'animate-spin'
                                        )}
                                    />
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>

                <GraphFocusBar
                    label={snapshotExplainScope.label}
                    description={snapshotExplainScope.description}
                    isFocused={snapshotGraphScope === 'focus' || Boolean(selectedSnapshotNodeId)}
                    onReset={() => {
                        setSnapshotGraphScope('market')
                        resetSnapshotGraphSelection()
                    }}
                />

                <div className="flex flex-col xl:h-[550px] xl:flex-row">
                    {/* Grafik */}
                    <div className="relative min-h-[430px] min-w-0 flex-1 overflow-hidden">
                        <CoMovementGraph
                            title=""
                            description=""
                            nodes={snapshotGraphData.nodes}
                            edges={snapshotGraphData.edges}
                            selectedNodeId={effectiveSelectedSnapshotNodeId}
                            onSelectNode={selectSnapshotGraphNode}
                            height={550}
                            bare
                        />
                    </div>

                    {/* Kenar panel: topluluklar veya hisse detayı */}
                    <div className="flex max-h-[360px] w-full shrink-0 flex-col overflow-hidden border-t border-border/50 bg-[#060606] xl:max-h-none xl:w-[270px] xl:border-l xl:border-t-0">
                        {selectedSnapshotNodeId ? (
                            <NodeDetailCard
                                result={snapshot}
                                selectedNodeId={selectedSnapshotNodeId}
                                visibleNodes={snapshotGraphData.nodes}
                                visibleEdges={snapshotGraphData.edges}
                                onClose={() => selectSnapshotGraphNode(null)}
                                onSelectCommunity={(communityId) => {
                                    setSnapshotGraphScope('focus')
                                    setSnapshotFocusMode('community')
                                    setSelectedCommunityId(communityId)
                                }}
                            />
                        ) : (
                            <>
                                {(() => {
                                    const sorted = [...snapshot.communities]
                                        .sort((a, b) => b.size - a.size || b.avg_similarity - a.avg_similarity)
                                    const grouped = sorted.filter((c) => c.size > 1)
                                    const isolated = sorted.filter((c) => c.size === 1)
                                    return (
                                        <>
                                            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                                                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                                    Topluluklar
                                                </p>
                                                <span className="text-[10px] text-muted-foreground/50">
                                                    {grouped.length} aktif
                                                    {isolated.length > 0 && (
                                                        <span className="ml-1 text-muted-foreground/30">
                                                            · {isolated.length} izole
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex-1 space-y-1 overflow-y-auto p-2">
                                                {grouped.map((community) => {
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
                                                                resetSnapshotGraphSelection()
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
                                                                        {community.size} hisse
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
                                    )
                                })()}
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

            <DetailsWorkspace
                topPairs={scopedSnapshotPairs}
                pairRankings={scopedSnapshotPairRankings}
                rollingRows={snapshot.rolling_stability}
                result={snapshot}
                scopeLabel={snapshotExplainScope.label}
                heatmapContent={
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xs text-muted-foreground">Odak:</p>
                            <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                                {(['community', 'pair', 'manual'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => {
                                            setSnapshotFocusMode(mode)
                                            setSnapshotGraphScope('focus')
                                            resetSnapshotGraphSelection()
                                        }}
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
                                        setSnapshotGraphScope('focus')
                                        setSelectedCommunityId(Number(event.target.value))
                                        resetSnapshotGraphSelection()
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
                                        setSnapshotGraphScope('focus')
                                        setSelectedPairKey(event.target.value)
                                        resetSnapshotGraphSelection()
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
                                    setSnapshotGraphScope('focus')
                                    setManualSnapshotSymbols(symbols)
                                    resetSnapshotGraphSelection()
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
                }
            />

            {/* F: Yorum */}
                <ExplanationCard
                    title="Detaylı Yorum"
                    explanation={isSnapshotExplanationCurrent ? snapshotExplanation : null}
                    error={isSnapshotExplanationCurrent ? snapshotExplainError : null}
                    liveSummary={isSnapshotExplanationCurrent ? snapshotExplainDraft : ''}
                    onGenerate={() => void handleGenerateSnapshotExplanation()}
                    isLoading={snapshotExplainLoading && isSnapshotExplanationCurrent}
                    disabled={snapshotExplainLoading}
                    scopeLabel={snapshotExplainScope.label}
                    scopeDescription={snapshotExplainScope.description}
                />
        </div>
    )
}

export function CoMovementSection() {
    const latestSnapshotQuery = useLatestCoMovementSnapshot()
    const analyzeMutation = useAnalyzeCoMovement()
    const currentUserId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const savedAnalysesQuery = useSavedCoMovementAnalyses(currentUserId, 50)
    const saveAnalysisMutation = useSaveCoMovementAnalysis(currentUserId)
    const openSavedAnalysisMutation = useOpenSavedCoMovementAnalysis(currentUserId)
    const deleteSavedAnalysisMutation = useDeleteSavedCoMovementAnalysis(currentUserId)
    const renameSavedAnalysisMutation = useRenameSavedCoMovementAnalysis(currentUserId)
    const [selectedAnalysisNodeId, setSelectedAnalysisNodeId] = useState<string | null>(null)
    const [customGraphSearch, setCustomGraphSearch] = useState('')
    const [analysisExplanation, setAnalysisExplanation] = useState<CoMovementExplainResponse | null>(null)
    const [analysisExplainDraft, setAnalysisExplainDraft] = useState('')
    const [analysisExplainError, setAnalysisExplainError] = useState<string | null>(null)
    const [analysisExplainLoading, setAnalysisExplainLoading] = useState(false)
    const [analysisExplanationScopeKey, setAnalysisExplanationScopeKey] = useState('')
    const [loadedSavedAnalysisId, setLoadedSavedAnalysisId] = useState<string | null>(null)
    const loadedSavedAnalysis = useMemo(
        () =>
            (savedAnalysesQuery.data ?? []).find(
                (analysis) => analysis.id === loadedSavedAnalysisId
            ) ?? null,
        [loadedSavedAnalysisId, savedAnalysesQuery.data]
    )

    const selectCustomGraphNode = (nodeId: string | null) => {
        setSelectedAnalysisNodeId(nodeId)
        setCustomGraphSearch(nodeId ?? '')
    }

    const resetCustomGraphSelection = () => {
        setSelectedAnalysisNodeId(null)
        setCustomGraphSearch('')
    }

    const currentSnapshot = latestSnapshotQuery.data ?? null

    const [activeMode, setActiveMode] = useState<'snapshot' | 'custom'>('snapshot')
    const [customSymbols, setCustomSymbols] = useState<string[]>(DEFAULT_CUSTOM_SYMBOLS)
    const [customStartDateOverride, setCustomStartDateOverride] = useState<string | null>(
        null
    )
    const [customEndDateOverride, setCustomEndDateOverride] = useState<string | null>(null)
    const [customTopK, setCustomTopK] = useState(3)
    const [customMinSimilarity, setCustomMinSimilarity] = useState(0.6)
    const [customRollingWindow, setCustomRollingWindow] = useState(90)
    const [showCustomAdvancedSettings, setShowCustomAdvancedSettings] = useState(false)
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

    const customAnalyzeRequest = useMemo<CoMovementAnalyzeRequest>(() => ({
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
    }), [
        customEndDate,
        customMinSimilarity,
        customRollingWindow,
        customStartDate,
        customSymbols,
        customTopK,
    ])

    const customReadinessIssues = useMemo(() => {
        const issues: string[] = []
        if (customSymbols.length < 2) {
            issues.push('En az 2 hisse seçin')
        }
        if (!customStartDate || !customEndDate) {
            issues.push('Tarih aralığı seçin')
        } else if (!isOrderedDateRange(customStartDate, customEndDate)) {
            issues.push('Bitiş tarihi başlangıçtan sonra olmalı')
        }
        return issues
    }, [customEndDate, customStartDate, customSymbols.length])

    const isCustomAnalysisReady = customReadinessIssues.length === 0
    const customReadinessItems = useMemo(
        () => [
            {
                label: 'Hisse',
                value: `${customSymbols.length} seçili`,
            },
            {
                label: 'Dönem',
                value:
                    customStartDate && customEndDate
                        ? `${formatDateLabel(customStartDate)} – ${formatDateLabel(customEndDate)}`
                        : 'Seçilmedi',
            },
            {
                label: 'Ayar',
                value: `top_k ${customTopK} · min ${customMinSimilarity.toFixed(2)} · rolling ${customRollingWindow}g`,
            },
        ],
        [
            customEndDate,
            customMinSimilarity,
            customRollingWindow,
            customStartDate,
            customSymbols.length,
            customTopK,
        ]
    )

    const handleRunAnalysis = async () => {
        if (!isCustomAnalysisReady) return

        const response = await analyzeMutation.mutateAsync(customAnalyzeRequest)

        setCustomResult(response)
        resetCustomGraphSelection()
        setSelectedCustomCommunityId(null)
        setCustomGraphScope('market')
        setLoadedSavedAnalysisId(null)
        setAnalysisExplanation(null)
        setAnalysisExplainDraft('')
        setAnalysisExplainError(null)
    }

    const selectedCustomCommunity = useMemo(() => {
        if (!customResult) return null
        return customResult.communities.find(
            (community) => community.community_id === selectedCustomCommunityId
        ) ?? null
    }, [customResult, selectedCustomCommunityId])

    const customExplainScope = useMemo<ExplainScope>(() => {
        if (!customResult) {
            return {
                type: 'market',
                label: 'Özel analiz',
                description: 'Analiz sonucu bekleniyor',
            }
        }

        const nodeSymbols = getNodeNeighborhoodSymbols(customResult, selectedAnalysisNodeId, 12)
        if (selectedAnalysisNodeId && nodeSymbols.length >= 2) {
            return {
                type: 'symbols',
                label: `${selectedAnalysisNodeId} odağı`,
                description: `${nodeSymbols.length} hisse · en güçlü komşular`,
                symbols: nodeSymbols,
            }
        }

        if (customGraphScope === 'focus' && selectedCustomCommunity) {
            return {
                type: 'community',
                label: `G${selectedCustomCommunity.community_id}`,
                description: `${selectedCustomCommunity.size} hisse · avg ${formatNumber(selectedCustomCommunity.avg_similarity, 3)}`,
                community: selectedCustomCommunity,
            }
        }

        return {
            type: 'market',
            label: 'Özel analiz tamamı',
            description: `${customResult.metrics.node_count} hisse · ${customResult.metrics.edge_count} bağlantı`,
        }
    }, [customGraphScope, customResult, selectedAnalysisNodeId, selectedCustomCommunity])
    const currentCustomExplainScopeKey = getExplainScopeKey(customExplainScope)
    const isAnalysisExplanationCurrent =
        analysisExplanationScopeKey === currentCustomExplainScopeKey
    const scopedCustomPairs = useMemo(
        () =>
            customResult
                ? filterPairsForScope(customResult.top_pairs, customExplainScope, 15)
                : [],
        [customExplainScope, customResult]
    )
    const scopedCustomPairRankings = useMemo(
        () =>
            customResult
                ? buildScopedPairRankings(customResult.pair_rankings, customExplainScope)
                : { hybrid: [], pearson: [], dtw: [] },
        [customExplainScope, customResult]
    )

    const handleGenerateAnalysisExplanation = async () => {
        if (!customResult) return

        setAnalysisExplanationScopeKey(currentCustomExplainScopeKey)
        setAnalysisExplanation(null)
        setAnalysisExplainDraft('')
        setAnalysisExplainError(null)
        setAnalysisExplainLoading(true)

        try {
            const explanation = await streamCoMovementExplanation(
                buildScopedExplainPayload(customResult, customExplainScope),
                {
                    onText: (_chunk, fullText) => {
                        setAnalysisExplainDraft(fullText)
                    },
                }
            )
            setAnalysisExplainDraft(explanation.summary)
            setAnalysisExplanation(explanation)
        } catch (error) {
            setAnalysisExplainError(
                error instanceof Error ? error.message : 'Yorum üretilemedi.'
            )
        } finally {
            setAnalysisExplainLoading(false)
        }
    }

    const applySavedExplanationScope = (
        scope: SavedCoMovementExplainScope | undefined
    ) => {
        if (!scope) {
            setCustomGraphScope('market')
            setSelectedCustomCommunityId(null)
            setSelectedAnalysisNodeId(null)
            setAnalysisExplanationScopeKey('market')
            return
        }

        if (scope.type === 'community' && scope.communityId !== undefined) {
            setCustomGraphScope('focus')
            setSelectedCustomCommunityId(scope.communityId)
            setSelectedAnalysisNodeId(null)
        } else if (scope.type === 'symbols' && scope.symbols?.[0]) {
            setCustomGraphScope('market')
            setSelectedCustomCommunityId(null)
            setSelectedAnalysisNodeId(scope.symbols[0])
        } else {
            setCustomGraphScope('market')
            setSelectedCustomCommunityId(null)
            setSelectedAnalysisNodeId(null)
        }

        setAnalysisExplanationScopeKey(scope.key)
    }

    const handleSaveCurrentAnalysis = async () => {
        if (!customResult) return

        const saved = await saveAnalysisMutation.mutateAsync({
            request: customAnalyzeRequest,
            result: customResult,
            explanation: isAnalysisExplanationCurrent ? analysisExplanation : null,
            explanationScope:
                isAnalysisExplanationCurrent && analysisExplanation
                    ? toSavedExplainScope(customExplainScope)
                    : null,
        })
        setLoadedSavedAnalysisId(saved.id)
    }

    const handleOpenSavedAnalysis = async (analysisId: string) => {
        const saved = await openSavedAnalysisMutation.mutateAsync(analysisId)
        setCustomResult(saved.result)
        setCustomSymbols(saved.request.symbols)
        setCustomStartDateOverride(saved.request.start_date)
        setCustomEndDateOverride(saved.request.end_date)
        setCustomTopK(saved.request.top_k)
        setCustomMinSimilarity(saved.request.min_similarity)
        setCustomRollingWindow(saved.request.rolling_window)
        setLoadedSavedAnalysisId(saved.id)
        setAnalysisExplanation(saved.explanation ?? null)
        setAnalysisExplainDraft(saved.explanation?.summary ?? '')
        setAnalysisExplainError(null)
        applySavedExplanationScope(saved.explanationScope)
        setCustomGraphSearch('')
    }

    const handleRenameSavedAnalysis = async (analysisId: string, title: string) => {
        await renameSavedAnalysisMutation.mutateAsync({ analysisId, title })
    }

    const handleDeleteSavedAnalysis = async (analysisId: string) => {
        await deleteSavedAnalysisMutation.mutateAsync(analysisId)
        if (loadedSavedAnalysisId === analysisId) {
            setLoadedSavedAnalysisId(null)
        }
    }

    const handleStartFreshCustomAnalysis = () => {
        setLoadedSavedAnalysisId(null)
        setCustomResult(null)
        setAnalysisExplanation(null)
        setAnalysisExplainDraft('')
        setAnalysisExplainError(null)
        setAnalysisExplanationScopeKey('')
        resetCustomGraphSelection()
        setSelectedCustomCommunityId(null)
        setCustomGraphScope('market')
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
        if (!selectedCustomCommunity) return { nodes: customResult.graph.nodes, edges: [] as typeof customResult.graph.edges }
        return filterGraphBySymbols(customResult, selectedCustomCommunity.stocks)
    }, [customResult, customGraphScope, selectedCustomCommunity])

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

    const headerStats =
        activeMode === 'custom' && customResult
            ? [
                  { label: 'Hybrid Pair', value: String(customResult.top_pairs.length) },
                  { label: 'Bağlantı', value: String(customResult.metrics.edge_count) },
                  { label: 'Topluluk', value: String(customResult.metrics.community_count) },
                  {
                      label: 'Modularity',
                      value: formatNumber(customResult.metrics.modularity, 3),
                  },
                  { label: 'Dışlanan', value: String(customResult.excluded_symbols.length) },
              ]
            : activeMode === 'snapshot' && currentSnapshot
              ? [
                    { label: 'Hisse', value: String(currentSnapshot.metrics.node_count) },
                    { label: 'Bağlantı', value: String(currentSnapshot.metrics.edge_count) },
                    { label: 'Topluluk', value: String(currentSnapshot.metrics.community_count) },
                    {
                        label: 'Modularity',
                        value: formatNumber(currentSnapshot.metrics.modularity, 3),
                    },
                    { label: 'Window', value: String(currentSnapshot.metrics.rolling_window_count) },
                ]
              : []

    const headerMetaItems =
        activeMode === 'custom' && customResult
            ? [
                  {
                      label: 'Sonuç',
                      value: loadedSavedAnalysis
                          ? `Kayıtlı · ${loadedSavedAnalysis.title}`
                          : 'Özel analiz',
                  },
                  ...(loadedSavedAnalysis
                      ? [
                            {
                                label: 'Kayıt',
                                value: formatDateLabel(loadedSavedAnalysis.updatedAt),
                            },
                        ]
                      : []),
                  {
                      label: 'Dönem',
                      value: `${formatDateLabel(customResult.date_range.start)} – ${formatDateLabel(customResult.date_range.end)}${
                          customResult.date_range.rows
                              ? ` (${customResult.date_range.rows} işlem günü)`
                              : ''
                      }`,
                  },
                  {
                      label: 'Kullanılan',
                      value: `${customResult.symbols.length} / ${customResult.requested_symbols.length} hisse`,
                  },
                  { label: 'top_k', value: String(customResult.config.top_k) },
                  {
                      label: 'min',
                      value: formatNumber(customResult.config.min_similarity, 2),
                  },
                  { label: 'rolling', value: `${customResult.config.rolling_window} gün` },
              ]
            : activeMode === 'snapshot' && currentSnapshot
              ? [
                    {
                        label: 'Dönem',
                        value: `${formatDateLabel(currentSnapshot.date_range.start)} – ${formatDateLabel(currentSnapshot.date_range.end)}${
                            currentSnapshot.date_range.rows
                                ? ` (${currentSnapshot.date_range.rows} işlem günü)`
                                : ''
                        }`,
                    },
                    {
                        label: 'Oluşturulma',
                        value: formatDateLabel(currentSnapshot.snapshot.created_at),
                    },
                    { label: 'top_k', value: String(currentSnapshot.config.top_k) },
                    {
                        label: 'min',
                        value: formatNumber(currentSnapshot.config.min_similarity, 2),
                    },
                    { label: 'rolling', value: `${currentSnapshot.config.rolling_window} gün` },
                ]
              : []

    return (
        <section className="space-y-6">
            <h1 className="bg-gradient-to-r from-foreground via-cyan-100 to-cyan-400 bg-clip-text text-3xl font-semibold tracking-[-0.04em] text-transparent sm:text-4xl">
                Co_movement
            </h1>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-[#080808] px-3 py-3 lg:flex-row lg:items-center">
                <div className="flex shrink-0 gap-1 rounded-xl bg-[#111111] p-1">
                    {[
                        { value: 'snapshot' as const, label: 'Piyasa Görünümü', icon: <BarChart3 className="h-4 w-4" /> },
                        { value: 'custom' as const, label: 'Özel Analiz', icon: <GitBranch className="h-4 w-4" /> },
                    ].map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveMode(tab.value)}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-none',
                                activeMode === tab.value
                                    ? 'bg-[#1e1e1e] text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground/70'
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {headerStats.length > 0 ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                        {headerStats.map((item) => (
                            <span
                                key={item.label}
                                className="inline-flex items-baseline gap-1.5 whitespace-nowrap"
                            >
                                <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {item.value}
                                </span>
                                <span className="uppercase tracking-widest text-muted-foreground/60">
                                    {item.label}
                                </span>
                            </span>
                        ))}
                    </div>
                ) : null}

                {headerMetaItems.length > 0 ? (
                    <div className="flex min-w-0 flex-[1.4] flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {headerMetaItems.map((item) => (
                            <span
                                key={item.label}
                                className="inline-flex min-w-0 items-center gap-1.5"
                            >
                                <span className="shrink-0 text-muted-foreground/50">
                                    {item.label}
                                </span>
                                <span className="max-w-[220px] truncate font-medium text-foreground sm:max-w-[280px]">
                                    {item.value}
                                </span>
                            </span>
                        ))}
                    </div>
                ) : null}

                {activeMode === 'custom' && customResult ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/40 pt-2 lg:border-t-0 lg:pt-0">
                        {loadedSavedAnalysis ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleStartFreshCustomAnalysis}
                                className="h-8 text-muted-foreground hover:text-foreground"
                            >
                                Yeni analiz
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleSaveCurrentAnalysis()}
                            disabled={
                                !isAuthenticated ||
                                saveAnalysisMutation.isPending ||
                                openSavedAnalysisMutation.isPending
                            }
                            className="h-8 gap-2"
                        >
                            {saveAnalysisMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            {saveAnalysisMutation.isPending ? 'Kaydediliyor' : 'Analizi Kaydet'}
                        </Button>
                    </div>
                ) : null}
            </div>

            {/* Snapshot Paneli */}
            {activeMode === 'snapshot' && (
                <div className="space-y-5">
                    {latestSnapshotQuery.isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-2xl" />
                            ))}
                        </div>
                    ) : currentSnapshot ? (
                        <SnapshotExplorerView
                            key={`latest-${currentSnapshot.snapshot.snapshot_id}`}
                            snapshot={currentSnapshot}
                            snapshotMode="latest"
                            onRefresh={() => void latestSnapshotQuery.refetch()}
                            isRefreshing={latestSnapshotQuery.isFetching}
                        />
                    ) : latestSnapshotQuery.isError ? (
                        <ErrorCard
                            title="Snapshot verisi yüklenemedi"
                            message={
                                String(latestSnapshotQuery.error) || 'Bilinmeyen hata'
                            }
                        />
                    ) : null}
                </div>
            )}

            {/* Özel Analiz Paneli */}
            {activeMode === 'custom' && (
                <div className="space-y-5">
                    <div className="rounded-[1.75rem] border border-border/50 bg-[#080808] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
                        <div className="space-y-5">
                            <SavedAnalysesPanel
                                analyses={savedAnalysesQuery.data ?? []}
                                activeAnalysisId={loadedSavedAnalysisId}
                                isAuthenticated={isAuthenticated}
                                isLoading={savedAnalysesQuery.isLoading}
                                isBusy={
                                    openSavedAnalysisMutation.isPending ||
                                    deleteSavedAnalysisMutation.isPending ||
                                    renameSavedAnalysisMutation.isPending
                                }
                                onDelete={handleDeleteSavedAnalysis}
                                onOpen={handleOpenSavedAnalysis}
                                onRename={handleRenameSavedAnalysis}
                            />

                            <CoMovementSymbolPicker
                                label="Analiz hisseleri"
                                helperText="En az 2 hisse seçin."
                                selectedSymbols={customSymbols}
                                onChange={setCustomSymbols}
                                disabled={analyzeMutation.isPending}
                            />

                            <div className="grid gap-3 sm:grid-cols-2">
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
                            </div>

                            <AnalysisReadinessStrip
                                ready={isCustomAnalysisReady}
                                issues={customReadinessIssues}
                                items={customReadinessItems}
                            />

                            <div className="overflow-hidden rounded-2xl border border-border/40 bg-[#0a0a0a]">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowCustomAdvancedSettings((current) => !current)
                                    }
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            Gelişmiş Ayarlar
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            top_k {customTopK} · min benzerlik{' '}
                                            {customMinSimilarity.toFixed(2)} · rolling{' '}
                                            {customRollingWindow} gün
                                        </p>
                                    </div>
                                    <ChevronDown
                                        className={cn(
                                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                            showCustomAdvancedSettings && 'rotate-180'
                                        )}
                                    />
                                </button>

                                {showCustomAdvancedSettings ? (
                                    <div className="space-y-4 border-t border-border/40 px-4 py-4">
                                        <div className="grid gap-3 sm:grid-cols-2">
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
                                        </div>

                                        <div className="space-y-2">
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
                                                    setCustomMinSimilarity(
                                                        Number(event.target.value)
                                                    )
                                                }
                                                disabled={analyzeMutation.isPending}
                                                className="h-2 w-full cursor-pointer border-0 bg-transparent px-0 accent-[#2862ff]"
                                            />
                                            <div className="flex justify-between text-[10px] text-muted-foreground/50">
                                                <span>0.30</span>
                                                <span>0.95</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleRunAnalysis()}
                                disabled={
                                    analyzeMutation.isPending ||
                                    !isCustomAnalysisReady
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

                    {saveAnalysisMutation.isError ||
                    openSavedAnalysisMutation.isError ||
                    deleteSavedAnalysisMutation.isError ||
                    renameSavedAnalysisMutation.isError ? (
                        <ErrorCard
                            title="Kayıtlı analiz işlemi tamamlanamadı"
                            message={
                                (saveAnalysisMutation.error instanceof Error
                                    ? saveAnalysisMutation.error.message
                                    : null) ??
                                (openSavedAnalysisMutation.error instanceof Error
                                    ? openSavedAnalysisMutation.error.message
                                    : null) ??
                                (deleteSavedAnalysisMutation.error instanceof Error
                                    ? deleteSavedAnalysisMutation.error.message
                                    : null) ??
                                (renameSavedAnalysisMutation.error instanceof Error
                                    ? renameSavedAnalysisMutation.error.message
                                    : null) ??
                                'İstek tamamlanamadı.'
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
                            {/* Analiz grafiği + topluluk kenar paneli */}
                            <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#080808]">
                                <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
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
                                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                                        <GraphNodeSearch
                                            nodes={customGraphData.nodes}
                                            value={customGraphSearch}
                                            onValueChange={setCustomGraphSearch}
                                            onSelectNode={selectCustomGraphNode}
                                            placeholder="Analiz graph'ında hisse ara..."
                                        />
                                        <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
                                            {(['market', 'focus'] as const).map((scope) => (
                                                <button
                                                    key={scope}
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomGraphScope(scope)
                                                        resetCustomGraphSelection()
                                                        if (
                                                            scope === 'focus' &&
                                                            selectedCustomCommunityId === null
                                                        ) {
                                                            setSelectedCustomCommunityId(
                                                                customResult.communities[0]?.community_id ?? null
                                                            )
                                                        }
                                                    }}
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
                                </div>

                                <GraphFocusBar
                                    label={customExplainScope.label}
                                    description={customExplainScope.description}
                                    isFocused={customGraphScope === 'focus' || Boolean(selectedAnalysisNodeId)}
                                    onReset={() => {
                                        setCustomGraphScope('market')
                                        resetCustomGraphSelection()
                                    }}
                                />

                                <div className="flex flex-col xl:h-[500px] xl:flex-row">
                                    <div className="relative min-h-[420px] min-w-0 flex-1 overflow-hidden">
                                        <CoMovementGraph
                                            title=""
                                            description=""
                                            nodes={customGraphData.nodes}
                                            edges={customGraphData.edges}
                                            selectedNodeId={effectiveSelectedAnalysisNodeId}
                                            onSelectNode={selectCustomGraphNode}
                                            height={500}
                                            bare
                                        />
                                    </div>

                                    <div className="flex max-h-[360px] w-full shrink-0 flex-col overflow-hidden border-t border-border/50 bg-[#060606] xl:max-h-none xl:w-[270px] xl:border-l xl:border-t-0">
                                        {selectedAnalysisNodeId ? (
                                            <NodeDetailCard
                                                result={customResult}
                                                selectedNodeId={selectedAnalysisNodeId}
                                                visibleNodes={customGraphData.nodes}
                                                visibleEdges={customGraphData.edges}
                                                onClose={() => selectCustomGraphNode(null)}
                                                onSelectCommunity={(communityId) => {
                                                    setCustomGraphScope('focus')
                                                    setSelectedCustomCommunityId(communityId)
                                                }}
                                            />
                                        ) : (
                                            <>
                                                {(() => {
                                                    const sorted = [...customResult.communities]
                                                        .sort((a, b) => b.size - a.size || b.avg_similarity - a.avg_similarity)
                                                    const grouped = sorted.filter((c) => c.size > 1)
                                                    const isolated = sorted.filter((c) => c.size === 1)
                                                    return (
                                                        <>
                                                            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                                                                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                                                    Topluluklar
                                                                </p>
                                                                <span className="text-[10px] text-muted-foreground/50">
                                                                    {grouped.length} aktif
                                                                    {isolated.length > 0 && (
                                                                        <span className="ml-1 text-muted-foreground/30">
                                                                            · {isolated.length} izole
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 space-y-1 overflow-y-auto p-2">
                                                                {grouped.map((community) => {
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
                                                                                resetCustomGraphSelection()
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
                                                                                        {community.size} hisse
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
                                                    )
                                                })()}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 border-t border-border/40 px-5 py-2.5 text-[10px] text-muted-foreground/50">
                                    <span>Node rengi community kimliğini gösterir</span>
                                    <span>Kenar kalınlığı hybrid similarity ağırlığını gösterir</span>
                                </div>
                            </div>

                            <DetailsWorkspace
                                topPairs={scopedCustomPairs}
                                pairRankings={scopedCustomPairRankings}
                                rollingRows={customResult.rolling_stability}
                                result={customResult}
                                scopeLabel={customExplainScope.label}
                                heatmapContent={
                                    <MatrixTabsPanel
                                        title="Matris Görünümleri"
                                        description={`Heatmap okunabilirliği için ${customMatrixSymbols.length} hisselik en güçlü ilişki sepeti gösteriliyor.`}
                                        symbols={customMatrixSymbols}
                                        matrices={customMatrixPanels}
                                    />
                                }
                            />

                            <ExplanationCard
                                title="Detaylı Sonuç Yorumu"
                                explanation={isAnalysisExplanationCurrent ? analysisExplanation : null}
                                error={isAnalysisExplanationCurrent ? analysisExplainError : null}
                                liveSummary={isAnalysisExplanationCurrent ? analysisExplainDraft : ''}
                                onGenerate={() => void handleGenerateAnalysisExplanation()}
                                isLoading={analysisExplainLoading && isAnalysisExplanationCurrent}
                                disabled={analysisExplainLoading}
                                scopeLabel={customExplainScope.label}
                                scopeDescription={customExplainScope.description}
                            />
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    )
}
