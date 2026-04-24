'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select-native'
import { FilterRow } from './filter-row'
import type { ScreenerFilter } from '@/types/screener'

const FILTER_TYPE_OPTIONS = [
  { value: 'price', label: 'Price' },
  { value: 'change_pct', label: 'Change %' },
  { value: 'volume', label: 'Volume' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'cross', label: 'Crossover' },
  { value: 'high_low', label: 'High/Low Extreme' },
] as const

function defaultFilter(type: string): ScreenerFilter {
  if (type === 'price') return { type: 'price', op: 'gt', value: 10, label: 'Price' }
  if (type === 'change_pct') return { type: 'change_pct', op: 'gt', value: 2, label: 'Change %' }
  if (type === 'volume') return { type: 'volume', op: 'gt', value: 1_000_000, label: 'Volume' }
  if (type === 'cross') return { type: 'cross', indicator: 'rsi', op: 'above', direction: 'above', target: 30, label: 'Crossover' }
  if (type === 'high_low') return { type: 'high_low', side: 'high', bars: 52, pct_tolerance: 5, label: '52W High' }
  // indicator
  return { type: 'indicator', indicator: 'rsi', op: 'lt', value: 30, label: 'RSI' }
}

interface FilterBuilderProps {
  filters: ScreenerFilter[]
  onChange: (filters: ScreenerFilter[]) => void
}

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
  function addFilter(type: string) {
    onChange([...filters, defaultFilter(type)])
  }

  function updateFilter(index: number, updated: ScreenerFilter) {
    const next = [...filters]
    next[index] = updated
    onChange(next)
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      {filters.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          No filters added yet. Add one below.
        </p>
      ) : (
        <div>
          {filters.map((f, i) => (
            <FilterRow
              key={i}
              index={i}
              filter={f}
              onChange={(updated) => updateFilter(i, updated)}
              onRemove={() => removeFilter(i)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              addFilter(e.target.value)
              e.target.value = ''
            }
          }}
          className="h-8 text-xs flex-1"
        >
          <option value="" disabled>+ Select filter type...</option>
          {FILTER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>
    </div>
  )
}
