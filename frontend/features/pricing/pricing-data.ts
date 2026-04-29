export interface PricingPlan {
    id: string
    name: string
    price: {
        monthly: number
        yearly: number
        yearlyTotal: number
    }
    description: string
    features: string[]
    highlight?: boolean
    cta: string
}
