export interface PricingPlan {
    id: string
    name: string
    price: {
        monthly: number
        yearly: number
    }
    description: string
    features: string[]
    highlight?: boolean
    cta: string
}

export const PRICING_PLANS: PricingPlan[] = [
    {
        id: 'basic',
        name: 'Basic',
        price: {
            monthly: 0,
            yearly: 0
        },
        description: 'Essential tools for casual traders.',
        features: [
            'Real-time market data (15 min delay)',
            'Basic charting tools',
            '1 Watchlist',
            '5 Indicators per chart',
            'Community access'
        ],
        cta: 'Get Started'
    },
    {
        id: 'pro',
        name: 'Pro',
        price: {
            monthly: 29,
            yearly: 290
        },
        description: 'Advanced features for serious traders.',
        features: [
            'Real-time data (No delay)',
            'Advanced charting & indicators',
            'Unlimited Watchlists',
            'Backtesting engine',
            'AI Market Analysis',
            'Price Alerts',
            'Ad-free experience'
        ],
        highlight: true,
        cta: 'Try Pro Free'
    },
    {
        id: 'premium',
        name: 'Premium',
        price: {
            monthly: 59,
            yearly: 590
        },
        description: 'Professional grade power and speed.',
        features: [
            'Everything in Pro',
            'Lowest latency data',
            'API Access',
            'Priority Support',
            'Dedicated Account Manager',
            'Institutional research',
            'Custom Strategy Builder'
        ],
        cta: 'Contact Sales'
    }
]
