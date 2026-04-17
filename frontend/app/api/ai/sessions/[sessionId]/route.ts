import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await context.params
    return proxyEvalonGet(request, `/v1/ai/sessions/${sessionId}`)
}
