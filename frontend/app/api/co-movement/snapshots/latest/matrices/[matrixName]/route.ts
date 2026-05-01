import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

interface RouteContext {
    params: Promise<{
        matrixName: string
    }>
}

export async function GET(request: NextRequest, context: RouteContext) {
    const { matrixName } = await context.params

    const upstream = await fetchEvalonJson(
        `/v1/co-movement/snapshots/latest/matrices/${matrixName}`,
        {
            request,
        }
    )

    if (upstream.ok) {
        const payload = await readProxyPayload(upstream)
        return NextResponse.json(payload, {
            status: upstream.status,
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
            },
        })
    }

    if (upstream.status === 404) {
        const symbols = (request.nextUrl.searchParams.get('symbols') ?? '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)
        const localFallback = await loadCoMovementFallback()
        const fallback = localFallback?.getLocalLatestMatrix(matrixName, symbols)
        if (fallback) {
            return NextResponse.json(fallback, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
                },
            })
        }
    }

    const payload = await readProxyPayload(upstream)
    return NextResponse.json(payload, { status: upstream.status })
}
