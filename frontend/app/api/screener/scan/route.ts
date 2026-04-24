import { NextRequest } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

/** POST /api/screener/scan */
export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyEvalonJson({
        pathname: '/v1/screener/scan',
        method: 'POST',
        body,
        timeoutMs: 120_000, // scan can take up to 120s for full BIST
    })
}
