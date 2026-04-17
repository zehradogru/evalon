import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(request: NextRequest) {
    return proxyEvalonGet(request, '/v1/ai/tools', {
        cacheControl: 'public, s-maxage=300, stale-while-revalidate=1800',
    })
}
