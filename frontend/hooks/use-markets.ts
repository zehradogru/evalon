'use client'

import { useQuery } from '@tanstack/react-query'
import { marketService } from '@/services/market.service'

/**
 * Hook to fetch all markets
 */
export function useMarkets() {
    return useQuery({
        queryKey: ['markets'],
        queryFn: marketService.getAll,
    })
}

/**
 * Hook to fetch markets by category
 */
export function useMarketsByCategory(
    category: 'BIST' | 'NASDAQ' | 'FOREX' | 'CRYPTO'
) {
    return useQuery({
        queryKey: ['markets', category],
        queryFn: () => marketService.getByCategory(category),
    })
}
