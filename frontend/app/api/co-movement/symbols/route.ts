import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

export async function GET(request: NextRequest) {
    const upstream = await fetchEvalonJson('/v1/co-movement/symbols', {
        request,
    })

    if (upstream.ok) {
        const payload = await readProxyPayload(upstream)
        return NextResponse.json(payload, {
            status: upstream.status,
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
            },
        })
    }

    if (upstream.status === 404) {
        const search = request.nextUrl.searchParams.get('search') ?? ''
        const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100')
        const localFallback = await loadCoMovementFallback()
        const fallback = localFallback?.getLocalSymbols(
            search,
            Number.isFinite(limit) ? limit : 100
        )
        if (fallback) {
            return NextResponse.json(fallback, {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
                },
            })
        }
    }

    const payload = await readProxyPayload(upstream)
    return NextResponse.json(payload, { status: upstream.status })
}
