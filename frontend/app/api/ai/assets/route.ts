import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(request: NextRequest) {
    return proxyEvalonGet(request, '/v1/ai/assets')
}
