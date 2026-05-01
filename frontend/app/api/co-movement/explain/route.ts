import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

export async function POST(request: NextRequest) {
    const body = await request.json()
    const upstream = await fetchEvalonJson('/v1/co-movement/explain', {
        method: 'POST',
        body,
        timeoutMs: 60_000,
    })

    if (upstream.ok) {
        const payload = await readProxyPayload(upstream)
        return NextResponse.json(payload, { status: upstream.status })
    }

    if (upstream.status === 404) {
        const localFallback = await loadCoMovementFallback()
        if (localFallback) {
            return NextResponse.json(localFallback.getLocalExplanation(body))
        }
    }

    const payload = await readProxyPayload(upstream)
    return NextResponse.json(payload, { status: upstream.status })
}
