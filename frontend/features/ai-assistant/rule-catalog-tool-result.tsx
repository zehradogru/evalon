'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Check, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addRulesToActiveBlueprint,
  createEmptyBlueprint,
  removeRulesFromActiveBlueprint,
} from '@/lib/backtest-blueprint'
import { readActiveBlueprint, saveActiveBlueprint } from '@/lib/workspace-storage'
import { backtestsService } from '@/services/backtests.service'
import type { BacktestBlueprint, BacktestCatalogRule, BacktestRuleCatalogResponse } from '@/types'

function collectBlueprintRuleIds(blueprint: BacktestBlueprint | null): Set<string> {
  const ids = new Set<string>()
  if (!blueprint?.stages) return ids
  Object.values(blueprint.stages).forEach((stage) => {
    stage?.rules?.forEach((r) => {
      if (r?.id) ids.add(r.id)
    })
  })
  return ids
}

const CATEGORY_COLORS: Record<string, string> = {
  'price-action': 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  indicator: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  volume: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  pattern: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
  fibonacci: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
}

interface RuleCatalogToolResultProps {
  result?: BacktestRuleCatalogResponse | null
  onAddToInput?: (text: string) => void
}

export function RuleCatalogToolResult({ result, onAddToInput }: RuleCatalogToolResultProps) {
  const fallbackQuery = useQuery<BacktestRuleCatalogResponse>({
    queryKey: ['ai-backtest-rule-catalog'],
    queryFn: () => backtestsService.getRuleCatalog(),
    staleTime: 300_000,
    enabled: !result,
  })

  const catalog = result ?? fallbackQuery.data ?? null
  const rules: BacktestCatalogRule[] = catalog?.rules ?? []
  const families = catalog?.families ?? []

  const [search, setSearch] = useState('')
  const [activeFamily, setActiveFamily] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Hydrated from localStorage so rules the AI added earlier in this
  // chat session show up as ticked. New chat clears localStorage first
  // (via clearActiveBlueprint), so stale cross-session rules never appear.
  const [alreadyAdded, setAlreadyAdded] = useState<Set<string>>(() =>
    collectBlueprintRuleIds(readActiveBlueprint())
  )
  const [expanded, setExpanded] = useState(true)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rules.filter((r) => {
      const matchesFamily = activeFamily === 'all' || r.family === activeFamily
      const matchesSearch =
        !q || r.label.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.id.includes(q)
      return matchesFamily && matchesSearch
    })
  }, [rules, search, activeFamily])

  const toggleRule = (id: string) => {
    if (alreadyAdded.has(id)) {
      // Removing an already-pushed rule: strip it from the blueprint immediately.
      const existing = readActiveBlueprint()
      if (existing) {
        const updated = removeRulesFromActiveBlueprint([id], existing)
        saveActiveBlueprint(updated)
      }
      setAlreadyAdded((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddToBlueprint = () => {
    if (selected.size === 0) return
    const selectedRules = rules.filter((r) => selected.has(r.id))
    const existing = readActiveBlueprint() ?? createEmptyBlueprint()
    const updated = addRulesToActiveBlueprint(Array.from(selected), rules, existing)
    saveActiveBlueprint(updated)
    setSavedMsg(`${selected.size} kural aktif blueprint'e eklendi`)
    setTimeout(() => setSavedMsg(null), 3000)
    // Promote freshly added ids into the "alreadyAdded" set so the UI
    // immediately reflects the persisted state with the emerald tick.
    setAlreadyAdded((prev) => {
      const next = new Set(prev)
      selected.forEach((id) => next.add(id))
      return next
    })
    setSelected(new Set())
    // Auto-send a message so the AI knows which rules were selected
    if (onAddToInput) {
      const ruleNames = selectedRules.map((r) => r.label).join(', ')
      onAddToInput(`Şu kuralları seçtim ve blueprint'ime ekledim: ${ruleNames}. Bu kuralları kullanarak bir strateji oluşturabilir misin?`)
    }
  }

  const handleAddToInput = () => {
    if (!onAddToInput || selected.size === 0) return
    const ids = Array.from(selected).join(', ')
    onAddToInput(`Bu kurallarla bir strateji kur: ${ids}`)
    setSelected(new Set())
  }

  return (
    <div className="rounded-lg border border-border/60 bg-black/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-black/40 hover:bg-black/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <BookOpen size={11} className="text-blue-400" />
          <span className="text-yellow-400 font-semibold">get_rule_catalog</span>
          <span className="opacity-60">{rules.length} kural</span>
          {alreadyAdded.size > 0 && (
            <span className="px-1.5 h-4 inline-flex items-center rounded text-[9px] font-medium border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
              {alreadyAdded.size} ekli
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={11} className="text-muted-foreground" /> : <ChevronDown size={11} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <>
          {/* Search + Family Filter */}
          <div className="px-3 py-2 space-y-2 border-b border-border/40 bg-black/20">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kural ara…"
                className="w-full pl-7 pr-3 h-7 text-[11px] rounded-md border border-border/40 bg-black/40 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <FamilyChip label="Tümü" value="all" active={activeFamily === 'all'} onClick={() => setActiveFamily('all')} />
              {families.map((f) => (
                <FamilyChip key={f.id} label={f.label} value={f.id} active={activeFamily === f.id} onClick={() => setActiveFamily(f.id)} />
              ))}
            </div>
          </div>

          {/* Rule Cards */}
          <div className="max-h-72 overflow-y-auto px-2 py-2 space-y-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 text-center py-4">Kural bulunamadı</p>
            ) : (
              filtered.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  checked={selected.has(rule.id)}
                  alreadyAdded={alreadyAdded.has(rule.id)}
                  onToggle={() => toggleRule(rule.id)}
                />
              ))
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-black/40 gap-2">
            <span className="text-[10px] text-muted-foreground">
              {selected.size > 0 ? `${selected.size} seçili` : 'Kuralları seç'}
            </span>
            <div className="flex gap-1.5">
              {onAddToInput && selected.size > 0 && (
                <button
                  onClick={handleAddToInput}
                  className="px-2.5 h-6 rounded text-[10px] font-medium border border-border/50 bg-black/30 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sohbete ekle
                </button>
              )}
              <button
                onClick={handleAddToBlueprint}
                disabled={selected.size === 0}
                className={cn(
                  'px-2.5 h-6 rounded text-[10px] font-medium transition-colors',
                  selected.size > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-secondary/40 text-muted-foreground/50 cursor-not-allowed'
                )}
              >
                Taslağa ekle ({selected.size})
              </button>
            </div>
          </div>

          {/* Success message */}
          {savedMsg && (
            <div className="px-3 py-1.5 bg-emerald-500/10 border-t border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1.5">
              <Check size={11} />
              {savedMsg}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FamilyChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 h-5 rounded text-[10px] font-medium border transition-colors',
        active
          ? 'bg-primary/20 border-primary/50 text-primary'
          : 'bg-black/30 border-border/40 text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

function RuleCard({
  rule,
  checked,
  alreadyAdded,
  onToggle,
}: {
  rule: BacktestCatalogRule
  checked: boolean
  alreadyAdded: boolean
  onToggle: () => void
}) {
  const colorClass = CATEGORY_COLORS[rule.category] ?? 'text-slate-400 border-slate-400/40 bg-slate-400/10'

  return (
    <button
      onClick={onToggle}
      title={alreadyAdded ? 'Tikrar tikla: kaldir' : undefined}
      className={cn(
        'w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md border text-left transition-colors',
        alreadyAdded
          ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
          : checked
            ? 'border-blue-500/50 bg-blue-500/10'
            : 'border-border/30 bg-black/20 hover:bg-black/40 hover:border-border/50'
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center',
          alreadyAdded
            ? 'bg-emerald-500 border-emerald-500'
            : checked
              ? 'bg-blue-500 border-blue-500'
              : 'border-border/60'
        )}
      >
        {(checked || alreadyAdded) && <Check size={9} className="text-white" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-foreground">{rule.label}</span>
          <span className={cn('inline-flex px-1.5 h-4 items-center rounded text-[9px] font-medium border', colorClass)}>
            {rule.category}
          </span>
          {alreadyAdded && (
            <span className="inline-flex px-1.5 h-4 items-center rounded text-[9px] font-medium border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
              ekli
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed line-clamp-2">{rule.summary}</p>
        <span className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 block">{rule.id}</span>
      </div>
    </button>
  )
}
