import type { NewsResponse } from '@/types/news'

export interface FetchNewsParams {
  symbol?: string
  sentiment?: string
  q?: string
  limit?: number
  page?: number
}

export async function fetchNews(params: FetchNewsParams = {}): Promise<NewsResponse> {
  const url = new URL('/api/news', window.location.origin)
  if (params.symbol) url.searchParams.set('symbol', params.symbol)
  if (params.sentiment) url.searchParams.set('sentiment', params.sentiment)
  if (params.q) url.searchParams.set('q', params.q)
  if (params.limit != null) url.searchParams.set('limit', String(params.limit))
  if (params.page != null) url.searchParams.set('page', String(params.page))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? `Haberler yüklenemedi (${res.status})`)
  }
  return res.json() as Promise<NewsResponse>
}
