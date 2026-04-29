'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { QUICK_FILTER_CHIPS } from '@/data/screener-quick-filters'
import type { QuickFilterChip, ScreenerFilter, ScreenerTimeframe, FilterLogic } from '@/types/screener'

interface QuickFilterChipsProps {
  onApply: (chipId: string, filters: ScreenerFilter[], timeframe?: ScreenerTimeframe, logic?: FilterLogic) => void
  activeChipId?: string
}

export function QuickFilterChips({ onApply, activeChipId }: QuickFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_FILTER_CHIPS.map((chip) => {
        const isActive = activeChipId === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            title={chip.description}
            onClick={() => onApply(chip.id, chip.filters, chip.timeframe, chip.logic)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer',
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground hover:bg-primary/5',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
