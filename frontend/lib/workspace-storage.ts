import type { BacktestBlueprint } from '@/types'
import { normalizeBlueprintCandidate } from '@/lib/backtest-blueprint'

const ACTIVE_BLUEPRINT_KEY = 'evalon-active-blueprint'

export function readActiveBlueprint(): BacktestBlueprint | null {
    if (typeof window === 'undefined') return null

    const raw = window.localStorage.getItem(ACTIVE_BLUEPRINT_KEY)
    if (!raw) return null

    try {
        return normalizeBlueprintCandidate(JSON.parse(raw))
    } catch {
        return null
    }
}

export function saveActiveBlueprint(blueprint: BacktestBlueprint): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACTIVE_BLUEPRINT_KEY, JSON.stringify(blueprint))
}
