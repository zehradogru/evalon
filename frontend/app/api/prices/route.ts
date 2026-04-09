import { NextRequest, NextResponse } from 'next/server'
import type { PriceBar } from '@/types'

const EVALON_API_URL = process.env.NEXT_PUBLIC_EVALON_API_URL || 'https://evalon-mu.vercel.app'

/**
 * Calculate start date and fetch limit to ensure we get the most recent data.
 * Same logic as the batch endpoint and price.service.ts.
 */
function getRecentFetchParams(timeframe: string, requestedLimit: number): { start: string; fetchLimit: number } {
    const now = new Date()
    let daysBack: number
    let fetchLimit: number

    switch (timeframe) {
        case '1m':
            daysBack = 3 // 3 days (covers weekends)
            fetchLimit = Math.max(1500, requestedLimit) // ~3 trading days × 480 bars
            break
        case '5m':
            daysBack = 7
            fetchLimit = Math.max(500, requestedLimit)
            break
        case '1h':
            daysBack = 14
            fetchLimit = Math.max(200, requestedLimit)
            break
        case '1d':
            daysBack = Math.max(30, requestedLimit + 14)
            fetchLimit = Math.max(50, requestedLimit + 10)
            break
        case '1w':
            daysBack = Math.max(180, requestedLimit * 7 + 30)
            fetchLimit = Math.max(30, requestedLimit + 5)
            break
        case '1M':
            daysBack = Math.max(365, requestedLimit * 30 + 60)
            fetchLimit = Math.max(20, requestedLimit + 3)
            break
        default:
            daysBack = 30
            fetchLimit = requestedLimit
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return {
        start: startDate.toISOString().split('T')[0],
        fetchLimit
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')
    const requestedLimit = parseInt(searchParams.get('limit') || '100')
    const start = searchParams.get('start')

    if (!ticker || !timeframe) {
        return NextResponse.json(
            { error: 'Missing required parameters: ticker, timeframe' },
            { status: 400 }
        )
    }

    // Calculate smart fetch params when start is not provided
    const params = start
        ? { start, fetchLimit: Math.max(requestedLimit, requestedLimit + 10) }
        : getRecentFetchParams(timeframe, requestedLimit)

    const url = `${EVALON_API_URL}/v1/prices?ticker=${ticker}&timeframe=${timeframe}&limit=${params.fetchLimit}&start=${params.start}`

    try {
        const response = await fetch(url)

        if (!response.ok) {
            return NextResponse.json(
                { error: `API error: ${response.statusText}` },
                { status: response.status }
            )
        }

        const data = await response.json()

        // Sort by time ascending and trim to requested limit
        if (data.data && data.data.length > 0) {
            data.data.sort((a: PriceBar, b: PriceBar) => new Date(a.t).getTime() - new Date(b.t).getTime())
            if (data.data.length > requestedLimit) {
                data.data = data.data.slice(-requestedLimit)
            }
            data.rows = data.data.length
        }

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error) {
        console.error('Proxy error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch from external API' },
            { status: 500 }
        )
    }
}
