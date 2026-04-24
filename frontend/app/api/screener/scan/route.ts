import { NextRequest, NextResponse } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

const SCREENER_API_URL =
    process.env.EVALON_SCREENER_API_URL ||
    process.env.NEXT_PUBLIC_EVALON_API_URL

/** POST /api/screener/scan */
export async function POST(request: NextRequest) {
    if (!SCREENER_API_URL) {
        return NextResponse.json({ detail: 'Screener API URL not configured' }, { status: 503 })
    }
    const body = await request.json()
    return proxyEvalonJson({
        pathname: '/v1/screener/scan',
        method: 'POST',
        body,
        timeoutMs: 120_000,
        baseUrl: SCREENER_API_URL,
    })
}
