'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { isMarketCurrentlyOpen } from '@/hooks/use-dashboard-data'
import type {
    ListSortDirection,
    MarketListItem,
    MarketListSortField,
    MarketListView,
    PaginatedListResponse,
} from '@/types'

interface UseMarketListParams {
    view: MarketListView
    limit?: number
    sortBy?: MarketListSortField
    sortDir?: ListSortDirection
    q?: string
    enabled?: boolean
}

const DEFAULT_LIMIT = 10

async function fetchMarketListPage(
    params: UseMarketListParams,
    cursor?: string
): Promise<PaginatedListResponse<MarketListItem>> {
    const searchParams = new URLSearchParams()

    searchParams.set('view', params.view)
    searchParams.set('limit', String(params.limit ?? DEFAULT_LIMIT))
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortDir) searchParams.set('sortDir', params.sortDir)
    if (params.q?.trim()) searchParams.set('q', params.q.trim())
    if (cursor) searchParams.set('cursor', cursor)

    const response = await fetch(`/api/markets/list?${searchParams.toString()}`)
    if (!response.ok) {
        throw new Error('Failed to fetch market list')
    }

    return response.json()
}

export function useMarketList(params: UseMarketListParams) {
    return useInfiniteQuery({
        queryKey: [
            'market-list',
            params.view,
            params.limit ?? DEFAULT_LIMIT,
            params.sortBy ?? 'changePct',
            params.sortDir ?? 'desc',
            params.q ?? '',
        ],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => fetchMarketListPage(params, pageParam),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        staleTime: 60 * 1000,
        refetchInterval: () => (isMarketCurrentlyOpen() ? 60 * 1000 : false),
        enabled: params.enabled ?? true,
    })
}
