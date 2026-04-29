import { useQuery } from '@tanstack/react-query'
import type { PricingPlan } from '@/features/pricing/pricing-data'

async function fetchPlans(): Promise<PricingPlan[]> {
    const res = await fetch('/api/pricing')
    if (!res.ok) throw new Error('Failed to fetch pricing plans')
    const json = await res.json() as { plans: PricingPlan[] }
    return json.plans
}

export function usePricing() {
    return useQuery<PricingPlan[]>({
        queryKey: ['pricing-plans'],
        queryFn: fetchPlans,
        staleTime: 1000 * 60 * 5,   // 5 min
        gcTime: 1000 * 60 * 30,     // keep in cache 30 min
        retry: 2,
    })
}
