import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(request: NextRequest) {
    return proxyEvalonGet(request, '/health', {
        cacheControl: 'public, s-maxage=30, stale-while-revalidate=120',
    })
}
