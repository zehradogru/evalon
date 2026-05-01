import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

export async function GET(request: NextRequest) {
    const upstream = await fetchEvalonJson('/v1/co-movement/snapshots/latest', {
        request,
    })

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
        const localFallback = await loadCoMovementFallback()
        const fallback = localFallback?.getLocalLatestSnapshot()
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
