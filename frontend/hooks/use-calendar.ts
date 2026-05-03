'use client'

import { useQuery } from '@tanstack/react-query'
import type { CalendarEvent } from '@/app/api/calendar/route'

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

async function fetchCalendar(
  countries: string[],
  minImportance: number
): Promise<{ events: CalendarEvent[] }> {
  const res = await fetch(`/api/calendar?limit=500`)
  if (!res.ok) throw new Error(`Calendar API ${res.status}`)
  
  // The API returns a list of backend items directly
  const rawEvents = await res.json() as any[]
  
  const events: CalendarEvent[] = rawEvents.map(r => {
    let actual = null, forecast = null, previous = null, countryCode = 'TR'
    try {
        if (r.extra) {
            const extra = JSON.parse(r.extra)
            actual = extra.actual || null
            forecast = extra.forecast || null
            previous = extra.previous || null
            
            // Map TRY to TR, USD to US, etc for flags
            const cc = (extra.country || 'TRY').toUpperCase()
            countryCode = cc === 'TRY' ? 'TR' : cc === 'USD' ? 'US' : cc === 'EUR' ? 'EU' : cc.substring(0, 2)
        }
    } catch(e) {}
    
    // For specific tickers like ASELS, show the ticker as the flag
    if (r.ticker !== 'MAKRO' && r.ticker !== 'BIST') {
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
  
  return { events }
}

export function useCalendar(
  countries: string[] = ['TR', 'US'],
  minImportance: 1 | 2 | 3 = 2
) {
  return useQuery({
    queryKey: ['calendar', countries.sort().join(','), minImportance],
    queryFn: () => fetchCalendar(countries, minImportance),
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
  })
}
