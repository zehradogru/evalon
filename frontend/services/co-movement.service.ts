import type {
    CoMovementAnalyzeRequest,
    CoMovementAnalyzeResponse,
    CoMovementExplainRequest,
    CoMovementExplainResponse,
    CoMovementMatrixName,
    CoMovementMatrixResponse,
    CoMovementSnapshotListResponse,
    CoMovementSnapshotSummary,
    CoMovementSymbolSearchResponse,
} from '@/types'

const BASE = '/api/co-movement'

async function readError(response: Response): Promise<string> {
    try {
        const payload = await response.json()
        if (
            payload &&
            typeof payload === 'object' &&
            'detail' in payload &&
            typeof payload.detail === 'string'
        ) {
            return payload.detail
        }
    } catch {
        // Ignore malformed JSON payloads and fall back to response status text.
    }

    return response.statusText || 'Request failed'
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        throw new Error(await readError(response) || fallback)
    }

    return response.json() as Promise<T>
}

export async function fetchCoMovementSymbols(params?: {
    search?: string
    limit?: number
}): Promise<CoMovementSymbolSearchResponse> {
    const url = new URL(`${BASE}/symbols`, window.location.origin)
    if (params?.search) {
        url.searchParams.set('search', params.search)
    }
    if (params?.limit) {
        url.searchParams.set('limit', String(params.limit))
    }

    const response = await fetch(url.toString(), {
        cache: 'no-store',
    })

    return readJson<CoMovementSymbolSearchResponse>(
        response,
        'Co-movement symbols could not be loaded.'
    )
}

export async function fetchCoMovementSnapshots(): Promise<CoMovementSnapshotListResponse> {
    const response = await fetch(`${BASE}/snapshots`, {
        cache: 'no-store',
    })

    return readJson<CoMovementSnapshotListResponse>(
        response,
        'Co-movement snapshots could not be loaded.'
    )
}

export async function fetchLatestCoMovementSnapshot(): Promise<CoMovementSnapshotSummary> {
    const response = await fetch(`${BASE}/snapshots/latest`, {
        cache: 'no-store',
    })

    return readJson<CoMovementSnapshotSummary>(
        response,
        'Latest co-movement snapshot could not be loaded.'
    )
}

export async function fetchCoMovementSnapshot(
    snapshotId: string
): Promise<CoMovementSnapshotSummary> {
    const response = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}`, {
        cache: 'no-store',
    })

    return readJson<CoMovementSnapshotSummary>(
        response,
        'Co-movement snapshot could not be loaded.'
    )
}

export async function fetchLatestCoMovementMatrix(
    matrixName: CoMovementMatrixName,
    symbols?: string[]
): Promise<CoMovementMatrixResponse> {
    const url = new URL(
        `${BASE}/snapshots/latest/matrices/${encodeURIComponent(matrixName)}`,
        window.location.origin
    )
    if (symbols && symbols.length > 0) {
        url.searchParams.set('symbols', symbols.join(','))
    }

    const response = await fetch(url.toString(), {
        cache: 'no-store',
    })

    return readJson<CoMovementMatrixResponse>(
        response,
        `${matrixName} matrix could not be loaded.`
    )
}

export async function analyzeCoMovement(
    payload: CoMovementAnalyzeRequest
): Promise<CoMovementAnalyzeResponse> {
    const response = await fetch(`${BASE}/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return readJson<CoMovementAnalyzeResponse>(
        response,
        'Co-movement analysis failed.'
    )
}

export async function explainCoMovement(
    payload: CoMovementExplainRequest
): Promise<CoMovementExplainResponse> {
    const response = await fetch(`${BASE}/explain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return readJson<CoMovementExplainResponse>(
        response,
        'Co-movement explanation could not be generated.'
    )
}
