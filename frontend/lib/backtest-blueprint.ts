import type {
    BacktestBlueprint,
    BacktestCatalogRule,
    BacktestPreset,
    BacktestRiskConfig,
    BacktestRuleParamSpec,
    Timeframe,
} from '@/types'

// ---------------------------------------------------------------------------
// Rule param definitions — source of truth for the frontend (same pattern as
// graph/apps/chart-client/src/backtest.ts). Backend API returns rule metadata
// without params, so we define them here and merge them in withRuleParams().
// ---------------------------------------------------------------------------
function i(key: string, label: string, def: number, min: number, max: number, step = 1): BacktestRuleParamSpec {
    return { key, label, type: 'int', default: def, min, max, step }
}
function n(key: string, label: string, def: number, min: number, max: number, step: number): BacktestRuleParamSpec {
    return { key, label, type: 'number', default: def, min, max, step }
}

const RULE_PARAMS: Record<string, BacktestRuleParamSpec[]> = {
    'hhhl':                [i('lookback',     'Lookback',         20,    5,   300)],
    'lhll':                [i('lookback',     'Lookback',         20,    5,   300)],
    'ema-stack':           [i('fast',         'Fast EMA',         20,    2,   200), i('slow', 'Slow EMA', 50, 5, 300)],
    'ema-cross':           [i('fast',         'Fast EMA',          9,    2,   120), i('slow', 'Slow EMA', 21, 3, 240)],
    'ma-ribbon':           [i('fast',         'Fast EMA',          8,    2,   120), i('mid', 'Mid EMA', 21, 3, 200), i('slow', 'Slow EMA', 55, 5, 300)],
    'rsi-regime':          [i('period',       'RSI Period',       14,    2,   200), n('level', 'Level', 50, 1, 99, 1)],
    'rsi-reclaim':         [i('period',       'RSI Period',       14,    2,   200), n('lower', 'Lower', 30, 1, 49, 1), n('upper', 'Upper', 70, 51, 99, 1)],
    'breakout':            [i('lookback',     'Lookback',         30,    5,   300), n('buffer', 'Buffer %', 0.6, 0.1, 10, 0.1)],
    'donchian-breakout':   [i('lookback',     'Lookback',         20,    5,   300)],
    'pullback':            [i('ema',          'EMA Period',       20,    2,   200), n('tolerance', 'Tolerance %', 1, 0.1, 10, 0.1)],
    'compression':         [i('bars',         'Bars',             12,    3,   100), n('rangePct', 'Range %', 2.5, 0.1, 20, 0.1)],
    'bollinger-squeeze':   [i('period',       'Period',           20,    5,   200), n('deviation', 'Deviation', 2, 1, 5, 0.1), n('widthPct', 'Width %', 6, 0.5, 25, 0.5)],
    'fib-bounce':          [i('lookback',     'Lookback',         55,   20,   300), n('upperLevel', 'Upper Fib', 0.382, 0.2, 0.8, 0.001), n('lowerLevel', 'Lower Fib', 0.618, 0.2, 0.9, 0.001)],
    'fib-golden-pocket':   [i('lookback',     'Lookback',         55,   20,   300), n('upperLevel', 'Upper Fib', 0.618, 0.4, 0.75, 0.001), n('lowerLevel', 'Lower Fib', 0.65, 0.5, 0.8, 0.001)],
    'support-hold':        [i('lookback',     'Lookback',         30,    5,   250), n('tolerance', 'Tolerance %', 0.8, 0.1, 5, 0.1)],
    'sr-flip-retest':      [i('lookback',     'Lookback',         25,    5,   250), n('tolerance', 'Tolerance %', 0.6, 0.1, 4, 0.1)],
    'ascending-triangle':  [i('bars',         'Bars',             24,    8,   120), n('tolerance', 'Tolerance %', 0.8, 0.1, 5, 0.1)],
    'double-bottom':       [i('bars',         'Bars',             30,   10,   160), n('tolerance', 'Tolerance %', 1.2, 0.2, 6, 0.1)],
    'bull-flag':           [i('impulseBars',  'Impulse Bars',      8,    3,    40), i('pullbackBars', 'Pullback Bars', 6, 3, 30), n('minMovePct', 'Min Move %', 4, 0.5, 20, 0.5)],
    'rectangle-breakout':  [i('bars',         'Bars',             20,    5,   120), n('rangePct', 'Range %', 4, 0.5, 20, 0.5)],
    'trend-slope':         [i('lookback',     'Lookback',         30,    5,   200), n('minMovePct', 'Min Move %', 6, 0.5, 30, 0.5)],
    'channel-trend':       [i('lookback',     'Lookback',         40,   10,   250)],
    'adx-dmi-trend':       [i('period',       'Period',           14,    5,   100), n('threshold', 'ADX Threshold', 25, 5, 60, 1), n('spread', 'DI Spread', 5, 0.5, 40, 0.5)],
    'aroon-trend':         [i('period',       'Period',           25,    5,   150), n('strongLevel', 'Strong Level', 70, 50, 100, 1), n('weakLevel', 'Weak Level', 30, 0, 50, 1)],
    'ichimoku-cloud-trend':[i('conversion',   'Conversion',        9,    2,    60), i('base', 'Base', 26, 3, 120), i('spanB', 'Span B', 52, 5, 240), i('displacement', 'Displacement', 26, 1, 120)],
    'vortex-trend':        [i('period',       'Period',           14,    5,   100), n('spread', 'Spread', 0.08, 0.01, 1, 0.01)],
    'supertrend-bias':     [i('period',       'Period',           14,    5,   100), n('multiplier', 'Multiplier', 3, 1, 10, 0.1)],
    'psar-trend':          [n('step',         'Step',           0.02, 0.001,  0.2, 0.001), n('maxStep', 'Max Step', 0.2, 0.02, 1, 0.01)],
    'macd-cross':          [i('fast',         'Fast',             12,    2,   200), i('slow', 'Slow', 26, 3, 300), i('signal', 'Signal', 9, 2, 120)],
    'macd-zero-bias':      [i('fast',         'Fast',             12,    2,   200), i('slow', 'Slow', 26, 3, 300), i('signal', 'Signal', 9, 2, 120)],
    'retest':              [i('bars',         'Bars',              4,    1,    50), n('tolerance', 'Tolerance %', 0.5, 0.1, 10, 0.1)],
    'volume-confirm':      [n('factor',       'Volume Factor',   1.6,    1,     8, 0.1), i('lookback', 'Lookback', 20, 5, 200)],
    'micro-breakout':      [i('bars',         'Bars',              6,    2,    60)],
    'reversal-candle':     [n('bodyPct',      'Body %',           60,   20,   100, 1)],
    'stoch-rsi-cross':     [i('rsiPeriod',    'RSI Period',       14,    2,   100), i('stochPeriod', 'Stoch Period', 14, 3, 100), i('signal', 'Signal', 3, 2, 20), n('oversold', 'Oversold', 20, 1, 49, 1), n('overbought', 'Overbought', 80, 51, 99, 1)],
}

/** Injects param definitions into the rule catalog received from the API. */
export function withRuleParams(rules: BacktestCatalogRule[]): BacktestCatalogRule[] {
    return rules.map((rule) => ({
        ...rule,
        params: RULE_PARAMS[rule.id] ?? [],
    }))
}

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

export function defaultParamsFor(rule: BacktestCatalogRule): Record<string, number> {
    const out: Record<string, number> = {}
    ;(rule.params ?? []).forEach((p) => {
        out[p.key] = p.default
    })
    return out
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
                params: defaultParamsFor(rule),
            })
        })
    })

    return blueprint
}

export function addRulesToActiveBlueprint(
    ruleIds: string[],
    ruleCatalog: BacktestCatalogRule[],
    existingBlueprint: BacktestBlueprint
): BacktestBlueprint {
    const blueprint: BacktestBlueprint = JSON.parse(JSON.stringify(existingBlueprint))
    const targetStage = blueprint.stages.setup ?? blueprint.stages[Object.keys(blueprint.stages)[0] as BacktestStageKey]
    if (!targetStage) return blueprint

    ruleIds.forEach((ruleId) => {
        const rule = ruleCatalog.find((r) => r.id === ruleId)
        if (!rule) return
        const alreadyAdded = targetStage.rules.some((r) => r.id === ruleId)
        if (alreadyAdded) return
        targetStage.rules.push({
            id: rule.id,
            required: true,
            params: defaultParamsFor(rule),
        })
    })

    return blueprint
}

/**
 * Removes the given rule IDs from every stage of the blueprint.
 * Used when the user un-checks a rule that was previously pushed
 * to the active blueprint from the AI rule catalog.
 */
export function removeRulesFromActiveBlueprint(
    ruleIds: string[],
    existingBlueprint: BacktestBlueprint
): BacktestBlueprint {
    const blueprint: BacktestBlueprint = JSON.parse(JSON.stringify(existingBlueprint))
    const idSet = new Set(ruleIds)
    Object.values(blueprint.stages).forEach((stage) => {
        if (!stage?.rules) return
        stage.rules = stage.rules.filter((r) => !idSet.has(r.id))
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
