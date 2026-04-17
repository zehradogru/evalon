import { NextRequest, NextResponse } from 'next/server'
import { getRecentFetchParams } from '@/lib/evalon'
import { buildEvalonUrl } from '@/lib/server/evalon-proxy'
import type { PriceBar } from '@/types'

async function readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return response.json()
    }
    return { detail: await response.text() }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const timeframe = searchParams.get('timeframe')
    const requestedLimit = parseInt(searchParams.get('limit') || '100', 10)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!ticker || !timeframe) {
        return NextResponse.json(
            { error: 'Missing required parameters: ticker, timeframe' },
            { status: 400 }
        )
    }

    const params = start
        ? { start, fetchLimit: Math.max(requestedLimit, requestedLimit + 10) }
        : getRecentFetchParams(timeframe, requestedLimit)

    try {
        const response = await fetch(
            buildEvalonUrl('/v1/prices', {
                ticker,
                timeframe,
                limit: params.fetchLimit,
                start: params.start,
                end,
            }),
            {
                cache: 'no-store',
            }
        )

        if (!response.ok) {
            const payload = await readPayload(response)
            return NextResponse.json(payload, { status: response.status })
        }

        const data = (await response.json()) as {
            data?: PriceBar[]
            rows?: number
        }

        if (Array.isArray(data.data) && data.data.length > 0) {
            data.data.sort(
                (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
            )
            if (data.data.length > requestedLimit) {
                data.data = data.data.slice(-requestedLimit)
            }
            data.rows = data.data.length
        }

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        })
    } catch (error) {
        console.error('Prices proxy error:', error)
        return NextResponse.json(
            { detail: 'Failed to fetch from Evalon backend.' },
            { status: 500 }
        )
    }
}
