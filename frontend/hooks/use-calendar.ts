'use client'

import { useQuery } from '@tanstack/react-query'

export interface CalendarEvent {
  id: string
  date: string
  countryCode: string
  event: string
  actual: string | null
  forecast: string | null
  previous: string | null
  unit: string
  importance: 1 | 2 | 3
  ticker: string
  eventType: string
}

interface BackendCalendarEvent {
  id: string | number
  ticker: string
  event_date: string
  event_type: string
  event_title: string
  importance: number
  source?: string | null
  extra?: string | null
}

async function fetchCalendar(
  countries: string[],
  minImportance: 1 | 2 | 3
): Promise<{ events: CalendarEvent[] }> {
  const res = await fetch(`/api/calendar?limit=500&scope=general`)
  if (!res.ok) throw new Error(`Calendar API ${res.status}`)

  const rawEvents = await res.json() as BackendCalendarEvent[]
  const normalizedCountries = new Set(countries.map((country) => country.toUpperCase()))

  const events: CalendarEvent[] = rawEvents.map(r => {
    let actual = null, forecast = null, previous = null, countryCode = 'TR'
    try {
      if (r.extra) {
        const extra = JSON.parse(r.extra)
        actual = extra.actual || null
        forecast = extra.forecast || null
        previous = extra.previous || null

        const cc = (extra.country || 'TRY').toUpperCase()
        countryCode = cc === 'TRY' ? 'TR' : cc === 'USD' ? 'US' : cc === 'EUR' ? 'EU' : cc.substring(0, 2)
      }
    } catch {}

    const source = String(r.source || '').toLowerCase()
    const isGeneralSource = source === 'forexfactory'
      || source === 'tcmb'
      || source === 'tuik_fallback'
      || source === 'borsa_istanbul'
      || source === 'borsa_istanbul_fallback'
      || source === 'viop_calendar'

    if (!isGeneralSource && r.ticker !== 'MAKRO' && r.ticker !== 'BIST') {
        countryCode = r.ticker
    }

    return {
      id: String(r.id),
      date: r.event_date.replace(' ', 'T'), // Convert to ISO
      countryCode,
      event: r.event_title,
      actual,
      forecast,
      previous,
      unit: '',
      importance: r.importance as 1 | 2 | 3,
      ticker: r.ticker,
      eventType: r.event_type
    }
  })

  const filteredEvents = events.filter((event) => {
    if (event.importance < minImportance) return false
    if (normalizedCountries.size === 0) return true
    return normalizedCountries.has(event.countryCode.toUpperCase())
  })

  const dedupedEvents = Array.from(
    new Map(
      filteredEvents.map((event) => [`${event.date}|${event.event}`, event] as const)
    ).values()
  )

  return { events: dedupedEvents }
}

export function useCalendar(
  countries: string[] = ['TR', 'US'],
  minImportance: 1 | 2 | 3 = 2
) {
  return useQuery({
    queryKey: ['calendar', [...countries].sort().join(','), minImportance],
    queryFn: () => fetchCalendar(countries, minImportance),
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
  })
}
