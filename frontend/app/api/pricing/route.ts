import { NextResponse } from 'next/server'
import type { PricingPlan } from '@/features/pricing/pricing-data'

// ---------------------------------------------------------------------------
// Pricing configuration — single source of truth
// Update prices/features here; all UI reads from this endpoint at runtime.
// When Stripe is integrated: fetch from Stripe.prices.list() instead.
// ---------------------------------------------------------------------------

const PLANS: PricingPlan[] = [
    {
        id: 'basic',
        name: 'Basic',
        price: {
            monthly: 0,
            yearly: 0,
            yearlyTotal: 0,
        },
        description: 'Essential tools for casual traders.',
        features: [
            'Real-time market data (15 min delay)',
            'Basic charting & market overview',
            '1 Watchlist',
            'News feed',
            'Community access',
        ],
        cta: 'Get Started',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: {
            monthly: 29,
            yearly: 23,
            yearlyTotal: 276,
        },
        description: 'Advanced features for serious traders.',
        features: [
            'Real-time data (No delay)',
            'Advanced charting & indicators',
            'Unlimited Watchlists',
            'Backtesting engine',
            'AI Market Analysis (Evalon AI)',
            'Screener access',
            'Paper Trading',
            'Price Alerts',
            'Ad-free experience',
        ],
        highlight: true,
        cta: 'Try Pro Free',
    },
    {
        id: 'premium',
        name: 'Premium',
        price: {
            monthly: 59,
            yearly: 49,
            yearlyTotal: 588,
        },
        description: 'Professional grade power and speed.',
        features: [
            'Everything in Pro',
            'Strategy Builder',
            'Correlation Analysis',
            'API Access',
            'Priority Support',
            'Academy access',
            'Dedicated Account Manager',
        ],
        cta: 'Contact Sales',
    },
]

export async function GET() {
    return NextResponse.json(
        { plans: PLANS },
        {
            headers: {
                // Cache for 5 min at CDN edge; revalidate in background
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        }
    )
}
