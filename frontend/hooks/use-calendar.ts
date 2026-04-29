'use client'

import { useQuery } from '@tanstack/react-query'
import type { CalendarEvent } from '@/app/api/calendar/route'

export type { CalendarEvent }

interface CalendarResponse {
  events: CalendarEvent[]
  source?: string
  cached: boolean
}

async function fetchCalendar(
  countries: string[],
  minImportance: number
): Promise<CalendarResponse> {
  const params = new URLSearchParams()
  if (countries.length > 0) params.set('countries', countries.join(','))
  if (minImportance > 1) params.set('importance', String(minImportance))

  const res = await fetch(`/api/calendar?${params.toString()}`)
  if (!res.ok) throw new Error(`Calendar API ${res.status}`)
  return res.json() as Promise<CalendarResponse>
}

export function useCalendar(
  countries: string[] = ['TR', 'US'],
  minImportance: 1 | 2 | 3 = 2
) {
  return useQuery({
    queryKey: ['calendar', countries.sort().join(','), minImportance],
    queryFn: () => fetchCalendar(countries, minImportance),
    staleTime: 1000 * 60 * 15, // 15 min — matches server cache TTL
    refetchInterval: 1000 * 60 * 15,
  })
}
