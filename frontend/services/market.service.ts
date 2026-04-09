import { Market } from '@/types'
import { mockMarkets } from '@/data/markets.mock'
import { USE_MOCK_DATA } from '@/lib/constants'
import { apiClient } from '@/lib/api-client'

export const marketService = {
    /**
     * Get all markets
     */
    async getAll(): Promise<Market[]> {
        if (USE_MOCK_DATA) {
            // Simulate API delay
            await new Promise((resolve) => setTimeout(resolve, 500))
            return mockMarkets
        }

        const response = await apiClient.get<Market[]>('/markets')
        return response.data
    },

    /**
     * Get markets by category
     */
    async getByCategory(
        category: 'BIST' | 'NASDAQ' | 'FOREX' | 'CRYPTO'
    ): Promise<Market[]> {
        if (USE_MOCK_DATA) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            return mockMarkets.filter((m) => m.category === category)
        }

        const response = await apiClient.get<Market[]>(`/markets/${category}`)
        return response.data
    },

    /**
     * Get market by ID
     */
    async getById(id: string): Promise<Market | null> {
        if (USE_MOCK_DATA) {
            await new Promise((resolve) => setTimeout(resolve, 300))
            return mockMarkets.find((m) => m.id === id) || null
        }

        const response = await apiClient.get<Market>(`/markets/${id}`)
        return response.data
    },
}
