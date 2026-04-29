import { NextRequest } from 'next/server'
import { proxyEvalonJson } from '@/lib/server/evalon-proxy'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ assetId: string }> }
) {
    const { assetId } = await params
    const userId = request.nextUrl.searchParams.get('userId') ?? 'demo'
    return proxyEvalonJson({
        pathname: `/v1/ai/assets/${encodeURIComponent(assetId)}?userId=${encodeURIComponent(userId)}`,
        method: 'DELETE',
    })
}
