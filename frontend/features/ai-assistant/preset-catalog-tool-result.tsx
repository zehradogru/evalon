'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Check, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyPresetToBlueprint } from '@/lib/backtest-blueprint'
import { saveActiveBlueprint } from '@/lib/workspace-storage'
import { backtestsService } from '@/services/backtests.service'
import type { BacktestPreset, BacktestPresetCatalogResponse } from '@/types'

const DIRECTION_STYLE: Record<string, string> = {
  long: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  short: 'text-red-400 border-red-400/40 bg-red-400/10',
  both: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
}

interface PresetCatalogToolResultProps {
  result?: BacktestPresetCatalogResponse | null
  onAddToInput?: (text: string) => void
}

export function PresetCatalogToolResult({ result, onAddToInput }: PresetCatalogToolResultProps) {
  const rulesQuery = useQuery({
    queryKey: ['ai-backtest-rule-catalog'],
    queryFn: () => backtestsService.getRuleCatalog(),
    staleTime: 300_000,
  })

  const fallbackQuery = useQuery<BacktestPresetCatalogResponse>({
    queryKey: ['ai-backtest-preset-catalog'],
    queryFn: () => backtestsService.getPresetCatalog(),
    staleTime: 300_000,
    enabled: !result,
  })

  const catalog = result ?? fallbackQuery.data ?? null
  const presets: BacktestPreset[] = catalog?.presets ?? []

  const [expanded, setExpanded] = useState(true)
  const [savedPresetId, setSavedPresetId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const handleCreate = (preset: BacktestPreset) => {
    const rules = rulesQuery.data?.rules ?? []
    const blueprint = applyPresetToBlueprint(preset, rules)
    saveActiveBlueprint(blueprint)
    setSavedPresetId(preset.id)
    setTimeout(() => setSavedPresetId(null), 3000)
  }

  const handleAddToInput = (preset: BacktestPreset) => {
    if (!onAddToInput) return
    onAddToInput(`"${preset.label}" presetini kullanarak bir strateji taslağı oluştur ve backtest kur`)
  }

  return (
    <div className="rounded-lg border border-border/60 bg-black/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-black/40 hover:bg-black/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <Layers size={11} className="text-purple-400" />
          <span className="text-yellow-400 font-semibold">get_preset_catalog</span>
          <span className="opacity-60">{presets.length} preset</span>
        </div>
        {expanded ? <ChevronUp size={11} className="text-muted-foreground" /> : <ChevronDown size={11} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="max-h-80 overflow-y-auto px-2 py-2 space-y-1.5">
          {presets.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 text-center py-4">Preset bulunamadı</p>
          ) : (
            presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSaved={savedPresetId === preset.id}
                isPreviewOpen={previewId === preset.id}
                onTogglePreview={() => setPreviewId((p) => (p === preset.id ? null : preset.id))}
                onCreate={() => handleCreate(preset)}
                onAddToInput={onAddToInput ? () => handleAddToInput(preset) : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PresetCard({
  preset,
  isSaved,
  isPreviewOpen,
  onTogglePreview,
  onCreate,
  onAddToInput,
}: {
  preset: BacktestPreset
  isSaved: boolean
  isPreviewOpen: boolean
  onTogglePreview: () => void
  onCreate: () => void
  onAddToInput?: () => void
}) {
  const dirStyle = DIRECTION_STYLE[preset.direction] ?? DIRECTION_STYLE.both

  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        isSaved ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/30 bg-black/20'
      )}
    >
      {/* Card Top */}
      <div className="flex items-start gap-2.5 px-2.5 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground">{preset.label}</span>
            <span className={cn('inline-flex px-1.5 h-4 items-center rounded text-[9px] font-medium border', dirStyle)}>
              {preset.direction}
            </span>
            <span className="inline-flex px-1.5 h-4 items-center rounded text-[9px] font-medium border border-border/40 bg-black/30 text-muted-foreground">
              {preset.ruleIds.length} kural
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">{preset.summary}</p>
        </div>
      </div>

      {/* Preview (collapsed rule ids) */}
      {isPreviewOpen && (
        <div className="px-2.5 pb-2">
          <div className="rounded border border-border/30 bg-black/30 px-2 py-1.5">
            <p className="text-[9px] text-muted-foreground/60 mb-1 uppercase tracking-wider">Kural ID&apos;leri</p>
            <div className="flex flex-wrap gap-1">
              {preset.ruleIds.map((id) => (
                <span key={id} className="inline-flex px-1.5 h-4 items-center rounded text-[9px] font-mono border border-border/30 bg-black/20 text-muted-foreground">
                  {id}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2">
        <button
          onClick={onTogglePreview}
          className="px-2 h-5 rounded text-[10px] font-medium border border-border/40 bg-black/30 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isPreviewOpen ? 'Gizle' : 'Önizle'}
        </button>
        {onAddToInput && (
          <button
            onClick={onAddToInput}
            className="px-2 h-5 rounded text-[10px] font-medium border border-border/40 bg-black/30 text-muted-foreground hover:text-foreground transition-colors"
          >
            Sohbete ekle
          </button>
        )}
        <button
          onClick={onCreate}
          className={cn(
            'px-2 h-5 rounded text-[10px] font-medium transition-colors flex items-center gap-1',
            isSaved
              ? 'bg-emerald-600/80 text-white'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          )}
        >
          {isSaved && <Check size={9} />}
          {isSaved ? 'Yüklendi!' : 'Strateji oluştur'}
        </button>
      </div>
    </div>
  )
}
