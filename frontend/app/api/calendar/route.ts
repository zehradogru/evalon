import { NextRequest, NextResponse } from 'next/server'
import { proxyEvalonGet } from '@/lib/server/evalon-proxy'

export async function GET(request: NextRequest) {
    try {
        // Parametreleri al
        const { searchParams } = new URL(request.url)
        const limit = searchParams.get('limit') || '500'
        
        // Backend'e yönlendir (FastAPI: /v1/calendar)
        return proxyEvalonGet(request, '/v1/calendar', {
            searchParams: { limit }
        })
    } catch (err) {
        return NextResponse.json(
            { error: 'Takvim verisi alınamadı', detail: String(err) },
            { status: 500 }
        )
    }
}
