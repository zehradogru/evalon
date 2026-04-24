/**
 * Screener API service — calls the Next.js proxy routes,
 * which in turn forward requests to the FastAPI backend.
 */

import type {
  ScanRequest,
  ScanResponse,
  TickerListResponse,
} from '@/types/screener'

const BASE = '/api/screener'

/** GET /api/screener/tickers?q=&sector= */
export async function fetchTickerList(params?: {
  q?: string
  sector?: string
}): Promise<TickerListResponse> {
  const url = new URL(BASE + '/tickers', window.location.origin)
  if (params?.q) url.searchParams.set('q', params.q)
  if (params?.sector) url.searchParams.set('sector', params.sector)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? `Failed to load ticker list (${res.status})`)
  }
  return res.json() as Promise<TickerListResponse>
}

/** POST /api/screener/scan */
export async function runScan(body: ScanRequest): Promise<ScanResponse> {
  const res = await fetch(BASE + '/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? `Scan failed (${res.status})`)
  }
  return res.json() as Promise<ScanResponse>
}
