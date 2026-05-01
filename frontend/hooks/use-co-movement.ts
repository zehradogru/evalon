'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import {
    analyzeCoMovement,
    explainCoMovement,
    fetchCoMovementSnapshot,
    fetchCoMovementSnapshots,
    fetchCoMovementSymbols,
    fetchLatestCoMovementMatrix,
    fetchLatestCoMovementSnapshot,
} from '@/services/co-movement.service'
import type {
    CoMovementAnalyzeRequest,
    CoMovementExplainRequest,
    CoMovementMatrixName,
} from '@/types'

export function useCoMovementSnapshots() {
    return useQuery({
        queryKey: ['co-movement-snapshots'],
        queryFn: fetchCoMovementSnapshots,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
    })
}

export function useLatestCoMovementSnapshot() {
    return useQuery({
        queryKey: ['co-movement-snapshot', 'latest'],
        queryFn: fetchLatestCoMovementSnapshot,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
    })
}

export function useCoMovementSnapshot(snapshotId: string | null) {
    return useQuery({
        queryKey: ['co-movement-snapshot', snapshotId],
        queryFn: () => fetchCoMovementSnapshot(snapshotId!),
        enabled: Boolean(snapshotId),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
    })
}

export function useCoMovementSymbolSearch(search: string, limit = 12) {
    return useQuery({
        queryKey: ['co-movement-symbols', search, limit],
        queryFn: () => fetchCoMovementSymbols({ search, limit }),
        enabled: search.trim().length > 0,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    })
}

export function useLatestCoMovementMatrix(
    matrixName: CoMovementMatrixName,
    symbols: string[],
    enabled = true
) {
    return useQuery({
        queryKey: ['co-movement-matrix', 'latest', matrixName, symbols],
        queryFn: () => fetchLatestCoMovementMatrix(matrixName, symbols),
        enabled: enabled && symbols.length >= 2,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
    })
}

export function useAnalyzeCoMovement() {
    return useMutation({
        mutationFn: (payload: CoMovementAnalyzeRequest) => analyzeCoMovement(payload),
    })
}

export function useExplainCoMovement() {
    return useMutation({
        mutationFn: (payload: CoMovementExplainRequest) => explainCoMovement(payload),
    })
}
