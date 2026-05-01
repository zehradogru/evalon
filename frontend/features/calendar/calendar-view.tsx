'use client'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCalendar, type CalendarEvent } from '@/hooks/use-calendar'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_COUNTRIES = ['TR', 'US', 'EU']

const DAY_SHORT: Record<number, string> = {
  0: 'Paz', 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatWeekRange(days: Date[]): string {
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return `${fmt(days[0])} — ${fmt(days[6])}`
}

function formatTime(isoDate: string): string {
  if (!isoDate) return 'Tüm gün'
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatDayHeader(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (isSameDay(date, today)) return 'Bugün'
  if (isSameDay(date, tomorrow)) return 'Yarın'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => isSameDay(new Date(e.date), day))
}

function groupByDay(events: CalendarEvent[]): { date: Date; events: CalendarEvent[] }[] {
  const map = new Map<string, { date: Date; events: CalendarEvent[] }>()
  for (const ev of events) {
    const d = new Date(ev.date)
    const key = d.toISOString().slice(0, 10)
    if (!map.has(key)) map.set(key, { date: d, events: [] })
    map.get(key)!.events.push(ev)
  }
  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImportanceBars({ level }: { level: 1 | 2 | 3 }) {
  const cls =
    level === 3 ? 'cal-imp-bars cal-imp-high'
    : level === 2 ? 'cal-imp-bars cal-imp-med'
    : 'cal-imp-bars cal-imp-low'
  return (
    <span className={cls}>
      <span className="cal-imp-bar b1" />
      <span className="cal-imp-bar b2" />
      <span className="cal-imp-bar b3" />
    </span>
  )
}

function StatCell({ label, value, unit, variant }: {
  label: string
  value: string | null | undefined
  unit?: string
  variant?: 'beat' | 'miss' | 'match'
}) {
  const valClass =
    variant === 'beat' ? 'cal-stat-value actual-beat'
    : variant === 'miss' ? 'cal-stat-value actual-miss'
    : variant === 'match' ? 'cal-stat-value actual-match'
    : 'cal-stat-value'
  return (
    <div className="cal-stat">
      <span className="cal-stat-label">{label}</span>
      <span className={valClass}>{value ? `${value}${unit ?? ''}` : '—'}</span>
    </div>
  )
}

function DayPreview({ events }: { events: CalendarEvent[] }) {
  const rows = events.slice(0, 5).map((e, i) => {
    const cls =
      e.importance === 3 ? 'cal-day-bar high'
      : e.importance === 2 ? 'cal-day-bar medium'
      : 'cal-day-bar low'
    return <div key={i} className={cls} />
  })
  for (let i = rows.length; i < 4; i++) {
    rows.push(<div key={`e-${i}`} className="cal-day-bar" />)
  }
  return <div className="cal-day-preview">{rows}</div>
}

// ---------------------------------------------------------------------------
// Hooks & EventRow
// ---------------------------------------------------------------------------

function useCountdown(targetIso: string): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function update() {
      const diff = new Date(targetIso).getTime() - Date.now()
      if (diff <= 0) { setLabel('şimdi'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (h > 0) setLabel(`${h}s ${m}d`)
      else if (m > 0) setLabel(`${m}d ${s}s`)
      else setLabel(`${s}s`)
    }
    update()
    const id = setInterval(update, 1_000)
    return () => clearInterval(id)
  }, [targetIso])
  return label
}

function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(0)

  useEffect(() => {
    function update() {
      setNow(Date.now())
    }

    update()
    const id = setInterval(update, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

function EventRow({ event, isNext }: { event: CalendarEvent; isNext: boolean }) {
  const now = useNow()
  const isPast = now > 0 && new Date(event.date).getTime() < now
  const countdown = useCountdown(event.date)

  const timeClass = isPast
    ? 'cal-time past'
    : event.importance === 3
      ? 'cal-time high'
      : event.importance === 2
        ? 'cal-time medium'
        : 'cal-time low'

  let actualVariant: 'beat' | 'miss' | 'match' | undefined
  if (event.actual && event.forecast) {
    const a = parseFloat(event.actual)
    const f = parseFloat(event.forecast)
    if (!Number.isNaN(a) && !Number.isNaN(f)) {
      actualVariant = a > f ? 'beat' : a < f ? 'miss' : 'match'
    }
  }

  return (
    <div className={cn('cal-event-row flex items-center gap-2.5', isNext && 'is-next')}>
      <div className="flex flex-col items-end gap-0.5 shrink-0 w-10">
        <span className={timeClass}>{formatTime(event.date)}</span>
        {isNext && !isPast && <span className="cal-countdown">{countdown}</span>}
      </div>
      <span className="cal-flag shrink-0 text-[11px] font-semibold text-muted-foreground w-7 text-center">{event.countryCode}</span>
      <ImportanceBars level={event.importance} />
      <span className={cn('cal-event-name flex-1 min-w-0 text-[13px] truncate', isPast && 'past')}>{event.event}</span>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <StatCell label="Önceki" value={event.previous} unit={event.unit} />
        <StatCell label="Tahmin" value={event.forecast} unit={event.unit} />
        <StatCell label="Gerçek" value={event.actual} unit={event.unit} variant={actualVariant} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView({ isWidget = false }: { isWidget?: boolean } = {}) {
  const today = useMemo(() => new Date(), [])
  const now = useNow(30_000)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<Date>(today)
  const [minImportance, setMinImportance] = useState<1 | 2 | 3>(2)
  const dayStripRef = useRef<HTMLDivElement>(null)
  const eventListRef = useRef<HTMLDivElement>(null)

  const weekBase = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() + weekOffset * 7)
    return d
  }, [today, weekOffset])

  const weekDays = useMemo(() => getWeekDays(weekBase), [weekBase])

  const { data, isLoading, isFetching, refetch } = useCalendar(FIXED_COUNTRIES, minImportance)
  const allEvents = useMemo(() => data?.events ?? [], [data?.events])

  const grouped = useMemo(() => groupByDay(allEvents), [allEvents])

  // Filter events to the currently viewed week
  const weekGrouped = useMemo(() => {
    const start = weekDays[0]
    const end = new Date(weekDays[6])
    end.setHours(23, 59, 59, 999)
    return grouped.filter(({ date }) => date >= start && date <= end)
  }, [grouped, weekDays])

  // ForexFactory only covers current week + next week (weekOffset 0 or 1)
  const isOutOfRange = weekOffset < -1 || weekOffset > 1

  const nextEvent = useMemo(() => {
    if (now === 0) return null
    return allEvents.find((e) => new Date(e.date).getTime() > now) ?? null
  }, [allEvents, now])

  const scrollDayIntoView = useCallback((index: number) => {
    const strip = dayStripRef.current
    if (!strip) return
    const pill = strip.children[index] as HTMLElement
    if (!pill) return
    if (pill.offsetLeft < strip.scrollLeft)
      strip.scrollLeft = pill.offsetLeft - 8
    else if (pill.offsetLeft + pill.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = pill.offsetLeft + pill.offsetWidth - strip.clientWidth + 8
  }, [])

  function prevWeek() {
    const nb = new Date(weekBase); nb.setDate(weekBase.getDate() - 7)
    setWeekOffset((o) => o - 1)
    setSelectedDay(getWeekDays(nb)[0])
  }
  function nextWeek() {
    const nb = new Date(weekBase); nb.setDate(weekBase.getDate() + 7)
    setWeekOffset((o) => o + 1)
    setSelectedDay(getWeekDays(nb)[0])
  }
  function goToday() { setWeekOffset(0); setSelectedDay(today) }

  return (
    <div className={cn('flex flex-col min-h-0 h-full bg-background', isWidget && 'border-0')}>

      {/* ── Top navigation bar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground mr-1">Takvim</span>
        <button
          onClick={goToday}
          className={cn(
            'text-xs px-2.5 py-1 rounded-md border transition-colors',
            weekOffset === 0
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          Bugün
        </button>
        <button
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          onClick={prevWeek}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          onClick={nextWeek}
        >
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-medium text-foreground select-none">
          {formatWeekRange(weekDays)}
        </span>
        <div className="ml-auto">
          <button
            onClick={() => { void refetch() }}
            disabled={isFetching}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Day strip ── */}
      <div className="py-2 border-b border-border flex items-center gap-1 px-1">
        <button
          onClick={() => { if (dayStripRef.current) dayStripRef.current.scrollLeft -= 120 }}
          className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div ref={dayStripRef} className="cal-day-strip flex-1">
          {weekDays.map((day, i) => {
            const dayEvs = eventsForDay(allEvents, day)
            const isActive = isSameDay(day, selectedDay)
            const isToday = isSameDay(day, today)
            const dayOfWeek = day.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            return (
              <button
                key={i}
                disabled={isWeekend}
                onClick={() => { if (!isWeekend) { setSelectedDay(day); scrollDayIntoView(i) } }}
                className={cn('cal-day-pill', isActive && 'active', isWeekend && 'opacity-30 cursor-not-allowed')}
              >
                <span className={cn(
                  'cal-day-pill-label',
                  isToday && !isActive && '!text-primary'
                )}>
                  {DAY_SHORT[day.getDay()]} {day.getDate()}
                </span>
                <DayPreview events={dayEvs} />
              </button>
            )
          })}
        </div>
        <button
          onClick={() => { if (dayStripRef.current) dayStripRef.current.scrollLeft += 120 }}
          className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Importance filter ── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0">
        {([1, 2, 3] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setMinImportance(lvl)}
            title={lvl === 1 ? 'Tümü' : lvl === 2 ? 'Orta+' : 'Yüksek'}
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded transition-colors',
              minImportance === lvl ? 'bg-accent' : 'hover:bg-accent/50'
            )}
          >
            <span className={cn(
              'cal-imp-bars',
              lvl === 3 ? 'cal-imp-high' : lvl === 2 ? 'cal-imp-med' : 'cal-imp-low'
            )}>
              <span className="cal-imp-bar b1" />
              <span className="cal-imp-bar b2" />
              <span className="cal-imp-bar b3" />
            </span>
          </button>
        ))}
      </div>

      {/* ── Event list ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-accent/30 animate-pulse" />
            ))}
          </div>
        ) : isOutOfRange ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Calendar size={32} className="opacity-20" />
            <p className="text-sm">Bu hafta için veri yok</p>
            <p className="text-xs opacity-60 text-center px-6">Veri kaynağı yalnızca bu hafta ve gelecek haftayı kapsar</p>
          </div>
        ) : weekGrouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Calendar size={32} className="opacity-20" />
            <p className="text-sm">Bu hafta etkinlik bulunamadı</p>
          </div>
        ) : (
          weekGrouped.map(({ date, events }) => (
            <div key={date.toISOString().slice(0, 10)}>
              <div className="cal-day-header">{formatDayHeader(date)}</div>
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} isNext={nextEvent?.id === ev.id} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
