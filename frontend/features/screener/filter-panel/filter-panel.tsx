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
    chipId: string,
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
    <div className="flex flex-col gap-3">
      <Tabs defaultValue="quick" className="w-full">
        <div className="flex items-center justify-between mb-3">
          <TabsList className="h-8">
            <TabsTrigger value="quick" className="text-xs h-7 px-4">Quick</TabsTrigger>
            <TabsTrigger value="builder" className="text-xs h-7 px-4">Custom</TabsTrigger>
          </TabsList>

          {filters.length > 1 && (
            <div className="flex items-center gap-1">
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

        <TabsContent value="quick" className="mt-0">
          <QuickFilterChips
            activeChipId={activeChipId}
            onApply={(id, chips, tf, lg) => onQuickApply(id, chips, tf, lg)}
          />
        </TabsContent>

        <TabsContent value="builder" className="mt-0">
          <FilterBuilder filters={filters} onChange={onFiltersChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
