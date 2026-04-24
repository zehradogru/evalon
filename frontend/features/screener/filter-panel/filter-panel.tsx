'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { QuickFilterChips } from './quick-filter-chips'
import { FilterBuilder } from './filter-builder'
import type { FilterLogic, ScreenerFilter, ScreenerTimeframe } from '@/types/screener'

interface FilterPanelProps {
  filters: ScreenerFilter[]
  logic: FilterLogic
  activeChipId?: string
  onFiltersChange: (filters: ScreenerFilter[]) => void
  onLogicChange: (logic: FilterLogic) => void
  onQuickApply: (
    filters: ScreenerFilter[],
    timeframe?: ScreenerTimeframe,
    logic?: FilterLogic
  ) => void
}

export function FilterPanel({
  filters,
  logic,
  activeChipId,
  onFiltersChange,
  onLogicChange,
  onQuickApply,
}: FilterPanelProps) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <Tabs defaultValue="quick" className="w-full">
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="quick" className="text-xs h-7">Quick</TabsTrigger>
            <TabsTrigger value="builder" className="text-xs h-7">Custom</TabsTrigger>
          </TabsList>

          {/* AND / OR toggle */}
          {filters.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Logic:</span>
              <button
                type="button"
                onClick={() => onLogicChange('AND')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  logic === 'AND'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => onLogicChange('OR')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  logic === 'OR'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                OR
              </button>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-3">
          <TabsContent value="quick" className="mt-0">
            <QuickFilterChips
              activeChipId={activeChipId}
              onApply={(chips, tf, lg) => onQuickApply(chips, tf, lg)}
            />
          </TabsContent>

          <TabsContent value="builder" className="mt-0">
            <FilterBuilder filters={filters} onChange={onFiltersChange} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
