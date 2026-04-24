import { NextRequest, NextResponse } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

const SCREENER_API_URL =
    process.env.EVALON_SCREENER_API_URL ||
    process.env.NEXT_PUBLIC_EVALON_API_URL

/** GET /api/screener/tickers?q=&sector= */
export async function GET(request: NextRequest) {
    if (!SCREENER_API_URL) {
        return NextResponse.json({ detail: 'Screener API URL not configured' }, { status: 503 })
    }
    return proxyEvalonGet(request, '/v1/screener/tickers', {
        cacheControl: 'public, s-maxage=3600, stale-while-revalidate=7200',
        baseUrl: SCREENER_API_URL,
    })
}
