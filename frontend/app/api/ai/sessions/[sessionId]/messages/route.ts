import { NextRequest } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await context.params
    const body = await request.json()
    return proxyEvalonJson({
        pathname: `/v1/ai/sessions/${sessionId}/messages`,
        method: 'POST',
        body,
    })
}
