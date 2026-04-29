import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string
  date: string          // ISO-8601
  country: string       // currency code from ForexFactory (e.g. "USD", "EUR")
  countryCode: string   // 2-letter country code (e.g. "US", "EU")
  event: string
  actual: string | null
  forecast: string | null
  previous: string | null
  unit: string
  importance: 1 | 2 | 3
}

// ---------------------------------------------------------------------------
// In-memory cache — stores raw unfiltered data
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: CalendarEvent[]
  expiresAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
let cache: CacheEntry | null = null

// ---------------------------------------------------------------------------
// Currency → country code map (ForexFactory sends currency codes)
// ---------------------------------------------------------------------------

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  TRY: 'TR',
  GBP: 'GB',
  JPY: 'JP',
  CNY: 'CN',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  CHF: 'CH',
  KRW: 'KR',
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  MXN: 'MX',
  BRL: 'BR',
  INR: 'IN',
  RUB: 'RU',
  ZAR: 'ZA',
  SGD: 'SG',
  HKD: 'HK',
}

const IMPACT_MAP: Record<string, 1 | 2 | 3> = {
  Low: 1,
  Medium: 2,
  High: 3,
}

// ---------------------------------------------------------------------------
// Fetcher — ForexFactory public JSON feed (no auth, real live data)
// Covers current week + next week
// ---------------------------------------------------------------------------

async function fetchLiveCalendar(): Promise<CalendarEvent[]> {
  const endpoints = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
  ]

  const results = await Promise.allSettled(
    endpoints.map((url) =>
      fetch(url, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      }).then((r) => {
        if (!r.ok) throw new Error(`ForexFactory ${r.status} ${url}`)
        return r.json()
      })
    )
  )

  const events: CalendarEvent[] = []

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of result.value as any[]) {
      const currency = String(item.country ?? '').toUpperCase()
      const countryCode = CURRENCY_TO_COUNTRY[currency] ?? currency.slice(0, 2)
      events.push({
        id: `${currency}-${item.date ?? ''}-${item.title ?? ''}`,
        date: item.date ?? '',
        country: currency,
        countryCode,
        event: item.title ?? '',
        actual: item.actual || null,
        forecast: item.forecast || null,
        previous: item.previous || null,
        unit: '',
        importance: IMPACT_MAP[item.impact] ?? 1,
      })
    }
  }

  if (events.length === 0) {
    throw new Error('ForexFactory returned no events')
  }

  return events
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    let raw: CalendarEvent[]
    let fromCache = false

    if (cache && Date.now() < cache.expiresAt) {
      raw = cache.data
      fromCache = true
    } else {
      raw = await fetchLiveCalendar()
      cache = { data: raw, expiresAt: Date.now() + CACHE_TTL_MS }
    }

    const { searchParams } = new URL(request.url)
    const countries = searchParams.get('countries')?.split(',').filter(Boolean) ?? []
    const minImportance = Number(searchParams.get('importance') ?? 1)

    const filtered =
      countries.length > 0
        ? raw.filter((e) => countries.includes(e.countryCode) && e.importance >= minImportance)
        : raw.filter((e) => e.importance >= minImportance)

    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json(
      { events: filtered, source: 'forexfactory', cached: fromCache },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Takvim verisi alınamadı', detail: String(err) },
      { status: 500 }
    )
  }
}
