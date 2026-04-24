import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

/** GET /api/screener/tickers?q=&sector= */
export async function GET(request: NextRequest) {
    return proxyEvalonGet(request, '/v1/screener/tickers', {
        cacheControl: 'public, s-maxage=3600, stale-while-revalidate=7200',
    })
}
