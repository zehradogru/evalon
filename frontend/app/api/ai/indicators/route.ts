import { NextRequest } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyEvalonJson({
        pathname: '/v1/ai/indicators',
        method: 'POST',
        body,
    })
}
