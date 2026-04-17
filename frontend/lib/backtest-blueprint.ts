import type {
    BacktestBlueprint,
    BacktestCatalogRule,
    BacktestPreset,
    BacktestRiskConfig,
    Timeframe,
} from '@/types'

export const BACKTEST_STAGE_KEYS = ['trend', 'setup', 'trigger'] as const

export type BacktestStageKey = (typeof BACKTEST_STAGE_KEYS)[number]

export const DEFAULT_STAGE_TIMEFRAMES: Record<BacktestStageKey, Timeframe> = {
    trend: '1d',
    setup: '4h',
    trigger: '1h',
}

export const DEFAULT_BACKTEST_RISK: BacktestRiskConfig = {
    stopPct: 1.8,
    targetPct: 4,
    maxBars: 12,
}

export function createEmptyBlueprint(symbol = 'THYAO'): BacktestBlueprint {
    return {
        symbol,
        symbols: [symbol],
        stageThreshold: 2,
        direction: 'long',
        testWindowDays: 365,
        portfolio: {
            initialCapital: 100000,
            positionSize: 10000,
            commissionPct: 0.1,
        },
        risk: { ...DEFAULT_BACKTEST_RISK },
        stages: {
            trend: {
                key: 'trend',
                timeframe: DEFAULT_STAGE_TIMEFRAMES.trend,
                required: false,
                minOptionalMatches: 0,
                rules: [],
            },
            setup: {
                key: 'setup',
                timeframe: DEFAULT_STAGE_TIMEFRAMES.setup,
                required: true,
                minOptionalMatches: 0,
                rules: [],
            },
            trigger: {
                key: 'trigger',
                timeframe: DEFAULT_STAGE_TIMEFRAMES.trigger,
                required: true,
                minOptionalMatches: 0,
                rules: [],
            },
        },
    }
}

export function applyPresetToBlueprint(
    preset: BacktestPreset,
    ruleCatalog: BacktestCatalogRule[],
    symbol = 'THYAO'
): BacktestBlueprint {
    const blueprint = createEmptyBlueprint(symbol)
    blueprint.direction = preset.direction
    blueprint.stageThreshold = preset.stageThreshold

    preset.ruleIds.forEach((ruleId) => {
        const rule = ruleCatalog.find((item) => item.id === ruleId)
        if (!rule) return

        rule.stages.forEach((stageKey) => {
            if (!BACKTEST_STAGE_KEYS.includes(stageKey as BacktestStageKey)) return
            blueprint.stages[stageKey].rules.push({
                id: rule.id,
                required: true,
                params: {},
            })
        })
    })

    return blueprint
}

export function normalizeBlueprintCandidate(
    raw: unknown
): BacktestBlueprint | null {
    if (!raw || typeof raw !== 'object') return null
    const candidate = raw as Partial<BacktestBlueprint> & {
        blueprint?: BacktestBlueprint
    }

    if (candidate.blueprint && candidate.blueprint.stages) {
        return candidate.blueprint
    }

    if (candidate.stages && candidate.risk) {
        return candidate as BacktestBlueprint
    }

    return null
}
