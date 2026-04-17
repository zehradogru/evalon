'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { applyPresetToBlueprint, createEmptyBlueprint, normalizeBlueprintCandidate } from '@/lib/backtest-blueprint'
import { readActiveBlueprint, saveActiveBlueprint } from '@/lib/workspace-storage'
import { aiService } from '@/services/ai.service'
import { backtestsService } from '@/services/backtests.service'
import { useAuthStore } from '@/store/use-auth-store'

export function StrategyView() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [title, setTitle] = useState('My Blueprint')
  const [draftText, setDraftText] = useState(() => JSON.stringify(readActiveBlueprint() || createEmptyBlueprint(), null, 2))
  const [error, setError] = useState<string | null>(null)

  const rulesQuery = useQuery({ queryKey: ['strategy-rule-catalog'], queryFn: () => backtestsService.getRuleCatalog(), staleTime: 300000 })
  const presetsQuery = useQuery({ queryKey: ['strategy-preset-catalog'], queryFn: () => backtestsService.getPresetCatalog(), staleTime: 300000 })
  const assetsQuery = useQuery({
    queryKey: ['strategy-assets', user?.id],
    queryFn: () => aiService.getAssets(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60000,
  })

  const strategyAssets = useMemo(() => assetsQuery.data?.assets.strategies || [], [assetsQuery.data])

  const currentBlueprint = useMemo(() => {
    try {
      return normalizeBlueprintCandidate(JSON.parse(draftText))
    } catch {
      return null
    }
  }, [draftText])

  const loadPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = presetsQuery.data?.presets.find((item) => item.id === presetId)
    if (!preset || !rulesQuery.data) return
    const blueprint = applyPresetToBlueprint(preset, rulesQuery.data.rules)
    setDraftText(JSON.stringify(blueprint, null, 2))
    saveActiveBlueprint(blueprint)
    setTitle(preset.label)
    setError(null)
  }

  const loadAsset = (assetId: string) => {
    setSelectedAssetId(assetId)
    const asset = strategyAssets.find((item) => item.asset_id === assetId)
    if (!asset) return
    const blueprint = normalizeBlueprintCandidate(asset.spec)
    if (!blueprint) {
      setError('Bu asset icinde kullanilabilir bir blueprint bulunamadi.')
      return
    }
    setDraftText(JSON.stringify(blueprint, null, 2))
    saveActiveBlueprint(blueprint)
    setTitle(asset.title)
    setError(null)
  }

  const persistDraft = () => {
    if (!currentBlueprint) {
      setError('JSON blueprint gecersiz. Kaydetmeden once duzeltin.')
      return
    }
    saveActiveBlueprint(currentBlueprint)
    setError(null)
  }

  return <div className="flex flex-col gap-6 p-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight">Strategy Workspace</h1>
      <p className="text-muted-foreground">Kalici strategy CRUD yerine AI draft + editable blueprint mantigi kullaniliyor.</p>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Editable Blueprint</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">Preset</span><Select value={selectedPresetId} onChange={(event) => loadPreset(event.target.value)}><option value="">Select preset</option>{(presetsQuery.data?.presets || []).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</Select></label>
            <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground">AI Draft</span><Select value={selectedAssetId} onChange={(event) => loadAsset(event.target.value)}><option value="">Select saved strategy</option>{strategyAssets.map((asset) => <option key={asset.asset_id} value={asset.asset_id}>{asset.title}</option>)}</Select></label>
          </div>
          <textarea className="min-h-[420px] w-full rounded-md border border-input bg-background px-3 py-3 font-mono text-xs leading-6 outline-none focus:ring-1 focus:ring-ring" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={persistDraft}>Save As Active Blueprint</Button>
            <Button type="button" variant="secondary" onClick={() => currentBlueprint && router.push('/backtest')} disabled={!currentBlueprint}>Open In Backtest</Button>
            <Button type="button" variant="outline" onClick={() => setDraftText(JSON.stringify(createEmptyBlueprint(), null, 2))}>Reset Draft</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Current Draft Status</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Blueprint State</div>
              <div className="mt-1 font-semibold">{currentBlueprint ? 'Valid' : 'Invalid JSON'}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Selected Symbol</div>
              <div className="mt-1 font-semibold">{currentBlueprint?.symbol || currentBlueprint?.symbols?.[0] || '-'}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Direction</div>
              <div className="mt-1 font-semibold">{currentBlueprint?.direction || '-'}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="text-xs text-muted-foreground">Stage Threshold</div>
              <div className="mt-1 font-semibold">{currentBlueprint?.stageThreshold ?? '-'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border/60"><CardTitle className="text-base">Saved AI Strategy Drafts</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-6">
            {!strategyAssets.length ? <div className="text-sm text-muted-foreground">Kayitli AI strategy draft’i henuz yok.</div> : strategyAssets.map((asset) => <button key={asset.asset_id} type="button" onClick={() => loadAsset(asset.asset_id)} className="w-full rounded-lg border border-border/70 bg-background/60 px-3 py-3 text-left transition-colors hover:bg-background"><div className="font-medium">{asset.title}</div><div className="mt-1 text-xs text-muted-foreground">{asset.description || 'Aciklama yok'}</div></button>)}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
}
