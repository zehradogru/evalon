import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
    readNpyNumber,
    readNpyUnicodeArray,
    readNpzNpy,
} from '@/lib/server/npz-reader'
import type {
    CoMovementAnalyzeRequest,
    CoMovementAnalyzeResponse,
    CoMovementCommunity,
    CoMovementDateRange,
    CoMovementExplainResponse,
    CoMovementMatrixDictionary,
    CoMovementMatrixName,
    CoMovementMetrics,
    CoMovementPair,
    CoMovementSnapshotListResponse,
    CoMovementSnapshotMeta,
    CoMovementSnapshotSummary,
    CoMovementSymbolSearchResponse,
} from '@/types'

const MATRIX_KEYS: CoMovementMatrixName[] = [
    'pearson',
    'spearman',
    'dtw_distance',
    'dtw_similarity',
    'hybrid_similarity',
]

function snapshotRootCandidates() {
    return [resolve(process.cwd(), 'data', 'co_movement')]
}

function findSnapshotRoot(): string | null {
    for (const candidate of snapshotRootCandidates()) {
        if (existsSync(candidate)) {
            return candidate
        }
    }
    return null
}

function readJsonFile<T>(path: string): T | null {
    try {
        return JSON.parse(readFileSync(path, 'utf-8')) as T
    } catch {
        return null
    }
}

function listSnapshotMetas(root: string): CoMovementSnapshotMeta[] {
    const items = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
            readJsonFile<CoMovementSnapshotMeta>(
                resolve(root, entry.name, 'metadata.json')
            )
        )
        .filter((item): item is CoMovementSnapshotMeta => Boolean(item))

    return items.sort(
        (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            right.snapshot_id.localeCompare(left.snapshot_id)
    )
}

function resolveLatestSnapshotId(root: string): string | null {
    const latestPointer = readJsonFile<{ snapshot_id?: string }>(
        resolve(root, 'latest.json')
    )
    if (
        latestPointer?.snapshot_id &&
        existsSync(resolve(root, latestPointer.snapshot_id, 'summary.json'))
    ) {
        return latestPointer.snapshot_id
    }

    return listSnapshotMetas(root)[0]?.snapshot_id ?? null
}

export function getLocalSnapshotList(): CoMovementSnapshotListResponse | null {
    const root = findSnapshotRoot()
    if (!root) return null

    const snapshots = listSnapshotMetas(root)
    return {
        count: snapshots.length,
        snapshots,
    }
}

export function getLocalLatestSnapshot(): CoMovementSnapshotSummary | null {
    const root = findSnapshotRoot()
    if (!root) return null

    const snapshotId = resolveLatestSnapshotId(root)
    if (!snapshotId) return null

    return readJsonFile<CoMovementSnapshotSummary>(
        resolve(root, snapshotId, 'summary.json')
    )
}

export function getLocalSnapshot(
    snapshotId: string
): CoMovementSnapshotSummary | null {
    const root = findSnapshotRoot()
    if (!root) return null

    return readJsonFile<CoMovementSnapshotSummary>(
        resolve(root, snapshotId, 'summary.json')
    )
}

export function getLocalSymbols(
    search = '',
    limit = 100
): CoMovementSymbolSearchResponse | null {
    const latest = getLocalLatestSnapshot()
    if (!latest) return null

    const keyword = search.trim().toUpperCase()
    const symbols = latest.symbols.filter((symbol) =>
        keyword ? symbol.includes(keyword) : true
    )

    return {
        count: Math.min(limit, symbols.length),
        total_available: latest.symbols.length,
        search,
        symbols: symbols.slice(0, limit).map((symbol) => ({ symbol })),
    }
}

export function getLocalLatestMatrix(
    matrixName: string,
    symbols: string[]
): {
    matrix_name: string
    symbols: string[]
    matrix: Record<string, Record<string, number | null>>
} | null {
    const root = findSnapshotRoot()
    if (!root) return null

    const snapshotId = resolveLatestSnapshotId(root)
    if (!snapshotId) return null

    const matrixPath = resolve(root, snapshotId, 'matrices.npz')
    if (!existsSync(matrixPath)) return null

    try {
        const npzBuffer = readFileSync(matrixPath)
        const storedSymbols = readNpyUnicodeArray(readNpzNpy(npzBuffer, 'symbols.npy'))
        const matrixPayload = readNpzNpy(npzBuffer, `${matrixName}.npy`)
        const columnCount = matrixPayload.shape[1] ?? 0

        let selectedSymbols = storedSymbols
        let selectedIndices = storedSymbols.map((_, index) => index)

        if (symbols.length > 0) {
            const requested = symbols.filter((item) => storedSymbols.includes(item))
            if (requested.length < 2) return null

            selectedSymbols = requested
            selectedIndices = requested.map((item) => storedSymbols.indexOf(item))
        }

        const matrix: Record<string, Record<string, number | null>> = {}
        selectedSymbols.forEach((rowSymbol, rowPosition) => {
            matrix[rowSymbol] = {}
            const rowIndex = selectedIndices[rowPosition]

            selectedSymbols.forEach((columnSymbol, columnPosition) => {
                const columnIndex = selectedIndices[columnPosition]
                const value = readNpyNumber(
                    matrixPayload,
                    rowIndex * columnCount + columnIndex
                )
                matrix[rowSymbol][columnSymbol] = Number.isNaN(value)
                    ? null
                    : Number(value.toFixed(6))
            })
        })

        return {
            matrix_name: matrixName,
            symbols: selectedSymbols,
            matrix,
        }
    } catch {
        return null
    }
}

function uniqueSymbols(symbols: string[]) {
    return Array.from(
        new Set(
            symbols
                .map((symbol) => symbol.trim().toUpperCase())
                .filter(Boolean)
        )
    )
}

function pairKey(left: string, right: string) {
    return [left, right].sort().join('::')
}

function matrixNumber(
    matrix: CoMovementMatrixDictionary | undefined,
    source: string,
    target: string
) {
    const value = matrix?.[source]?.[target]
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function averageHybrid(
    stocks: string[],
    matrix: CoMovementMatrixDictionary | undefined
) {
    let total = 0
    let count = 0

    for (let i = 0; i < stocks.length; i += 1) {
        for (let j = i + 1; j < stocks.length; j += 1) {
            total += matrixNumber(matrix, stocks[i], stocks[j])
            count += 1
        }
    }

    return count > 0 ? Number((total / count).toFixed(6)) : 0
}

function connectedCommunities(
    symbols: string[],
    edges: CoMovementAnalyzeResponse['graph']['edges'],
    hybridMatrix: CoMovementMatrixDictionary | undefined
) {
    const adjacency = new Map<string, Set<string>>()
    for (const symbol of symbols) {
        adjacency.set(symbol, new Set())
    }
    for (const edge of edges) {
        adjacency.get(edge.source)?.add(edge.target)
        adjacency.get(edge.target)?.add(edge.source)
    }

    const seen = new Set<string>()
    const communities: CoMovementCommunity[] = []

    for (const symbol of symbols) {
        if (seen.has(symbol)) continue

        const stack = [symbol]
        const stocks: string[] = []
        seen.add(symbol)

        while (stack.length > 0) {
            const current = stack.pop()
            if (!current) continue
            stocks.push(current)

            for (const next of adjacency.get(current) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next)
                    stack.push(next)
                }
            }
        }

        communities.push({
            community_id: communities.length,
            stocks: stocks.sort(),
            size: stocks.length,
            avg_similarity: averageHybrid(stocks, hybridMatrix),
        })
    }

    return communities.sort(
        (left, right) => right.size - left.size || right.avg_similarity - left.avg_similarity
    )
}

export function getLocalAnalyzeResult(
    body: CoMovementAnalyzeRequest
): CoMovementAnalyzeResponse | null {
    const latest = getLocalLatestSnapshot()
    if (!latest) return null

    const requestedSymbols = uniqueSymbols(body.symbols ?? [])
    if (requestedSymbols.length < 2) return null

    const universe = new Set(latest.symbols)
    const symbols = requestedSymbols.filter((symbol) => universe.has(symbol))
    if (symbols.length < 2) return null

    const matrices = MATRIX_KEYS.reduce((accumulator, matrixName) => {
        const payload = getLocalLatestMatrix(matrixName, symbols)
        if (payload) {
            accumulator[matrixName] = payload.matrix
        }
        return accumulator
    }, {} as Partial<Record<CoMovementMatrixName, CoMovementMatrixDictionary>>)

    if (MATRIX_KEYS.some((matrixName) => !matrices[matrixName])) {
        return null
    }

    const typedMatrices = matrices as Record<CoMovementMatrixName, CoMovementMatrixDictionary>
    const pairs: CoMovementPair[] = []

    for (let i = 0; i < symbols.length; i += 1) {
        for (let j = i + 1; j < symbols.length; j += 1) {
            const source = symbols[i]
            const target = symbols[j]
            pairs.push({
                source,
                target,
                pearson: matrixNumber(typedMatrices.pearson, source, target),
                spearman: matrixNumber(typedMatrices.spearman, source, target),
                dtw_similarity: matrixNumber(typedMatrices.dtw_similarity, source, target),
                hybrid_similarity: matrixNumber(typedMatrices.hybrid_similarity, source, target),
            })
        }
    }

    const pairRankings = {
        pearson: [...pairs].sort((left, right) => (right.pearson ?? 0) - (left.pearson ?? 0)),
        dtw: [...pairs].sort(
            (left, right) => (right.dtw_similarity ?? 0) - (left.dtw_similarity ?? 0)
        ),
        hybrid: [...pairs].sort(
            (left, right) =>
                (right.hybrid_similarity ?? 0) - (left.hybrid_similarity ?? 0)
        ),
    }

    const topK = Math.max(1, Math.min(10, Number(body.top_k ?? 3)))
    const minSimilarity = Math.max(0, Math.min(1, Number(body.min_similarity ?? 0.6)))
    const edgeMap = new Map<string, CoMovementAnalyzeResponse['graph']['edges'][number]>()

    for (const source of symbols) {
        const neighbors = symbols
            .filter((target) => target !== source)
            .map((target) => ({
                target,
                weight: matrixNumber(typedMatrices.hybrid_similarity, source, target),
                pearson: matrixNumber(typedMatrices.pearson, source, target),
                dtw_similarity: matrixNumber(typedMatrices.dtw_similarity, source, target),
            }))
            .sort((left, right) => right.weight - left.weight)
            .slice(0, topK)

        for (const neighbor of neighbors) {
            if (neighbor.weight < minSimilarity) continue

            const key = pairKey(source, neighbor.target)
            if (!edgeMap.has(key)) {
                edgeMap.set(key, {
                    source,
                    target: neighbor.target,
                    weight: Number(neighbor.weight.toFixed(6)),
                    pearson: Number(neighbor.pearson.toFixed(6)),
                    dtw_similarity: Number(neighbor.dtw_similarity.toFixed(6)),
                })
            }
        }
    }

    const edges = Array.from(edgeMap.values()).sort((left, right) => right.weight - left.weight)
    const communities = connectedCommunities(symbols, edges, typedMatrices.hybrid_similarity)
    const communityBySymbol = new Map<string, number>()
    for (const community of communities) {
        for (const stock of community.stocks) {
            communityBySymbol.set(stock, community.community_id)
        }
    }

    const snapshotQualityBySymbol = new Map(
        latest.data_quality.map((row) => [row.symbol, row])
    )
    const snapshotExcludedBySymbol = new Map(
        latest.excluded_symbols.map((row) => [row.symbol, row])
    )
    const excludedSymbols = requestedSymbols
        .filter((symbol) => !symbols.includes(symbol))
        .map(
            (symbol) =>
                snapshotExcludedBySymbol.get(symbol) ?? {
                    symbol,
                    reason: 'Snapshot evreninde bulunamadı.',
                }
        )

    const rollingStability = latest.rolling_stability
        .filter((row) => symbols.includes(row.source) && symbols.includes(row.target))
        .slice(0, 1000)

    const fallbackRolling =
        rollingStability.length > 0
            ? rollingStability
            : pairRankings.hybrid.slice(0, 100).map((pair) => {
                  const hybrid = pair.hybrid_similarity ?? 0
                  const source = pair.source
                  const target = pair.target
                  return {
                      pair: `${source}-${target}`,
                      source,
                      target,
                      stability: hybrid >= minSimilarity ? 1 : 0,
                      strong_windows: hybrid >= minSimilarity ? 1 : 0,
                      total_windows: 1,
                      hybrid_similarity: hybrid,
                  }
              })

    return {
        symbols,
        requested_symbols: requestedSymbols,
        excluded_symbols: excludedSymbols,
        date_range: {
            ...latest.date_range,
            start: latest.date_range.start,
            end: latest.date_range.end,
        },
        config: {
            top_k: topK,
            min_similarity: minSimilarity,
            rolling_window: Number(body.rolling_window ?? latest.config.rolling_window),
            rolling_step: Number(body.rolling_step ?? latest.config.rolling_step),
            max_missing_ratio: Number(
                body.max_missing_ratio ?? latest.config.max_missing_ratio
            ),
            min_history_rows: Number(body.min_history_rows ?? latest.config.min_history_rows),
        },
        top_pairs: pairRankings.hybrid,
        pair_rankings: pairRankings,
        graph: {
            nodes: symbols.map((symbol) => ({
                id: symbol,
                label: symbol,
                community_id: communityBySymbol.get(symbol) ?? 0,
            })),
            edges,
        },
        communities,
        metrics: {
            modularity:
                communities.length > 1 && edges.length > 0
                    ? latest.metrics.modularity
                    : 0,
            community_count: communities.length,
            edge_count: edges.length,
            node_count: symbols.length,
            pair_count: pairs.length,
            rolling_window_count: fallbackRolling[0]?.total_windows ?? 0,
            louvain_method: 'snapshot-subset',
        },
        rolling_stability: fallbackRolling,
        data_quality: symbols
            .map((symbol) => snapshotQualityBySymbol.get(symbol))
            .filter((row): row is CoMovementAnalyzeResponse['data_quality'][number] =>
                Boolean(row)
            ),
        matrices: typedMatrices,
    }
}

function heuristicSummaryText({
    top_pairs,
    communities,
    metrics,
    symbols,
    date_range,
}: {
    top_pairs: CoMovementPair[]
    communities: CoMovementCommunity[]
    metrics: Partial<CoMovementMetrics>
    symbols: string[]
    date_range?: Partial<CoMovementDateRange>
}) {
    const parts: string[] = []

    if (symbols.length > 0) {
        parts.push(`Analiz ${symbols.length} hisse uzerinde degerlendirildi.`)
    }

    if (date_range?.start && date_range?.end) {
        parts.push(`Donem ${date_range.start} ile ${date_range.end} araligini kapsiyor.`)
    }

    if (top_pairs.length > 0) {
        const leader = top_pairs[0]
        parts.push(
            `En guclu cift ${leader.source}-${leader.target}; hybrid ${leader.hybrid_similarity}, Pearson ${leader.pearson} ve DTW ${leader.dtw_similarity} seviyesinde.`
        )
    }

    if (communities.length > 0) {
        const largest = [...communities].sort(
            (left, right) => right.size - left.size || left.community_id - right.community_id
        )[0]
        parts.push(
            `En belirgin community ${largest.community_id}; ${largest.size} hisse iceriyor ve ortalama benzerlik ${largest.avg_similarity}.`
        )
    }

    if (metrics.modularity !== undefined) {
        parts.push(
            `Graph modularity skoru ${metrics.modularity}; bu skor grup ayrisiminin kuvvetini gosterir.`
        )
    }

    if (parts.length === 0) {
        parts.push('Saglanan metriklere gore anlamli bir co-movement ozeti uretilemedi.')
    }

    return parts.join(' ')
}

export function getLocalExplanation(payload: {
    top_pairs: CoMovementPair[]
    communities: CoMovementCommunity[]
    metrics: Partial<CoMovementMetrics>
    symbols?: string[]
    date_range?: Partial<CoMovementDateRange>
}): CoMovementExplainResponse {
    return {
        summary: heuristicSummaryText({
            top_pairs: payload.top_pairs,
            communities: payload.communities,
            metrics: payload.metrics,
            symbols: payload.symbols ?? [],
            date_range: payload.date_range,
        }),
        warnings: [
            'Bu sonuc gecmis fiyat verilerine dayanir.',
            'Yorum katmani yalnizca hesaplanan metrikleri aciklar.',
            'Yatirim tavsiyesi degildir.',
        ],
        source: 'fallback',
        model: null,
    }
}

export async function readProxyPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return response.json()
    }

    const text = await response.text()
    return text ? { detail: text } : { detail: response.statusText || 'Request failed' }
}
