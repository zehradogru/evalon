'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/use-auth-store'
import { watchlistService } from '@/services/watchlist.service'
import type { UserWatchlist } from '@/types'

const USER_WATCHLIST_QUERY_KEY = 'user-watchlist'

export function useUserWatchlist() {
    const { user, isAuthenticated } = useAuthStore()

    return useQuery({
        queryKey: [USER_WATCHLIST_QUERY_KEY, user?.id],
        queryFn: () => watchlistService.getOrCreateWatchlist(),
        enabled: isAuthenticated && Boolean(user?.id),
        staleTime: 1000 * 60 * 5,
    })
}

function useWatchlistCacheSync() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id)

    const syncWatchlist = (watchlist: UserWatchlist) => {
        if (!userId) return

        queryClient.setQueryData([USER_WATCHLIST_QUERY_KEY, userId], watchlist)
        void queryClient.invalidateQueries({ queryKey: ['watchlist'] })
        void queryClient.invalidateQueries({ queryKey: ['dashboard-watchlist'] })
    }

    return { syncWatchlist }
}

export function useAddWatchlistTicker() {
    const { syncWatchlist } = useWatchlistCacheSync()

    return useMutation({
        mutationFn: (ticker: string) => watchlistService.addTicker(ticker),
        onSuccess: (watchlist) => {
            syncWatchlist(watchlist)
        },
    })
}

export function useRemoveWatchlistTicker() {
    const { syncWatchlist } = useWatchlistCacheSync()

    return useMutation({
        mutationFn: (ticker: string) => watchlistService.removeTicker(ticker),
        onSuccess: (watchlist) => {
            syncWatchlist(watchlist)
        },
    })
}

export function useReplaceWatchlistTickers() {
    const { syncWatchlist } = useWatchlistCacheSync()

    return useMutation({
        mutationFn: (tickers: string[]) => watchlistService.replaceTickers(tickers),
        onSuccess: (watchlist) => {
            syncWatchlist(watchlist)
        },
    })
}

export const useReplaceWatchlist = useReplaceWatchlistTickers
