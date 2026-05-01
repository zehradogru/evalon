import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

export async function POST(request: NextRequest) {
    const body = await request.json()
    const upstream = await fetchEvalonJson('/v1/co-movement/analyze', {
        method: 'POST',
        body,
        timeoutMs: 120_000,
    })

    if (upstream.ok) {
        const payload = await readProxyPayload(upstream)
        return NextResponse.json(payload, { status: upstream.status })
    }

    if (upstream.status === 404) {
        const localFallback = await loadCoMovementFallback()
        const fallback = localFallback?.getLocalAnalyzeResult(body)
        if (fallback) {
            return NextResponse.json(fallback, {
                headers: {
                    'Cache-Control': 'no-store',
                    'X-Co-Movement-Source': 'snapshot-subset',
                },
            })
        }

        return NextResponse.json(
            {
                detail: 'Co-movement analyze endpoint mevcut backend ortaminda bulunamadi.',
            },
            { status: 503 }
        )
    }

    const payload = await readProxyPayload(upstream)
    return NextResponse.json(payload, { status: upstream.status })
}
