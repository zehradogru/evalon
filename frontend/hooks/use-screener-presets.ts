'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/use-auth-store'
import {
    SaveScreenerPresetPayload,
    screenerPresetService,
} from '@/services/screener-preset.service'
import type { UserScreenerPreset } from '@/types'

const USER_SCREENER_PRESETS_QUERY_KEY = 'user-screener-presets'

export function useScreenerPresets() {
    const { user, isAuthenticated } = useAuthStore()

    return useQuery({
        queryKey: [USER_SCREENER_PRESETS_QUERY_KEY, user?.id],
        queryFn: () => screenerPresetService.getOrCreatePresets(),
        enabled: isAuthenticated && Boolean(user?.id),
        staleTime: 1000 * 60 * 5,
    })
}

function useScreenerPresetCacheSync() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id)

    const syncPresets = (presets: UserScreenerPreset[]) => {
        if (!userId) return
        queryClient.setQueryData(
            [USER_SCREENER_PRESETS_QUERY_KEY, userId],
            presets
        )
    }

    return { syncPresets }
}

export function useSaveScreenerPreset() {
    const { syncPresets } = useScreenerPresetCacheSync()

    return useMutation({
        mutationFn: (payload: SaveScreenerPresetPayload) =>
            screenerPresetService.savePreset(payload),
        onSuccess: (presets) => {
            syncPresets(presets)
        },
    })
}

export function useDeleteScreenerPreset() {
    const { syncPresets } = useScreenerPresetCacheSync()

    return useMutation({
        mutationFn: (presetId: string) => screenerPresetService.deletePreset(presetId),
        onSuccess: (presets) => {
            syncPresets(presets)
        },
    })
}
