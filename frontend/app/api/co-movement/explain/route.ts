import { NextRequest, NextResponse } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'

function isCompleteSummary(summary: unknown): summary is string {
    if (typeof summary !== 'string') return false

    const trimmed = summary.trim()
    if (!trimmed) return false
    if ((trimmed.match(/\*\*/g) ?? []).length % 2 !== 0) return false

    return /[.!?…]$/.test(trimmed)
}

export async function POST(request: NextRequest) {
    const body = await request.json()

    try {
        const upstream = await fetchEvalonJson('/v1/co-movement/explain', {
            method: 'POST',
            body,
            timeoutMs: 60_000,
        })

        if (upstream.ok) {
            const payload = await readProxyPayload(upstream)
            if (
                payload &&
                typeof payload === 'object' &&
                'summary' in payload &&
                !isCompleteSummary(payload.summary)
            ) {
                const localFallback = await loadCoMovementFallback()
                if (localFallback) {
                    return NextResponse.json(localFallback.getLocalExplanation(body))
                }
            }

            return NextResponse.json(payload, { status: upstream.status })
        }
    } catch {
        // Backend unreachable or timed out — fall through to local fallback.
    }

    const localFallback = await loadCoMovementFallback()
    if (localFallback) {
        return NextResponse.json(localFallback.getLocalExplanation(body))
    }

    return NextResponse.json(
        { detail: 'Yorum servisi şu anda kullanılamıyor.' },
        { status: 503 }
    )
}
