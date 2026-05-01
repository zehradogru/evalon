import type {
    CoMovementCommunity,
    CoMovementEdge,
    CoMovementMatrixDictionary,
    CoMovementPair,
    CoMovementRollingStabilityRow,
    CoMovementSnapshotSummary,
} from '@/types'

export const COMMUNITY_COLORS = [
    '#22c55e',
    '#38bdf8',
    '#f97316',
    '#facc15',
    '#a78bfa',
    '#f472b6',
    '#14b8a6',
    '#fb7185',
    '#60a5fa',
    '#84cc16',
    '#ef4444',
    '#06b6d4',
]

type EndpointLike = string | { id?: string }

export function endpointId(endpoint: EndpointLike): string {
    return typeof endpoint === 'string' ? endpoint : endpoint.id ?? ''
}

export function edgeSourceId(edge: { source: EndpointLike }): string {
    return endpointId(edge.source)
}

export function edgeTargetId(edge: { target: EndpointLike }): string {
    return endpointId(edge.target)
}

export function formatDateLabel(value?: string): string {
    if (!value) return '—'

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value

    return parsed.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    })
}

export function formatNumber(value?: number | null, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    return value.toFixed(digits)
}

export function formatPercent(value?: number | null, digits = 1): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    return `${(value * 100).toFixed(digits)}%`
}

export function communityColor(communityId?: number): string {
    if (communityId === undefined || communityId === null || communityId < 0) {
        return '#94a3b8'
    }

    return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length]
}

export function matrixValue(
    matrix: CoMovementMatrixDictionary | undefined,
    row: string,
    column: string
): number | null {
    return matrix?.[row]?.[column] ?? null
}

export function averageEdgeWeight(
    community: CoMovementCommunity | undefined,
    edges: CoMovementEdge[]
): number {
    if (!community || community.stocks.length < 2) return 0

    const stockSet = new Set(community.stocks)
    const inside = edges.filter(
        (edge) => stockSet.has(edgeSourceId(edge)) && stockSet.has(edgeTargetId(edge))
    )

    if (inside.length === 0) return 0

    return inside.reduce((total, edge) => total + edge.weight, 0) / inside.length
}

export function createPairKey(left: string, right: string): string {
    return [left, right].sort().join('::')
}

export function parsePairKey(pairKey: string): [string, string] | null {
    const [left, right] = pairKey.split('::')
    if (!left || !right) return null
    return [left, right]
}

export function getTopPairOptions(pairs: CoMovementPair[], limit = 12): CoMovementPair[] {
    return pairs.slice(0, limit)
}

export function getLargestCommunity(
    snapshot: Pick<CoMovementSnapshotSummary, 'communities'>
): CoMovementCommunity | undefined {
    return [...snapshot.communities].sort(
        (left, right) => right.size - left.size || left.community_id - right.community_id
    )[0]
}

export function buildCommunitySubset(
    community: CoMovementCommunity | undefined,
    limit = 12
): string[] {
    if (!community) return []
    return community.stocks.slice(0, limit)
}

export function buildPairSubset(
    pair: CoMovementPair | undefined,
    relatedPairs: CoMovementPair[],
    limit = 12
): string[] {
    if (!pair) return []

    const ordered = [pair.source, pair.target]
    for (const item of relatedPairs) {
        if (ordered.length >= limit) break
        if (item.source === pair.source || item.target === pair.source) {
            const candidate = item.source === pair.source ? item.target : item.source
            if (!ordered.includes(candidate)) ordered.push(candidate)
        }
        if (item.source === pair.target || item.target === pair.target) {
            const candidate = item.source === pair.target ? item.target : item.source
            if (!ordered.includes(candidate)) ordered.push(candidate)
        }
    }

    return ordered.slice(0, limit)
}

export function normalizeManualSubset(symbols: string[], limit = 12): string[] {
    return Array.from(
        new Set(
            symbols
                .map((item) => item.trim().toUpperCase())
                .filter(Boolean)
        )
    ).slice(0, limit)
}

export function topMissingRows(rows: CoMovementSnapshotSummary['data_quality'], limit = 12) {
    return [...rows]
        .sort(
            (left, right) =>
                right.missing_ratio - left.missing_ratio ||
                right.filled_rows - left.filled_rows ||
                left.symbol.localeCompare(right.symbol)
        )
        .slice(0, limit)
}

export function topExcludedRows(
    rows: CoMovementSnapshotSummary['excluded_symbols'],
    limit = 12
) {
    return rows.slice(0, limit)
}

export function topStablePairs(
    rows: CoMovementRollingStabilityRow[],
    limit = 20
): CoMovementRollingStabilityRow[] {
    return rows.slice(0, limit)
}
