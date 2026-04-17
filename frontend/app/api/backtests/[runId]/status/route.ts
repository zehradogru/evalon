import { NextRequest } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ runId: string }> }
) {
    const { runId } = await context.params
    return proxyEvalonGet(request, `/v1/backtests/${runId}/status`)
}
