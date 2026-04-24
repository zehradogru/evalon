'use client'

import { useId } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Label } from '@/components/ui/label'
import { NUMERIC_OPS, SCREENER_TIMEFRAMES } from '@/types/screener'
import type {
  ScreenerFilter,
  NumericOp,
  PriceFilter,
  VolumeFilter,
  ChangePctFilter,
  IndicatorFilter,
} from '@/types/screener'
import { INDICATOR_CATALOG } from '@/data/screener-indicator-catalog'

interface FilterRowProps {
  index: number
  filter: ScreenerFilter
  onChange: (filter: ScreenerFilter) => void
  onRemove: () => void
}

// Helper to render a numeric op + value (+ optional value2 for 'between')
function NumericInputs({
  op,
  value,
  value2,
  onOpChange,
  onValueChange,
  onValue2Change,
}: {
  op: NumericOp
  value: number
  value2?: number
  onOpChange: (op: NumericOp) => void
  onValueChange: (v: number) => void
  onValue2Change: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Select
        value={op}
        onChange={(e) => onOpChange(e.target.value as NumericOp)}
        className="w-24 h-8 text-xs"
      >
        {NUMERIC_OPS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <Input
        type="number"
        value={value}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
        className="w-24 h-8 text-xs"
      />
      {op === 'between' && (
        <>
          <span className="text-xs text-muted-foreground">and</span>
          <Input
            type="number"
            value={value2 ?? 0}
            onChange={(e) => onValue2Change(parseFloat(e.target.value) || 0)}
            className="w-24 h-8 text-xs"
          />
        </>
      )}
    </div>
  )
}

export function FilterRow({ index, filter, onChange, onRemove }: FilterRowProps) {
  const id = useId()

  function renderFields() {
    if (filter.type === 'price') {
      const f = filter as PriceFilter
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-20">Price (TL)</span>
          <NumericInputs
            op={f.op}
            value={f.value}
            value2={f.value2}
            onOpChange={(op) => onChange({ ...f, op })}
            onValueChange={(value) => onChange({ ...f, value })}
            onValue2Change={(value2) => onChange({ ...f, value2 })}
          />
        </div>
      )
    }

    if (filter.type === 'change_pct') {
      const f = filter as ChangePctFilter
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-20">Change %</span>
          <NumericInputs
            op={f.op}
            value={f.value}
            value2={f.value2}
            onOpChange={(op) => onChange({ ...f, op })}
            onValueChange={(value) => onChange({ ...f, value })}
            onValue2Change={(value2) => onChange({ ...f, value2 })}
          />
        </div>
      )
    }

    if (filter.type === 'volume') {
      const f = filter as VolumeFilter
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-20">Volume</span>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={!!f.relative}
              onChange={(e) => onChange({ ...f, relative: e.target.checked })}
              className="rounded"
            />
            ×Avg
          </label>
          <NumericInputs
            op={f.op}
            value={f.value}
            value2={f.value2}
            onOpChange={(op) => onChange({ ...f, op })}
            onValueChange={(value) => onChange({ ...f, value })}
            onValue2Change={(value2) => onChange({ ...f, value2 })}
          />
        </div>
      )
    }

    if (filter.type === 'indicator') {
      const f = filter as IndicatorFilter
      const period = (f.params?.period as number) ?? 14
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={f.indicator}
            onChange={(e) => onChange({ ...f, indicator: e.target.value, params: { period } })}
            className="w-28 h-8 text-xs"
          >
            {INDICATOR_CATALOG.map((ind) => (
              <option key={ind.id} value={ind.id}>{ind.label}</option>
            ))}
          </Select>
          <Input
            type="number"
            value={period}
            min={1}
            max={500}
            onChange={(e) =>
              onChange({ ...f, params: { ...f.params, period: parseInt(e.target.value) || 14 } })
            }
            className="w-16 h-8 text-xs"
            title="Period"
          />
          <NumericInputs
            op={f.op}
            value={f.value}
            value2={f.value2}
            onOpChange={(op) => onChange({ ...f, op })}
            onValueChange={(value) => onChange({ ...f, value })}
            onValue2Change={(value2) => onChange({ ...f, value2 })}
          />
        </div>
      )
    }

    if (filter.type === 'cross') {
      const f = filter
      const period = (f.params?.period as number) ?? 14
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={f.indicator}
            onChange={(e) => onChange({ ...f, indicator: e.target.value })}
            className="w-28 h-8 text-xs"
          >
            {INDICATOR_CATALOG.map((ind) => (
              <option key={ind.id} value={ind.id}>{ind.label}</option>
            ))}
          </Select>
          <Input
            type="number"
            value={period}
            min={1}
            onChange={(e) =>
              onChange({ ...f, params: { ...f.params, period: parseInt(e.target.value) || 14 } })
            }
            className="w-16 h-8 text-xs"
            title="Period"
          />
          <Select
            value={f.direction}
            onChange={(e) => onChange({ ...f, direction: e.target.value as 'above' | 'below' })}
            className="w-24 h-8 text-xs"
          >
            <option value="above">Cross Above</option>
            <option value="below">Cross Below</option>
          </Select>
          <Input
            type="number"
            value={typeof f.target === 'number' ? f.target : 0}
            onChange={(e) => onChange({ ...f, target: parseFloat(e.target.value) || 0 })}
            className="w-24 h-8 text-xs"
            title="Target value"
          />
        </div>
      )
    }

    if (filter.type === 'high_low') {
      const f = filter
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={f.side}
            onChange={(e) => onChange({ ...f, side: e.target.value as 'high' | 'low' })}
            className="w-24 h-8 text-xs"
          >
            <option value="high">High</option>
            <option value="low">Low</option>
          </Select>
          <Input
            type="number"
            value={f.bars}
            min={2}
            max={500}
            onChange={(e) => onChange({ ...f, bars: parseInt(e.target.value) || 20 })}
            className="w-16 h-8 text-xs"
            title="Bar sayısı"
          />
          <span className="text-xs text-muted-foreground">bars within</span>
          <Input
            type="number"
            value={f.pct_tolerance}
            min={0}
            max={99}
            step={0.5}
            onChange={(e) => onChange({ ...f, pct_tolerance: parseFloat(e.target.value) || 0 })}
            className="w-16 h-8 text-xs"
            title="Tolerans %"
          />
          <span className="text-xs text-muted-foreground">% within</span>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{index + 1}.</span>
      <div className="flex-1">{renderFields()}</div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        title="Filtreyi kaldır"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}
