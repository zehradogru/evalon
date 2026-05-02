'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    coMovementSavedAnalysesService,
    type SaveCoMovementAnalysisPayload,
} from '@/services/co-movement-saved-analyses.service'

const QUERY_KEY = 'co-movement-saved-analyses'

export function useSavedCoMovementAnalyses(userId?: string | null, count = 50) {
    return useQuery({
        queryKey: [QUERY_KEY, userId, count],
        queryFn: () => coMovementSavedAnalysesService.list(userId!, count),
        enabled: Boolean(userId),
        staleTime: 1000 * 60,
    })
}

export function useSaveCoMovementAnalysis(userId?: string | null) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: SaveCoMovementAnalysisPayload) => {
            if (!userId) {
                throw new Error('Analizi kaydetmek için giriş yapmalısınız.')
            }
            return coMovementSavedAnalysesService.save(userId, payload)
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] })
        },
    })
}

export function useOpenSavedCoMovementAnalysis(userId?: string | null) {
    return useMutation({
        mutationFn: (analysisId: string) => {
            if (!userId) {
                throw new Error('Kayıtlı analizi açmak için giriş yapmalısınız.')
            }
            return coMovementSavedAnalysesService.get(userId, analysisId)
        },
    })
}

export function useDeleteSavedCoMovementAnalysis(userId?: string | null) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (analysisId: string) => {
            if (!userId) {
                throw new Error('Kayıtlı analizi silmek için giriş yapmalısınız.')
            }
            return coMovementSavedAnalysesService.delete(userId, analysisId)
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] })
        },
    })
}

export function useRenameSavedCoMovementAnalysis(userId?: string | null) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ analysisId, title }: { analysisId: string; title: string }) => {
            if (!userId) {
                throw new Error('Kayıtlı analizi yeniden adlandırmak için giriş yapmalısınız.')
            }
            return coMovementSavedAnalysesService.rename(userId, analysisId, title)
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] })
        },
    })
}
