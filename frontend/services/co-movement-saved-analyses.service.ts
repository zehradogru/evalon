import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit as firestoreLimit,
    orderBy,
    query,
    setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
    CoMovementAnalyzeRequest,
    CoMovementAnalyzeResponse,
    CoMovementExplainResponse,
    CoMovementMatrixDictionary,
    CoMovementMatrixName,
} from '@/types'

const USERS_COLLECTION = 'users'
const ANALYSES_COLLECTION = 'coMovementAnalyses'
const MATRICES_COLLECTION = 'matrices'
const MATRIX_NAMES: CoMovementMatrixName[] = [
    'pearson',
    'spearman',
    'dtw_distance',
    'dtw_similarity',
    'hybrid_similarity',
]
const TOP_PAIRS_LIMIT = 1000
const PAIR_RANKING_LIMIT = 500
const ROLLING_STABILITY_LIMIT = 1000

type StoredCoMovementResult = Omit<CoMovementAnalyzeResponse, 'matrices'>

export interface SavedCoMovementExplainScope {
    type: 'market' | 'community' | 'pair' | 'symbols'
    key: string
    label: string
    description: string
    communityId?: number
    pairKey?: string
    symbols?: string[]
}

export interface SavedCoMovementAnalysisSummary {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    symbols: string[]
    dateRange: {
        start: string
        end: string
    }
    metrics: {
        community_count: number
        edge_count: number
        node_count: number
    }
    leadPair: {
        source: string
        target: string
        hybrid_similarity?: number
    } | null
}

interface StoredCoMovementAnalysis extends SavedCoMovementAnalysisSummary {
    request: CoMovementAnalyzeRequest
    result: StoredCoMovementResult
    explanation?: CoMovementExplainResponse
    explanationScope?: SavedCoMovementExplainScope
}

export interface SavedCoMovementAnalysis extends StoredCoMovementAnalysis {
    result: CoMovementAnalyzeResponse
}

export interface SaveCoMovementAnalysisPayload {
    title?: string
    request: CoMovementAnalyzeRequest
    result: CoMovementAnalyzeResponse
    explanation?: CoMovementExplainResponse | null
    explanationScope?: SavedCoMovementExplainScope | null
}

function analysesCollection(userId: string) {
    return collection(db, USERS_COLLECTION, userId, ANALYSES_COLLECTION)
}

function analysisDoc(userId: string, analysisId: string) {
    return doc(db, USERS_COLLECTION, userId, ANALYSES_COLLECTION, analysisId)
}

function matrixDoc(userId: string, analysisId: string, matrixName: CoMovementMatrixName) {
    return doc(
        db,
        USERS_COLLECTION,
        userId,
        ANALYSES_COLLECTION,
        analysisId,
        MATRICES_COLLECTION,
        matrixName
    )
}

function defaultTitle(result: CoMovementAnalyzeResponse) {
    const visible = result.symbols.slice(0, 4).join(', ')
    const suffix = result.symbols.length > 4 ? ` +${result.symbols.length - 4}` : ''
    return `${visible}${suffix}`
}

function capResult(result: CoMovementAnalyzeResponse): StoredCoMovementResult {
    const rest = { ...result } as Partial<CoMovementAnalyzeResponse>
    delete rest.matrices

    return {
        ...(rest as StoredCoMovementResult),
        top_pairs: result.top_pairs.slice(0, TOP_PAIRS_LIMIT),
        pair_rankings: {
            pearson: result.pair_rankings.pearson.slice(0, PAIR_RANKING_LIMIT),
            dtw: result.pair_rankings.dtw.slice(0, PAIR_RANKING_LIMIT),
            hybrid: result.pair_rankings.hybrid.slice(0, PAIR_RANKING_LIMIT),
        },
        rolling_stability: result.rolling_stability.slice(0, ROLLING_STABILITY_LIMIT),
    }
}

function buildSummary(
    analysisId: string,
    payload: SaveCoMovementAnalysisPayload,
    now: string
): SavedCoMovementAnalysisSummary {
    const leadPair = payload.result.top_pairs[0] ?? null

    return {
        id: analysisId,
        title: payload.title?.trim() || defaultTitle(payload.result),
        createdAt: now,
        updatedAt: now,
        symbols: payload.result.symbols,
        dateRange: {
            start: payload.result.date_range.start,
            end: payload.result.date_range.end,
        },
        metrics: {
            community_count: payload.result.metrics.community_count,
            edge_count: payload.result.metrics.edge_count,
            node_count: payload.result.metrics.node_count,
        },
        leadPair: leadPair
            ? {
                  source: leadPair.source,
                  target: leadPair.target,
                  hybrid_similarity: leadPair.hybrid_similarity,
              }
            : null,
    }
}

function normalizeSummary(
    analysisId: string,
    value: unknown
): SavedCoMovementAnalysisSummary | null {
    if (!value || typeof value !== 'object') return null
    const raw = value as Partial<SavedCoMovementAnalysisSummary>
    if (!raw.title || !raw.createdAt || !raw.updatedAt || !Array.isArray(raw.symbols)) {
        return null
    }

    return {
        id: analysisId,
        title: raw.title,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        symbols: raw.symbols,
        dateRange: {
            start: raw.dateRange?.start ?? '',
            end: raw.dateRange?.end ?? '',
        },
        metrics: {
            community_count: raw.metrics?.community_count ?? 0,
            edge_count: raw.metrics?.edge_count ?? 0,
            node_count: raw.metrics?.node_count ?? raw.symbols.length,
        },
        leadPair: raw.leadPair ?? null,
    }
}

async function loadMatrices(
    userId: string,
    analysisId: string
): Promise<Record<CoMovementMatrixName, CoMovementMatrixDictionary>> {
    const entries = await Promise.all(
        MATRIX_NAMES.map(async (matrixName) => {
            const snapshot = await getDoc(matrixDoc(userId, analysisId, matrixName))
            const data = snapshot.data() as
                | { matrix?: CoMovementMatrixDictionary }
                | undefined
            return [matrixName, data?.matrix ?? {}] as const
        })
    )

    return Object.fromEntries(entries) as Record<
        CoMovementMatrixName,
        CoMovementMatrixDictionary
    >
}

export const coMovementSavedAnalysesService = {
    async list(userId: string, count = 10): Promise<SavedCoMovementAnalysisSummary[]> {
        const snapshot = await getDocs(
            query(
                analysesCollection(userId),
                orderBy('updatedAt', 'desc'),
                firestoreLimit(count)
            )
        )

        return snapshot.docs
            .map((item) => normalizeSummary(item.id, item.data()))
            .filter(
                (item): item is SavedCoMovementAnalysisSummary => item !== null
            )
    },

    async get(userId: string, analysisId: string): Promise<SavedCoMovementAnalysis> {
        const snapshot = await getDoc(analysisDoc(userId, analysisId))
        if (!snapshot.exists()) {
            throw new Error('Kayıtlı analiz bulunamadı.')
        }

        const stored = snapshot.data() as StoredCoMovementAnalysis
        const matrices = await loadMatrices(userId, analysisId)

        return {
            ...stored,
            id: analysisId,
            result: {
                ...stored.result,
                matrices,
            },
        }
    },

    async save(
        userId: string,
        payload: SaveCoMovementAnalysisPayload
    ): Promise<SavedCoMovementAnalysisSummary> {
        const now = new Date().toISOString()
        const ref = doc(analysesCollection(userId))
        const summary = buildSummary(ref.id, payload, now)
        const stored: StoredCoMovementAnalysis = {
            ...summary,
            request: payload.request,
            result: capResult(payload.result),
            explanation: payload.explanation ?? undefined,
            explanationScope: payload.explanationScope ?? undefined,
        }

        await setDoc(ref, stored)
        await Promise.all(
            MATRIX_NAMES.map((matrixName) =>
                setDoc(matrixDoc(userId, ref.id, matrixName), {
                    matrixName,
                    symbols: payload.result.symbols,
                    matrix: payload.result.matrices[matrixName] ?? {},
                })
            )
        )

        return summary
    },

    async rename(
        userId: string,
        analysisId: string,
        title: string
    ): Promise<void> {
        const normalizedTitle = title.trim()
        if (!normalizedTitle) {
            throw new Error('Analiz adı boş olamaz.')
        }

        await setDoc(
            analysisDoc(userId, analysisId),
            {
                title: normalizedTitle,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        )
    },

    async delete(userId: string, analysisId: string): Promise<void> {
        await Promise.all(
            MATRIX_NAMES.map((matrixName) =>
                deleteDoc(matrixDoc(userId, analysisId, matrixName))
            )
        )
        await deleteDoc(analysisDoc(userId, analysisId))
    },
}
