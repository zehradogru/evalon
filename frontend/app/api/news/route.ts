import { NextRequest } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

/** GET /api/news?symbol=GARAN&sentiment=OLUMLU&q=...&limit=20&page=1 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    return proxyEvalonJson({
        pathname: '/v1/news',
        searchParams,
        timeoutMs: 15_000,
    })
}
