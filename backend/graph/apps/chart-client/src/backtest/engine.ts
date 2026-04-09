import type { CandleData, CandleResponse, TimeFrame } from '@graph/shared-types';

const API_BASE = import.meta.env?.VITE_API_BASE || '/api/v1';

type StageKey = 'trend' | 'setup' | 'trigger';
type Direction = 'long' | 'short';
type TradeDirection = Direction | 'both';
type SymbolLoadResult = { symbol: string; result: SingleSymbolRunResult } | { symbol: string; error: string };

interface SelectedRule {
    id: string;
    required: boolean;
    params: Record<string, number>;
}

interface StageConfig {
    key: StageKey;
    timeframe: TimeFrame;
    required: boolean;
    minOptionalMatches: number;
    rules: SelectedRule[];
}

interface BacktestBlueprintInput {
    symbol: string;
    symbols?: string[];
    stageThreshold: number;
    direction: TradeDirection;
    testWindowDays?: number;
    portfolio?: {
        initialCapital?: number;
        positionSize?: number;
        commissionPct?: number;
    };
    risk: {
        stopPct: number;
        targetPct: number;
        maxBars: number;
    };
    stages: Record<StageKey, StageConfig>;
}

interface RuleMask {
    long: boolean[];
    short: boolean[];
}

interface StageState {
    time: number;
    longPass: boolean;
    shortPass: boolean;
    longRequiredHits: string[];
    shortRequiredHits: string[];
    longOptionalHits: string[];
    shortOptionalHits: string[];
}

interface StageEvaluation {
    stageKey: StageKey;
    timeframe: TimeFrame;
    bars: CandleData[];
    states: StageState[];
}

interface DirectionDecision {
    direction: Direction;
    eligible: boolean;
    passedStages: number;
    score: number;
    snapshots: Record<StageKey, BacktestStageSnapshot>;
}

interface PortfolioConfig {
    initialCapital: number;
    positionSize: number;
    commissionPct: number;
}

interface OpenTrade {
    id: string;
    side: Direction;
    entryIndex: number;
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    snapshots: Record<StageKey, BacktestStageSnapshot>;
    score: number;
}

interface CandidateTrade {
    id: string;
    symbol: string;
    side: Direction;
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    pnlPct: number;
    barsHeld: number;
    exitReason: 'target' | 'stop' | 'timeout' | 'end_of_data';
    score: number;
    stages: Record<StageKey, BacktestStageSnapshot>;
}

interface ExecutedPosition {
    trade: CandidateTrade;
    allocatedCapital: number;
    entryCommissionAmount: number;
}

interface SingleSymbolRunResult {
    context: {
        symbol: string;
        generatedAt: number;
        timeframes: Record<StageKey, TimeFrame>;
        activeStages: StageKey[];
        executionStage: StageKey;
    };
    summary: SingleSymbolSummary;
    trades: CandidateTrade[];
    stageStats: Record<StageKey, BacktestStageStats>;
    notes: string[];
    range: {
        from: number;
        to: number;
    };
    dataPoints: Record<StageKey, number>;
}

interface SingleSymbolSummary {
    totalTrades: number;
    winRate: number;
    totalPnlPct: number;
    averagePnlPct: number;
    profitFactor: number;
    maxDrawdownPct: number;
    averageBarsHeld: number;
}

export interface BacktestStageSnapshot {
    timeframe: TimeFrame;
    passed: boolean;
    requiredHits: string[];
    optionalHits: string[];
}

export interface BacktestTrade {
    id: string;
    symbol: string;
    side: Direction;
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    pnlPct: number;
    quantity: number;
    allocatedCapital: number;
    grossPnlAmount: number;
    netPnlAmount: number;
    entryCommissionAmount: number;
    exitCommissionAmount: number;
    endingBalance: number;
    barsHeld: number;
    exitReason: 'target' | 'stop' | 'timeout' | 'end_of_data';
    score: number;
    stages: Record<StageKey, BacktestStageSnapshot>;
}

export interface BacktestSkippedTrade {
    id: string;
    symbol: string;
    side: Direction;
    entryTime: number;
    entryPrice: number;
    requiredCash: number;
    availableCash: number;
    score: number;
    reason: 'insufficient_cash';
}

export interface BacktestSymbolStats {
    symbol: string;
    totalTrades: number;
    skippedTrades: number;
    winRate: number;
    returnPct: number;
    netPnlAmount: number;
    totalCommissionAmount: number;
}

export interface BacktestRunSummary {
    totalTrades: number;
    winRate: number;
    totalPnlPct: number;
    averagePnlPct: number;
    profitFactor: number;
    maxDrawdownPct: number;
    averageBarsHeld: number;
    initialCapital: number;
    finalBalance: number;
    totalGrossPnlAmount: number;
    totalNetPnlAmount: number;
    totalCommissionAmount: number;
    skippedTrades: number;
    maxConcurrentPositions: number;
}

export interface BacktestPortfolioCurvePoint {
    time: number;
    balance: number;
    drawdownPct: number;
    netPnlAmount: number;
    symbol?: string | null;
    tradeId?: string | null;
    openPositions: number;
    event: 'start' | 'close';
}

export interface BacktestPortfolioCurve {
    mode: 'closed_balance';
    initialBalance: number;
    finalBalance: number;
    peakBalance: number;
    lowBalance: number;
    maxDrawdownPct: number;
    points: BacktestPortfolioCurvePoint[];
}

export interface BacktestStageStats {
    timeframe: TimeFrame;
    passRate: number;
    passedBars: number;
    coreBars: number;
    ruleCount: number;
    requiredRuleCount: number;
}

export interface BacktestRunResult {
    context: {
        symbol: string;
        symbols: string[];
        generatedAt: number;
        timeframes: Record<StageKey, TimeFrame>;
        activeStages: StageKey[];
        executionStage: StageKey;
        portfolioMode: boolean;
    };
    portfolio: PortfolioConfig;
    summary: BacktestRunSummary;
    portfolioCurve?: BacktestPortfolioCurve;
    trades: BacktestTrade[];
    skippedTrades: BacktestSkippedTrade[];
    symbolStats: BacktestSymbolStats[];
    stageStats: Record<StageKey, BacktestStageStats>;
    notes: string[];
    range: {
        from: number;
        to: number;
    };
    dataPoints: Record<StageKey, number>;
    symbolErrors: Array<{ symbol: string; message: string }>;
}

export async function runBlueprintBacktest(blueprint: BacktestBlueprintInput): Promise<BacktestRunResult> {
    const testWindowDays = clampInt(blueprint.testWindowDays, 365, 30, 3650);
    const endTime = Math.floor(Date.now() / 1000);
    const coreStartTime = endTime - testWindowDays * 86400;
    const warmupBars = deriveWarmupBars(blueprint);
    const activeStageKeys = getActiveStageKeys(blueprint);
    if (activeStageKeys.length === 0) {
        throw new Error('En az bir stage icin en az bir kural secmelisin.');
    }
    const executionStage = getExecutionStageKey(blueprint, activeStageKeys);
    const portfolio = normalizePortfolioConfig(blueprint.portfolio);
    const symbols = normalizeSymbols(blueprint);

    const loadResults = await runWithConcurrency(symbols, 6, async (symbol) => {
        try {
            const result = await runSingleSymbolBlueprintBacktest(
                blueprint,
                symbol,
                testWindowDays,
                endTime,
                coreStartTime,
                warmupBars,
                activeStageKeys,
                executionStage
            );
            return { symbol, result } as SymbolLoadResult;
        } catch (error) {
            return {
                symbol,
                error: (error as Error).message || 'Bilinmeyen hata',
            } as SymbolLoadResult;
        }
    });

    const symbolRuns = loadResults
        .filter((item): item is { symbol: string; result: SingleSymbolRunResult } => 'result' in item)
        .map((item) => item.result);
    const symbolErrors = loadResults
        .filter((item): item is { symbol: string; error: string } => 'error' in item)
        .map((item) => ({ symbol: item.symbol, message: item.error }));

    if (symbolRuns.length === 0) {
        throw new Error(symbolErrors[0]?.message || 'Secilen semboller icin veri bulunamadi.');
    }

    const portfolioRun = simulatePortfolio(symbolRuns, portfolio);
    const stageStats = aggregateStageStats(blueprint, symbolRuns);
    const summary = buildPortfolioSummary(portfolioRun, portfolio);
    const range = aggregateRange(symbolRuns);
    const dataPoints = aggregateDataPoints(symbolRuns);
    const notes = buildPortfolioNotes(
        summary,
        stageStats,
        testWindowDays,
        activeStageKeys,
        executionStage,
        symbolRuns,
        portfolio,
        symbolErrors
    );

    return {
        context: {
            symbol: symbols[0],
            symbols,
            generatedAt: endTime,
            timeframes: {
                trend: blueprint.stages.trend.timeframe,
                setup: blueprint.stages.setup.timeframe,
                trigger: blueprint.stages.trigger.timeframe,
            },
            activeStages: activeStageKeys,
            executionStage,
            portfolioMode: symbols.length > 1,
        },
        portfolio,
        summary,
        trades: portfolioRun.executedTrades,
        skippedTrades: portfolioRun.skippedTrades,
        symbolStats: buildSymbolStats(portfolioRun, symbols, portfolio.initialCapital),
        stageStats,
        notes,
        range,
        dataPoints,
        symbolErrors,
    };
}

async function runSingleSymbolBlueprintBacktest(
    blueprint: BacktestBlueprintInput,
    symbol: string,
    testWindowDays: number,
    endTime: number,
    coreStartTime: number,
    warmupBars: number,
    activeStageKeys: StageKey[],
    executionStage: StageKey
): Promise<SingleSymbolRunResult> {
    const barsByStage = await loadStageBarsForSymbol(
        blueprint,
        symbol,
        coreStartTime,
        endTime,
        warmupBars,
        activeStageKeys
    );
    const stageEntries = (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
        const stage = blueprint.stages[stageKey];
        if (!activeStageKeys.includes(stageKey)) {
            return [stageKey, {
                stageKey,
                timeframe: stage.timeframe,
                bars: [],
                states: [],
            }] as const;
        }
        return [stageKey, evaluateStage(stage, barsByStage[stageKey])] as const;
    });

    const evaluations = Object.fromEntries(stageEntries) as Record<StageKey, StageEvaluation>;
    const executionEvaluation = evaluations[executionStage];
    if (executionEvaluation.bars.length === 0) {
        throw new Error(`${symbol} icin secilen timeframe kombinasyonunda veri bulunamadi.`);
    }

    const trades = simulateTrades(symbol, blueprint, evaluations, coreStartTime, activeStageKeys, executionStage);
    const stageStats = buildStageStats(blueprint, evaluations, coreStartTime, activeStageKeys);
    const summary = buildSingleSymbolSummary(trades);
    const range = deriveRange(executionEvaluation.bars, coreStartTime);
    const dataPoints = {
        trend: evaluations.trend.bars.length,
        setup: evaluations.setup.bars.length,
        trigger: evaluations.trigger.bars.length,
    };

    return {
        context: {
            symbol,
            generatedAt: endTime,
            timeframes: {
                trend: blueprint.stages.trend.timeframe,
                setup: blueprint.stages.setup.timeframe,
                trigger: blueprint.stages.trigger.timeframe,
            },
            activeStages: activeStageKeys,
            executionStage,
        },
        summary,
        trades,
        stageStats,
        notes: buildNotes(blueprint, summary, stageStats, testWindowDays, activeStageKeys, executionStage),
        range,
        dataPoints,
    };
}

async function loadStageBarsForSymbol(
    blueprint: BacktestBlueprintInput,
    symbol: string,
    from: number,
    to: number,
    warmupBars: number,
    activeStageKeys: StageKey[]
): Promise<Record<StageKey, CandleData[]>> {
    const activeTimeframes = Array.from(new Set(activeStageKeys.map((stageKey) => blueprint.stages[stageKey].timeframe)));
    const timeframeBars = canUseHourlyBaseOptimization(activeTimeframes, from, to, warmupBars)
        ? await fetchBarsFromHourlyBase(symbol, activeTimeframes, from, to, warmupBars)
        : await fetchBarsByTimeframe(symbol, activeTimeframes, from, to, warmupBars);

    return {
        trend: activeStageKeys.includes('trend') ? (timeframeBars[blueprint.stages.trend.timeframe] || []) : [],
        setup: activeStageKeys.includes('setup') ? (timeframeBars[blueprint.stages.setup.timeframe] || []) : [],
        trigger: activeStageKeys.includes('trigger') ? (timeframeBars[blueprint.stages.trigger.timeframe] || []) : [],
    };
}

async function fetchBarsByTimeframe(
    symbol: string,
    timeframes: TimeFrame[],
    from: number,
    to: number,
    warmupBars: number
): Promise<Partial<Record<TimeFrame, CandleData[]>>> {
    const entries = await Promise.all(
        timeframes.map(async (timeframe) => [timeframe, await fetchBars(symbol, timeframe, from, to, warmupBars)] as const)
    );
    return Object.fromEntries(entries) as Partial<Record<TimeFrame, CandleData[]>>;
}

function canUseHourlyBaseOptimization(
    timeframes: TimeFrame[],
    from: number,
    to: number,
    warmupBars: number
): boolean {
    if (timeframes.length < 2 || !timeframes.includes('1h')) {
        return false;
    }

    const compatible = new Set<TimeFrame>(['1h', '2h', '4h', '1d']);
    if (!timeframes.every((timeframe) => compatible.has(timeframe))) {
        return false;
    }

    const maxTimeframeSec = Math.max(...timeframes.map((timeframe) => getTimeframeSeconds(timeframe)));
    const estimatedStart = Math.max(0, from - warmupBars * maxTimeframeSec);
    const estimatedBaseLimit = Math.ceil((to - estimatedStart) / getTimeframeSeconds('1h')) + 10;
    return estimatedBaseLimit <= 25_000;
}

async function fetchBarsFromHourlyBase(
    symbol: string,
    timeframes: TimeFrame[],
    from: number,
    to: number,
    warmupBars: number
): Promise<Partial<Record<TimeFrame, CandleData[]>>> {
    const baseTimeframe = '1h' as const;
    const maxTimeframeSec = Math.max(...timeframes.map((timeframe) => getTimeframeSeconds(timeframe)));
    const start = Math.max(0, from - warmupBars * maxTimeframeSec);
    const limit = Math.min(200_000, Math.max(250, Math.ceil((to - start) / getTimeframeSeconds(baseTimeframe)) + 10));
    const baseBars = await fetchBarsRange(symbol, baseTimeframe, start, to, limit);
    const result: Partial<Record<TimeFrame, CandleData[]>> = {
        '1h': baseBars,
    };

    for (const timeframe of timeframes) {
        if (timeframe === '1h') continue;
        if (timeframe === '2h') {
            result[timeframe] = aggregateIntradayHourlyBars(baseBars, 2);
            continue;
        }
        if (timeframe === '4h') {
            result[timeframe] = aggregateIntradayHourlyBars(baseBars, 4);
            continue;
        }
        if (timeframe === '1d') {
            result[timeframe] = aggregateDailyBars(baseBars);
            continue;
        }
        result[timeframe] = await fetchBars(symbol, timeframe, from, to, warmupBars);
    }

    return result;
}

async function fetchBars(
    symbol: string,
    timeframe: TimeFrame,
    from: number,
    to: number,
    warmupBars: number
): Promise<CandleData[]> {
    const timeframeSec = getTimeframeSeconds(timeframe);
    const start = Math.max(0, from - warmupBars * timeframeSec);
    const limit = Math.min(200_000, Math.max(250, Math.ceil((to - start) / timeframeSec) + 10));
    return fetchBarsRange(symbol, timeframe, start, to, limit);
}

async function fetchBarsRange(
    symbol: string,
    timeframe: TimeFrame,
    start: number,
    to: number,
    limit: number
): Promise<CandleData[]> {
    const url = new URL(`${API_BASE}/candles`, window.location.origin);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('tf', timeframe);
    url.searchParams.set('from', String(start));
    url.searchParams.set('to', String(to));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString());
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Veri cekilemedi (${timeframe}): ${detail.slice(0, 180)}`);
    }

    const payload = await response.json() as CandleResponse;
    return (payload.data || [])
        .map((bar) => ({
            t: normalizeUnixSeconds(bar.t as unknown),
            o: Number(bar.o),
            h: Number(bar.h),
            l: Number(bar.l),
            c: Number(bar.c),
            v: Number(bar.v),
        }))
        .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.o) && Number.isFinite(bar.c))
        .sort((a, b) => a.t - b.t);
}

function aggregateIntradayHourlyBars(bars: CandleData[], hoursPerBar: number): CandleData[] {
    if (bars.length === 0 || hoursPerBar <= 1) {
        return [...bars];
    }

    const aggregated: CandleData[] = [];
    let currentDayKey = '';
    let dayBars: CandleData[] = [];

    for (const bar of bars) {
        const dayKey = formatDayKey(bar.t);
        if (dayKey !== currentDayKey) {
            if (dayBars.length > 0) {
                aggregated.push(...flushIntradayBuckets(dayBars, hoursPerBar));
            }
            currentDayKey = dayKey;
            dayBars = [bar];
            continue;
        }
        dayBars.push(bar);
    }

    if (dayBars.length > 0) {
        aggregated.push(...flushIntradayBuckets(dayBars, hoursPerBar));
    }

    return aggregated;
}

function flushIntradayBuckets(dayBars: CandleData[], hoursPerBar: number): CandleData[] {
    const out: CandleData[] = [];
    for (let index = 0; index < dayBars.length; index += hoursPerBar) {
        out.push(aggregateBarChunk(dayBars.slice(index, index + hoursPerBar)));
    }
    return out;
}

function aggregateDailyBars(bars: CandleData[]): CandleData[] {
    if (bars.length === 0) return [];

    const aggregated: CandleData[] = [];
    let currentDayKey = '';
    let dayBars: CandleData[] = [];

    for (const bar of bars) {
        const dayKey = formatDayKey(bar.t);
        if (dayKey !== currentDayKey) {
            if (dayBars.length > 0) {
                aggregated.push(aggregateBarChunk(dayBars));
            }
            currentDayKey = dayKey;
            dayBars = [bar];
            continue;
        }
        dayBars.push(bar);
    }

    if (dayBars.length > 0) {
        aggregated.push(aggregateBarChunk(dayBars));
    }

    return aggregated;
}

function aggregateBarChunk(bars: CandleData[]): CandleData {
    const first = bars[0];
    const last = bars[bars.length - 1];
    let high = first.h;
    let low = first.l;
    let volume = 0;

    for (const bar of bars) {
        high = Math.max(high, bar.h);
        low = Math.min(low, bar.l);
        volume += Number.isFinite(bar.v) ? bar.v : 0;
    }

    return {
        t: last.t,
        o: first.o,
        h: high,
        l: low,
        c: last.c,
        v: roundNumber(volume, 4),
    };
}

function evaluateStage(stage: StageConfig, bars: CandleData[]): StageEvaluation {
    const masks = stage.rules.map((rule) => ({
        rule,
        mask: evaluateRule(rule, bars),
    }));

    const states: StageState[] = bars.map((bar, index) => {
        if (stage.rules.length === 0) {
            return {
                time: bar.t,
                longPass: false,
                shortPass: false,
                longRequiredHits: [],
                shortRequiredHits: [],
                longOptionalHits: [],
                shortOptionalHits: [],
            };
        }

        const longRequiredHits: string[] = [];
        const shortRequiredHits: string[] = [];
        const longOptionalHits: string[] = [];
        const shortOptionalHits: string[] = [];
        let requiredLongOk = true;
        let requiredShortOk = true;

        for (const { rule, mask } of masks) {
            const longHit = Boolean(mask.long[index]);
            const shortHit = Boolean(mask.short[index]);
            if (rule.required) {
                if (longHit) longRequiredHits.push(rule.id);
                if (shortHit) shortRequiredHits.push(rule.id);
                requiredLongOk = requiredLongOk && longHit;
                requiredShortOk = requiredShortOk && shortHit;
            } else {
                if (longHit) longOptionalHits.push(rule.id);
                if (shortHit) shortOptionalHits.push(rule.id);
            }
        }

        const longPass = requiredLongOk && longOptionalHits.length >= stage.minOptionalMatches;
        const shortPass = requiredShortOk && shortOptionalHits.length >= stage.minOptionalMatches;
        return {
            time: bar.t,
            longPass,
            shortPass,
            longRequiredHits,
            shortRequiredHits,
            longOptionalHits,
            shortOptionalHits,
        };
    });

    return {
        stageKey: stage.key,
        timeframe: stage.timeframe,
        bars,
        states,
    };
}

function evaluateRule(rule: SelectedRule, bars: CandleData[]): RuleMask {
    switch (rule.id) {
        case 'hhhl':
            return evaluateRisingStructure(bars, clampInt(rule.params.lookback, 20, 5, 300));
        case 'lhll':
            return evaluateFallingStructure(bars, clampInt(rule.params.lookback, 20, 5, 300));
        case 'ema-stack':
            return evaluateEmaStack(
                bars,
                clampInt(rule.params.fast, 20, 2, 200),
                clampInt(rule.params.slow, 50, 5, 300)
            );
        case 'ema-cross':
            return evaluateEmaCross(
                bars,
                clampInt(rule.params.fast, 9, 2, 120),
                clampInt(rule.params.slow, 21, 3, 240)
            );
        case 'ma-ribbon':
            return evaluateMaRibbon(
                bars,
                clampInt(rule.params.fast, 8, 2, 120),
                clampInt(rule.params.mid, 21, 3, 200),
                clampInt(rule.params.slow, 55, 5, 300)
            );
        case 'rsi-regime':
            return evaluateRsiRegime(
                bars,
                clampInt(rule.params.period, 14, 2, 200),
                clampNumber(rule.params.level, 50, 1, 99)
            );
        case 'rsi-reclaim':
            return evaluateRsiReclaim(
                bars,
                clampInt(rule.params.period, 14, 2, 200),
                clampNumber(rule.params.lower, 30, 1, 49),
                clampNumber(rule.params.upper, 70, 51, 99)
            );
        case 'breakout':
            return evaluateBreakout(
                bars,
                clampInt(rule.params.lookback, 30, 5, 300),
                clampNumber(rule.params.buffer, 0.6, 0.1, 10)
            );
        case 'donchian-breakout':
            return evaluateDonchianBreakout(
                bars,
                clampInt(rule.params.lookback, 20, 5, 300)
            );
        case 'pullback':
            return evaluatePullback(
                bars,
                clampInt(rule.params.ema, 20, 2, 200),
                clampNumber(rule.params.tolerance, 1, 0.1, 10)
            );
        case 'compression':
            return evaluateCompression(
                bars,
                clampInt(rule.params.bars, 12, 3, 100),
                clampNumber(rule.params.rangePct, 2.5, 0.1, 20)
            );
        case 'bollinger-squeeze':
            return evaluateBollingerSqueeze(
                bars,
                clampInt(rule.params.period, 20, 5, 200),
                clampNumber(rule.params.deviation, 2, 1, 5),
                clampNumber(rule.params.widthPct, 6, 0.5, 25)
            );
        case 'fib-bounce':
            return evaluateFibBounce(
                bars,
                clampInt(rule.params.lookback, 55, 20, 300),
                clampNumber(rule.params.upperLevel, 0.382, 0.2, 0.8),
                clampNumber(rule.params.lowerLevel, 0.618, 0.2, 0.9)
            );
        case 'fib-golden-pocket':
            return evaluateFibBounce(
                bars,
                clampInt(rule.params.lookback, 55, 20, 300),
                clampNumber(rule.params.upperLevel, 0.618, 0.4, 0.75),
                clampNumber(rule.params.lowerLevel, 0.65, 0.5, 0.8)
            );
        case 'support-hold':
            return evaluateSupportHold(
                bars,
                clampInt(rule.params.lookback, 30, 5, 250),
                clampNumber(rule.params.tolerance, 0.8, 0.1, 5)
            );
        case 'sr-flip-retest':
            return evaluateSrFlipRetest(
                bars,
                clampInt(rule.params.lookback, 25, 5, 250),
                clampNumber(rule.params.tolerance, 0.6, 0.1, 4)
            );
        case 'ascending-triangle':
            return evaluateAscendingTriangle(
                bars,
                clampInt(rule.params.bars, 24, 8, 120),
                clampNumber(rule.params.tolerance, 0.8, 0.1, 5)
            );
        case 'double-bottom':
            return evaluateDoubleBottom(
                bars,
                clampInt(rule.params.bars, 30, 10, 160),
                clampNumber(rule.params.tolerance, 1.2, 0.2, 6)
            );
        case 'bull-flag':
            return evaluateBullFlag(
                bars,
                clampInt(rule.params.impulseBars, 8, 3, 40),
                clampInt(rule.params.pullbackBars, 6, 3, 30),
                clampNumber(rule.params.minMovePct, 4, 0.5, 20)
            );
        case 'rectangle-breakout':
            return evaluateRectangleBreakout(
                bars,
                clampInt(rule.params.bars, 20, 5, 120),
                clampNumber(rule.params.rangePct, 4, 0.5, 20)
            );
        case 'trend-slope':
            return evaluateTrendSlope(
                bars,
                clampInt(rule.params.lookback, 30, 5, 200),
                clampNumber(rule.params.minMovePct, 6, 0.5, 30)
            );
        case 'channel-trend':
            return evaluateChannelTrend(
                bars,
                clampInt(rule.params.lookback, 40, 10, 250)
            );
        case 'adx-dmi-trend':
            return evaluateAdxDmiTrend(
                bars,
                clampInt(rule.params.period, 14, 5, 100),
                clampNumber(rule.params.threshold, 25, 5, 60),
                clampNumber(rule.params.spread, 5, 0.5, 40)
            );
        case 'aroon-trend':
            return evaluateAroonTrend(
                bars,
                clampInt(rule.params.period, 25, 5, 150),
                clampNumber(rule.params.strongLevel, 70, 50, 100),
                clampNumber(rule.params.weakLevel, 30, 0, 50)
            );
        case 'ichimoku-cloud-trend':
            return evaluateIchimokuCloudTrend(
                bars,
                clampInt(rule.params.conversion, 9, 2, 60),
                clampInt(rule.params.base, 26, 3, 120),
                clampInt(rule.params.spanB, 52, 5, 240),
                clampInt(rule.params.displacement, 26, 1, 120)
            );
        case 'vortex-trend':
            return evaluateVortexTrend(
                bars,
                clampInt(rule.params.period, 14, 5, 100),
                clampNumber(rule.params.spread, 0.08, 0.01, 1)
            );
        case 'supertrend-bias':
            return evaluateSupertrendBias(
                bars,
                clampInt(rule.params.period, 14, 5, 100),
                clampNumber(rule.params.multiplier, 3, 1, 10)
            );
        case 'psar-trend':
            return evaluatePsarTrend(
                bars,
                clampNumber(rule.params.step, 0.02, 0.001, 0.2),
                clampNumber(rule.params.maxStep, 0.2, 0.02, 1)
            );
        case 'macd-zero-bias':
            return evaluateMacdZeroBias(
                bars,
                clampInt(rule.params.fast, 12, 2, 200),
                clampInt(rule.params.slow, 26, 3, 300),
                clampInt(rule.params.signal, 9, 2, 120)
            );
        case 'macd-cross':
            return evaluateMacdCross(
                bars,
                clampInt(rule.params.fast, 12, 2, 200),
                clampInt(rule.params.slow, 26, 3, 300),
                clampInt(rule.params.signal, 9, 2, 120)
            );
        case 'retest':
            return evaluateRetest(
                bars,
                clampInt(rule.params.bars, 4, 1, 50),
                clampNumber(rule.params.tolerance, 0.5, 0.1, 10)
            );
        case 'volume-confirm':
            return evaluateVolumeConfirm(
                bars,
                clampNumber(rule.params.factor, 1.6, 1, 8),
                clampInt(rule.params.lookback, 20, 5, 200)
            );
        case 'vwap-reclaim':
            return evaluateVwapReclaim(bars);
        case 'micro-breakout':
            return evaluateMicroBreakout(
                bars,
                clampInt(rule.params.bars, 6, 2, 60)
            );
        case 'inside-breakout':
            return evaluateInsideBreakout(bars);
        case 'reversal-candle':
            return evaluateReversalCandle(
                bars,
                clampNumber(rule.params.bodyPct, 60, 20, 100)
            );
        case 'stoch-rsi-cross':
            return evaluateStochRsiCross(
                bars,
                clampInt(rule.params.rsiPeriod, 14, 2, 100),
                clampInt(rule.params.stochPeriod, 14, 3, 100),
                clampInt(rule.params.signal, 3, 2, 20),
                clampNumber(rule.params.oversold, 20, 1, 49),
                clampNumber(rule.params.overbought, 80, 51, 99)
            );
        default:
            return createEmptyMask(bars.length);
    }
}

function evaluateRisingStructure(bars: CandleData[], lookback: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const start = i - lookback;
        const split = start + Math.max(1, Math.floor(lookback / 2));
        const firstLow = minLow(bars, start, split);
        const secondLow = minLow(bars, split, i + 1);
        const firstHigh = maxHigh(bars, start, split);
        const secondHigh = maxHigh(bars, split, i + 1);
        out.long[i] = secondLow > firstLow && secondHigh > firstHigh && bars[i].c > bars[split].c;
    }
    return out;
}

function evaluateFallingStructure(bars: CandleData[], lookback: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const start = i - lookback;
        const split = start + Math.max(1, Math.floor(lookback / 2));
        const firstLow = minLow(bars, start, split);
        const secondLow = minLow(bars, split, i + 1);
        const firstHigh = maxHigh(bars, start, split);
        const secondHigh = maxHigh(bars, split, i + 1);
        out.short[i] = secondLow < firstLow && secondHigh < firstHigh && bars[i].c < bars[split].c;
    }
    return out;
}

function evaluateEmaStack(bars: CandleData[], fastPeriod: number, slowPeriod: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const safeFast = Math.min(fastPeriod, Math.max(2, slowPeriod - 1));
    const safeSlow = Math.max(slowPeriod, safeFast + 1);
    const fast = ema(closes, safeFast);
    const slow = ema(closes, safeSlow);
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        out.long[i] = bars[i].c > fast[i] && fast[i] > slow[i];
        out.short[i] = bars[i].c < fast[i] && fast[i] < slow[i];
    }
    return out;
}

function evaluateEmaCross(bars: CandleData[], fastPeriod: number, slowPeriod: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const safeFast = Math.min(fastPeriod, Math.max(2, slowPeriod - 1));
    const safeSlow = Math.max(slowPeriod, safeFast + 1);
    const fast = ema(closes, safeFast);
    const slow = ema(closes, safeSlow);
    const out = createEmptyMask(bars.length);
    for (let i = 1; i < bars.length; i += 1) {
        out.long[i] = fast[i - 1] < slow[i - 1] && fast[i] >= slow[i];
        out.short[i] = fast[i - 1] > slow[i - 1] && fast[i] <= slow[i];
    }
    return out;
}

function evaluateMaRibbon(bars: CandleData[], fastPeriod: number, midPeriod: number, slowPeriod: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const fast = ema(closes, fastPeriod);
    const mid = ema(closes, Math.max(midPeriod, fastPeriod + 1));
    const slow = ema(closes, Math.max(slowPeriod, midPeriod + 1));
    const out = createEmptyMask(bars.length);
    for (let i = 1; i < bars.length; i += 1) {
        const rising = fast[i] > fast[i - 1] && mid[i] > mid[i - 1] && slow[i] > slow[i - 1];
        const falling = fast[i] < fast[i - 1] && mid[i] < mid[i - 1] && slow[i] < slow[i - 1];
        out.long[i] = fast[i] > mid[i] && mid[i] > slow[i] && rising;
        out.short[i] = fast[i] < mid[i] && mid[i] < slow[i] && falling;
    }
    return out;
}

function evaluateRsiRegime(bars: CandleData[], period: number, level: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const values = computeRsi(closes, period);
    const shortThreshold = clampNumber(100 - level, 50, 1, 99);
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        out.long[i] = values[i] >= level;
        out.short[i] = values[i] <= shortThreshold;
    }
    return out;
}

function evaluateRsiReclaim(bars: CandleData[], period: number, lower: number, upper: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const values = computeRsi(closes, period);
    const out = createEmptyMask(bars.length);
    for (let i = 1; i < bars.length; i += 1) {
        out.long[i] = values[i - 1] < lower && values[i] >= lower;
        out.short[i] = values[i - 1] > upper && values[i] <= upper;
    }
    return out;
}

function evaluateBreakout(bars: CandleData[], lookback: number, bufferPct: number): RuleMask {
    const out = createEmptyMask(bars.length);
    const buffer = bufferPct / 100;
    for (let i = lookback; i < bars.length; i += 1) {
        const priorHigh = maxHigh(bars, i - lookback, i);
        const priorLow = minLow(bars, i - lookback, i);
        out.long[i] = bars[i].c >= priorHigh * (1 + buffer);
        out.short[i] = bars[i].c <= priorLow * (1 - buffer);
    }
    return out;
}

function evaluateDonchianBreakout(bars: CandleData[], lookback: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const priorHigh = maxHigh(bars, i - lookback, i);
        const priorLow = minLow(bars, i - lookback, i);
        out.long[i] = bars[i].c > priorHigh;
        out.short[i] = bars[i].c < priorLow;
    }
    return out;
}

function evaluatePullback(bars: CandleData[], emaPeriod: number, tolerancePct: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const emaLine = ema(closes, emaPeriod);
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        const level = emaLine[i];
        const longTouch = Math.abs(bars[i].l - level) / level <= tolerance;
        const shortTouch = Math.abs(bars[i].h - level) / level <= tolerance;
        out.long[i] = longTouch && bars[i].c >= level;
        out.short[i] = shortTouch && bars[i].c <= level;
    }
    return out;
}

function evaluateCompression(bars: CandleData[], windowBars: number, rangePct: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = windowBars; i < bars.length; i += 1) {
        const high = maxHigh(bars, i - windowBars, i + 1);
        const low = minLow(bars, i - windowBars, i + 1);
        const normalizedRange = ((high - low) / Math.max(1e-9, bars[i].c)) * 100;
        const compressed = normalizedRange <= rangePct;
        out.long[i] = compressed;
        out.short[i] = compressed;
    }
    return out;
}

function evaluateBollingerSqueeze(
    bars: CandleData[],
    period: number,
    deviation: number,
    widthPct: number
): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const mid = sma(closes, period);
    const out = createEmptyMask(bars.length);
    for (let i = period - 1; i < bars.length; i += 1) {
        const slice = closes.slice(i - period + 1, i + 1);
        const std = standardDeviation(slice);
        const upper = mid[i] + std * deviation;
        const lower = mid[i] - std * deviation;
        const bandWidthPct = ((upper - lower) / Math.max(1e-9, mid[i])) * 100;
        const squeezed = bandWidthPct <= widthPct;
        out.long[i] = squeezed;
        out.short[i] = squeezed;
    }
    return out;
}

function evaluateFibBounce(
    bars: CandleData[],
    lookback: number,
    upperLevel: number,
    lowerLevel: number
): RuleMask {
    const out = createEmptyMask(bars.length);
    const highLevel = Math.min(upperLevel, lowerLevel);
    const lowLevel = Math.max(upperLevel, lowerLevel);
    for (let i = lookback; i < bars.length; i += 1) {
        const start = i - lookback;
        const swingLow = minLow(bars, start, i + 1);
        const swingHigh = maxHigh(bars, start, i + 1);
        const range = Math.max(1e-9, swingHigh - swingLow);

        const longZoneTop = swingHigh - range * highLevel;
        const longZoneBottom = swingHigh - range * lowLevel;
        const shortZoneBottom = swingLow + range * highLevel;
        const shortZoneTop = swingLow + range * lowLevel;

        const inLongZone = bars[i].l <= longZoneTop && bars[i].l >= longZoneBottom;
        const inShortZone = bars[i].h >= shortZoneBottom && bars[i].h <= shortZoneTop;
        out.long[i] = inLongZone && bars[i].c > bars[i].o && bars[i].c >= longZoneTop;
        out.short[i] = inShortZone && bars[i].c < bars[i].o && bars[i].c <= shortZoneBottom;
    }
    return out;
}

function evaluateSupportHold(bars: CandleData[], lookback: number, tolerancePct: number): RuleMask {
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const support = minLow(bars, i - lookback, i);
        const resistance = maxHigh(bars, i - lookback, i);
        out.long[i] = Math.abs(bars[i].l - support) / support <= tolerance && bars[i].c > support && bars[i].c > bars[i].o;
        out.short[i] = Math.abs(bars[i].h - resistance) / resistance <= tolerance && bars[i].c < resistance && bars[i].c < bars[i].o;
    }
    return out;
}

function evaluateSrFlipRetest(bars: CandleData[], lookback: number, tolerancePct: number): RuleMask {
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = lookback + 1; i < bars.length; i += 1) {
        const resistance = maxHigh(bars, i - lookback - 1, i - 1);
        const support = minLow(bars, i - lookback - 1, i - 1);
        const longBroken = bars[i - 1].c > resistance;
        const shortBroken = bars[i - 1].c < support;
        out.long[i] = longBroken && bars[i].l >= resistance * (1 - tolerance) && bars[i].l <= resistance * (1 + tolerance) && bars[i].c > resistance;
        out.short[i] = shortBroken && bars[i].h >= support * (1 - tolerance) && bars[i].h <= support * (1 + tolerance) && bars[i].c < support;
    }
    return out;
}

function evaluateAscendingTriangle(bars: CandleData[], windowBars: number, tolerancePct: number): RuleMask {
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = windowBars; i < bars.length; i += 1) {
        const start = i - windowBars;
        const split = start + Math.floor(windowBars / 2);
        const firstHigh = maxHigh(bars, start, split);
        const secondHigh = maxHigh(bars, split, i);
        const firstLow = minLow(bars, start, split);
        const secondLow = minLow(bars, split, i);

        const resistanceFlat = Math.abs(secondHigh - firstHigh) / Math.max(1e-9, firstHigh) <= tolerance;
        const supportFlat = Math.abs(secondLow - firstLow) / Math.max(1e-9, firstLow) <= tolerance;
        out.long[i] = resistanceFlat && secondLow > firstLow && bars[i].c > Math.max(firstHigh, secondHigh);
        out.short[i] = supportFlat && secondHigh < firstHigh && bars[i].c < Math.min(firstLow, secondLow);
    }
    return out;
}

function evaluateDoubleBottom(bars: CandleData[], windowBars: number, tolerancePct: number): RuleMask {
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = windowBars; i < bars.length; i += 1) {
        const start = i - windowBars;
        const firstLowInfo = findLowestBar(bars, start, start + Math.floor(windowBars * 0.45));
        const secondLowInfo = findLowestBar(bars, start + Math.floor(windowBars * 0.55), i);
        const firstHighInfo = findHighestBar(bars, start, start + Math.floor(windowBars * 0.45));
        const secondHighInfo = findHighestBar(bars, start + Math.floor(windowBars * 0.55), i);
        const necklineHigh = maxHigh(bars, firstLowInfo.index, secondLowInfo.index + 1);
        const necklineLow = minLow(bars, firstHighInfo.index, secondHighInfo.index + 1);

        const lowsAligned = Math.abs(firstLowInfo.value - secondLowInfo.value) / Math.max(1e-9, firstLowInfo.value) <= tolerance;
        const highsAligned = Math.abs(firstHighInfo.value - secondHighInfo.value) / Math.max(1e-9, firstHighInfo.value) <= tolerance;

        out.long[i] = lowsAligned && secondLowInfo.index > firstLowInfo.index && bars[i].c > necklineHigh;
        out.short[i] = highsAligned && secondHighInfo.index > firstHighInfo.index && bars[i].c < necklineLow;
    }
    return out;
}

function evaluateBullFlag(
    bars: CandleData[],
    impulseBars: number,
    pullbackBars: number,
    minMovePct: number
): RuleMask {
    const out = createEmptyMask(bars.length);
    const totalBars = impulseBars + pullbackBars;
    for (let i = totalBars; i < bars.length; i += 1) {
        const impulseStart = i - totalBars;
        const impulseEnd = i - pullbackBars;
        const impulseMovePct = ((bars[impulseEnd].c - bars[impulseStart].c) / bars[impulseStart].c) * 100;
        const pullbackHigh = maxHigh(bars, impulseEnd, i);
        const pullbackLow = minLow(bars, impulseEnd, i);
        const pullbackSlope = bars[i - 1].c - bars[impulseEnd].c;

        const shortImpulseMovePct = ((bars[impulseStart].c - bars[impulseEnd].c) / bars[impulseStart].c) * 100;
        const shortPullbackSlope = bars[i - 1].c - bars[impulseEnd].c;

        out.long[i] = impulseMovePct >= minMovePct
            && pullbackSlope < 0
            && bars[i].c > pullbackHigh
            && pullbackLow > bars[impulseStart].c;

        out.short[i] = shortImpulseMovePct >= minMovePct
            && shortPullbackSlope > 0
            && bars[i].c < pullbackLow
            && pullbackHigh < bars[impulseStart].c;
    }
    return out;
}

function evaluateRectangleBreakout(bars: CandleData[], windowBars: number, rangePct: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = windowBars; i < bars.length; i += 1) {
        const priorHigh = maxHigh(bars, i - windowBars, i);
        const priorLow = minLow(bars, i - windowBars, i);
        const normalizedRange = ((priorHigh - priorLow) / Math.max(1e-9, bars[i - 1].c)) * 100;
        const baseReady = normalizedRange <= rangePct;
        out.long[i] = baseReady && bars[i].c > priorHigh;
        out.short[i] = baseReady && bars[i].c < priorLow;
    }
    return out;
}

function evaluateTrendSlope(bars: CandleData[], lookback: number, minMovePct: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const movePct = ((bars[i].c - bars[i - lookback].c) / Math.max(1e-9, bars[i - lookback].c)) * 100;
        out.long[i] = movePct >= minMovePct;
        out.short[i] = movePct <= -minMovePct;
    }
    return out;
}

function evaluateChannelTrend(bars: CandleData[], lookback: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = lookback; i < bars.length; i += 1) {
        const high = maxHigh(bars, i - lookback, i + 1);
        const low = minLow(bars, i - lookback, i + 1);
        const mid = low + (high - low) / 2;
        const olderLow = minLow(bars, i - lookback, i - Math.floor(lookback / 2));
        const newerLow = minLow(bars, i - Math.floor(lookback / 2), i + 1);
        const olderHigh = maxHigh(bars, i - lookback, i - Math.floor(lookback / 2));
        const newerHigh = maxHigh(bars, i - Math.floor(lookback / 2), i + 1);
        out.long[i] = bars[i].c > mid && newerLow > olderLow && newerHigh >= olderHigh;
        out.short[i] = bars[i].c < mid && newerHigh < olderHigh && newerLow <= olderLow;
    }
    return out;
}

function evaluateAdxDmiTrend(
    bars: CandleData[],
    period: number,
    trendThreshold: number,
    minDiSpread: number
): RuleMask {
    const tr = computeTrueRange(bars);
    const plusDm = new Array<number>(bars.length).fill(0);
    const minusDm = new Array<number>(bars.length).fill(0);
    for (let i = 1; i < bars.length; i += 1) {
        const upMove = bars[i].h - bars[i - 1].h;
        const downMove = bars[i - 1].l - bars[i].l;
        plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
        minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }

    const smoothedTr = wilderSmoothing(tr, period);
    const smoothedPlus = wilderSmoothing(plusDm, period);
    const smoothedMinus = wilderSmoothing(minusDm, period);
    const plusDi = new Array<number>(bars.length).fill(0);
    const minusDi = new Array<number>(bars.length).fill(0);
    const dx = new Array<number>(bars.length).fill(0);
    for (let i = period - 1; i < bars.length; i += 1) {
        if (smoothedTr[i] <= 0) continue;
        plusDi[i] = (smoothedPlus[i] / smoothedTr[i]) * 100;
        minusDi[i] = (smoothedMinus[i] / smoothedTr[i]) * 100;
        const totalDi = plusDi[i] + minusDi[i];
        dx[i] = totalDi === 0 ? 0 : (Math.abs(plusDi[i] - minusDi[i]) / totalDi) * 100;
    }

    const adx = smoothDirectionalIndex(dx, period);
    const out = createEmptyMask(bars.length);
    for (let i = (period * 2) - 2; i < bars.length; i += 1) {
        const longSpread = plusDi[i] - minusDi[i];
        const shortSpread = minusDi[i] - plusDi[i];
        const adxRising = i === 0 || adx[i] >= adx[i - 1];
        out.long[i] = adx[i] >= trendThreshold && longSpread >= minDiSpread && adxRising;
        out.short[i] = adx[i] >= trendThreshold && shortSpread >= minDiSpread && adxRising;
    }
    return out;
}

function evaluateAroonTrend(
    bars: CandleData[],
    period: number,
    strongLevel: number,
    weakLevel: number
): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = period - 1; i < bars.length; i += 1) {
        const start = i - period + 1;
        let highestIndex = start;
        let lowestIndex = start;
        for (let j = start; j <= i; j += 1) {
            if (bars[j].h >= bars[highestIndex].h) highestIndex = j;
            if (bars[j].l <= bars[lowestIndex].l) lowestIndex = j;
        }

        const daysSinceHigh = i - highestIndex;
        const daysSinceLow = i - lowestIndex;
        const aroonUp = ((period - daysSinceHigh) / period) * 100;
        const aroonDown = ((period - daysSinceLow) / period) * 100;
        out.long[i] = aroonUp >= strongLevel && aroonDown <= weakLevel && aroonUp > aroonDown;
        out.short[i] = aroonDown >= strongLevel && aroonUp <= weakLevel && aroonDown > aroonUp;
    }
    return out;
}

function evaluateIchimokuCloudTrend(
    bars: CandleData[],
    conversionPeriod: number,
    basePeriod: number,
    spanBPeriod: number,
    displacement: number
): RuleMask {
    const conversionLine = new Array<number>(bars.length).fill(0);
    const baseLine = new Array<number>(bars.length).fill(0);
    const leadingSpanARaw = new Array<number | null>(bars.length).fill(null);
    const leadingSpanBRaw = new Array<number | null>(bars.length).fill(null);

    for (let i = 0; i < bars.length; i += 1) {
        if (i >= conversionPeriod - 1) {
            conversionLine[i] = (
                maxHigh(bars, i - conversionPeriod + 1, i + 1)
                + minLow(bars, i - conversionPeriod + 1, i + 1)
            ) / 2;
        }
        if (i >= basePeriod - 1) {
            baseLine[i] = (
                maxHigh(bars, i - basePeriod + 1, i + 1)
                + minLow(bars, i - basePeriod + 1, i + 1)
            ) / 2;
        }
        if (conversionLine[i] && baseLine[i]) {
            leadingSpanARaw[i] = (conversionLine[i] + baseLine[i]) / 2;
        }
        if (i >= spanBPeriod - 1) {
            leadingSpanBRaw[i] = (
                maxHigh(bars, i - spanBPeriod + 1, i + 1)
                + minLow(bars, i - spanBPeriod + 1, i + 1)
            ) / 2;
        }
    }

    const out = createEmptyMask(bars.length);
    for (let i = displacement; i < bars.length; i += 1) {
        const cloudIndex = i - displacement;
        const spanA = leadingSpanARaw[cloudIndex];
        const spanB = leadingSpanBRaw[cloudIndex];
        if (spanA == null || spanB == null || conversionLine[i] === 0 || baseLine[i] === 0) continue;
        const cloudTop = Math.max(spanA, spanB);
        const cloudBottom = Math.min(spanA, spanB);
        out.long[i] = bars[i].c > cloudTop && spanA > spanB && conversionLine[i] > baseLine[i];
        out.short[i] = bars[i].c < cloudBottom && spanA < spanB && conversionLine[i] < baseLine[i];
    }
    return out;
}

function evaluateVortexTrend(
    bars: CandleData[],
    period: number,
    minSpread: number
): RuleMask {
    const tr = computeTrueRange(bars);
    const positiveVm = new Array<number>(bars.length).fill(0);
    const negativeVm = new Array<number>(bars.length).fill(0);
    for (let i = 1; i < bars.length; i += 1) {
        positiveVm[i] = Math.abs(bars[i].h - bars[i - 1].l);
        negativeVm[i] = Math.abs(bars[i].l - bars[i - 1].h);
    }

    const out = createEmptyMask(bars.length);
    for (let i = period; i < bars.length; i += 1) {
        const start = i - period + 1;
        const trSum = sumSlice(tr, start, i + 1);
        if (trSum <= 0) continue;
        const viPlus = sumSlice(positiveVm, start, i + 1) / trSum;
        const viMinus = sumSlice(negativeVm, start, i + 1) / trSum;
        out.long[i] = viPlus > viMinus && (viPlus - viMinus) >= minSpread;
        out.short[i] = viMinus > viPlus && (viMinus - viPlus) >= minSpread;
    }
    return out;
}

function evaluateSupertrendBias(
    bars: CandleData[],
    period: number,
    multiplier: number
): RuleMask {
    const atr = computeAtr(bars, period);
    const basicUpper = new Array<number>(bars.length).fill(0);
    const basicLower = new Array<number>(bars.length).fill(0);
    const finalUpper = new Array<number>(bars.length).fill(0);
    const finalLower = new Array<number>(bars.length).fill(0);
    const supertrend = new Array<number>(bars.length).fill(0);
    const out = createEmptyMask(bars.length);
    const start = period - 1;
    if (start >= bars.length) return out;

    for (let i = start; i < bars.length; i += 1) {
        const hl2 = (bars[i].h + bars[i].l) / 2;
        basicUpper[i] = hl2 + multiplier * atr[i];
        basicLower[i] = hl2 - multiplier * atr[i];
    }

    finalUpper[start] = basicUpper[start];
    finalLower[start] = basicLower[start];
    supertrend[start] = bars[start].c >= ((bars[start].h + bars[start].l) / 2) ? finalLower[start] : finalUpper[start];
    out.long[start] = bars[start].c > supertrend[start];
    out.short[start] = bars[start].c < supertrend[start];

    for (let i = start + 1; i < bars.length; i += 1) {
        const previousClose = bars[i - 1].c;
        finalUpper[i] = basicUpper[i] < finalUpper[i - 1] || previousClose > finalUpper[i - 1]
            ? basicUpper[i]
            : finalUpper[i - 1];
        finalLower[i] = basicLower[i] > finalLower[i - 1] || previousClose < finalLower[i - 1]
            ? basicLower[i]
            : finalLower[i - 1];

        if (supertrend[i - 1] === finalUpper[i - 1]) {
            supertrend[i] = bars[i].c > finalUpper[i] ? finalLower[i] : finalUpper[i];
        } else {
            supertrend[i] = bars[i].c < finalLower[i] ? finalUpper[i] : finalLower[i];
        }

        out.long[i] = supertrend[i] === finalLower[i] && bars[i].c > supertrend[i];
        out.short[i] = supertrend[i] === finalUpper[i] && bars[i].c < supertrend[i];
    }
    return out;
}

function evaluatePsarTrend(
    bars: CandleData[],
    step: number,
    maxStep: number
): RuleMask {
    const out = createEmptyMask(bars.length);
    if (bars.length < 2) return out;

    const highs = bars.map((bar) => bar.h);
    const lows = bars.map((bar) => bar.l);
    const closes = bars.map((bar) => bar.c);
    const sar = new Array<number>(bars.length).fill(0);

    let uptrend = closes[1] >= closes[0];
    let accelerationFactor = step;
    let extremePoint = uptrend ? highs[0] : lows[0];
    sar[0] = uptrend ? lows[0] : highs[0];
    out.long[0] = uptrend && closes[0] > sar[0];
    out.short[0] = !uptrend && closes[0] < sar[0];

    for (let i = 1; i < bars.length; i += 1) {
        let currentSar = sar[i - 1] + accelerationFactor * (extremePoint - sar[i - 1]);
        if (uptrend) {
            currentSar = Math.min(currentSar, lows[i - 1], i > 1 ? lows[i - 2] : lows[i - 1]);
            if (lows[i] < currentSar) {
                uptrend = false;
                currentSar = extremePoint;
                extremePoint = lows[i];
                accelerationFactor = step;
            } else if (highs[i] > extremePoint) {
                extremePoint = highs[i];
                accelerationFactor = Math.min(maxStep, accelerationFactor + step);
            }
        } else {
            currentSar = Math.max(currentSar, highs[i - 1], i > 1 ? highs[i - 2] : highs[i - 1]);
            if (highs[i] > currentSar) {
                uptrend = true;
                currentSar = extremePoint;
                extremePoint = highs[i];
                accelerationFactor = step;
            } else if (lows[i] < extremePoint) {
                extremePoint = lows[i];
                accelerationFactor = Math.min(maxStep, accelerationFactor + step);
            }
        }

        sar[i] = currentSar;
        out.long[i] = uptrend && closes[i] > sar[i];
        out.short[i] = !uptrend && closes[i] < sar[i];
    }
    return out;
}

function evaluateMacdZeroBias(
    bars: CandleData[],
    fast: number,
    slow: number,
    signal: number
): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const safeFast = Math.min(fast, Math.max(2, slow - 1));
    const safeSlow = Math.max(slow, safeFast + 1);
    const fastLine = ema(closes, safeFast);
    const slowLine = ema(closes, safeSlow);
    const macdLine = closes.map((_, index) => fastLine[index] - slowLine[index]);
    const signalLine = ema(macdLine, signal);
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        out.long[i] = macdLine[i] > 0 && signalLine[i] > 0 && macdLine[i] >= signalLine[i];
        out.short[i] = macdLine[i] < 0 && signalLine[i] < 0 && macdLine[i] <= signalLine[i];
    }
    return out;
}

function evaluateMacdCross(bars: CandleData[], fast: number, slow: number, signal: number): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const safeFast = Math.min(fast, Math.max(2, slow - 1));
    const safeSlow = Math.max(slow, safeFast + 1);
    const fastLine = ema(closes, safeFast);
    const slowLine = ema(closes, safeSlow);
    const macdLine = closes.map((_, index) => fastLine[index] - slowLine[index]);
    const signalLine = ema(macdLine, signal);
    const out = createEmptyMask(bars.length);
    for (let i = 1; i < bars.length; i += 1) {
        out.long[i] = macdLine[i - 1] < signalLine[i - 1] && macdLine[i] >= signalLine[i];
        out.short[i] = macdLine[i - 1] > signalLine[i - 1] && macdLine[i] <= signalLine[i];
    }
    return out;
}

function evaluateRetest(bars: CandleData[], windowBars: number, tolerancePct: number): RuleMask {
    const tolerance = tolerancePct / 100;
    const out = createEmptyMask(bars.length);
    for (let i = windowBars; i < bars.length; i += 1) {
        const resistance = maxHigh(bars, i - windowBars, i);
        const support = minLow(bars, i - windowBars, i);
        out.long[i] = bars[i].l >= resistance * (1 - tolerance) && bars[i].l <= resistance * (1 + tolerance) && bars[i].c >= resistance;
        out.short[i] = bars[i].h >= support * (1 - tolerance) && bars[i].h <= support * (1 + tolerance) && bars[i].c <= support;
    }
    return out;
}

function evaluateVolumeConfirm(bars: CandleData[], factor: number, lookback: number): RuleMask {
    const volume = bars.map((bar) => bar.v);
    const averages = sma(volume, lookback);
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        const confirmed = averages[i] > 0 && volume[i] >= averages[i] * factor;
        out.long[i] = confirmed;
        out.short[i] = confirmed;
    }
    return out;
}

function evaluateVwapReclaim(bars: CandleData[]): RuleMask {
    const out = createEmptyMask(bars.length);
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;
    let currentDayKey = '';

    for (let i = 0; i < bars.length; i += 1) {
        const dayKey = formatDayKey(bars[i].t);
        if (dayKey !== currentDayKey) {
            currentDayKey = dayKey;
            cumulativePriceVolume = 0;
            cumulativeVolume = 0;
        }

        const typicalPrice = (bars[i].h + bars[i].l + bars[i].c) / 3;
        cumulativePriceVolume += typicalPrice * bars[i].v;
        cumulativeVolume += bars[i].v;
        const vwap = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : bars[i].c;

        out.long[i] = bars[i].l <= vwap && bars[i].c > vwap && bars[i].c > bars[i].o;
        out.short[i] = bars[i].h >= vwap && bars[i].c < vwap && bars[i].c < bars[i].o;
    }
    return out;
}

function evaluateMicroBreakout(bars: CandleData[], pivotBars: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = pivotBars; i < bars.length; i += 1) {
        const priorHigh = maxHigh(bars, i - pivotBars, i);
        const priorLow = minLow(bars, i - pivotBars, i);
        out.long[i] = bars[i].c > priorHigh;
        out.short[i] = bars[i].c < priorLow;
    }
    return out;
}

function evaluateInsideBreakout(bars: CandleData[]): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = 2; i < bars.length; i += 1) {
        const mother = bars[i - 2];
        const inside = bars[i - 1];
        const isInside = inside.h <= mother.h && inside.l >= mother.l;
        if (!isInside) continue;
        out.long[i] = bars[i].c > mother.h;
        out.short[i] = bars[i].c < mother.l;
    }
    return out;
}

function evaluateReversalCandle(bars: CandleData[], bodyPctThreshold: number): RuleMask {
    const out = createEmptyMask(bars.length);
    for (let i = 0; i < bars.length; i += 1) {
        const range = Math.max(1e-9, bars[i].h - bars[i].l);
        const bodyPct = (Math.abs(bars[i].c - bars[i].o) / range) * 100;
        const bullishClose = (bars[i].c - bars[i].l) / range >= 0.7;
        const bearishClose = (bars[i].h - bars[i].c) / range >= 0.7;
        out.long[i] = bars[i].c > bars[i].o && bodyPct >= bodyPctThreshold && bullishClose;
        out.short[i] = bars[i].c < bars[i].o && bodyPct >= bodyPctThreshold && bearishClose;
    }
    return out;
}

function evaluateStochRsiCross(
    bars: CandleData[],
    rsiPeriod: number,
    stochPeriod: number,
    signalPeriod: number,
    oversold: number,
    overbought: number
): RuleMask {
    const closes = bars.map((bar) => bar.c);
    const rsi = computeRsi(closes, rsiPeriod);
    const k = new Array<number>(bars.length).fill(0);
    for (let i = stochPeriod - 1; i < bars.length; i += 1) {
        const window = rsi.slice(i - stochPeriod + 1, i + 1);
        const minValue = Math.min(...window);
        const maxValue = Math.max(...window);
        k[i] = maxValue === minValue ? 0 : ((rsi[i] - minValue) / (maxValue - minValue)) * 100;
    }
    const d = sma(k, signalPeriod);
    const out = createEmptyMask(bars.length);
    for (let i = 1; i < bars.length; i += 1) {
        out.long[i] = k[i - 1] < d[i - 1] && k[i] >= d[i] && k[i - 1] <= oversold;
        out.short[i] = k[i - 1] > d[i - 1] && k[i] <= d[i] && k[i - 1] >= overbought;
    }
    return out;
}

function simulateTrades(
    symbol: string,
    blueprint: BacktestBlueprintInput,
    evaluations: Record<StageKey, StageEvaluation>,
    coreStartTime: number,
    activeStageKeys: StageKey[],
    executionStage: StageKey
): CandidateTrade[] {
    const executionBars = evaluations[executionStage].bars;
    const trades: CandidateTrade[] = [];
    const cursors: Record<StageKey, number> = { trend: -1, setup: -1, trigger: -1 };
    let openTrade: OpenTrade | null = null;
    let previousExecutionLong = false;
    let previousExecutionShort = false;

    for (let index = 0; index < executionBars.length; index += 1) {
        const bar = executionBars[index];
        if (bar.t < coreStartTime) {
            previousExecutionLong = Boolean(evaluations[executionStage].states[index]?.longPass);
            previousExecutionShort = Boolean(evaluations[executionStage].states[index]?.shortPass);
            continue;
        }

        if (openTrade) {
            const closedTrade = maybeCloseTrade(symbol, openTrade, bar, index, blueprint.risk.maxBars);
            if (closedTrade) {
                trades.push(closedTrade);
                openTrade = null;
                previousExecutionLong = Boolean(evaluations[executionStage].states[index]?.longPass);
                previousExecutionShort = Boolean(evaluations[executionStage].states[index]?.shortPass);
                continue;
            }
        }

        if (openTrade) {
            previousExecutionLong = Boolean(evaluations[executionStage].states[index]?.longPass);
            previousExecutionShort = Boolean(evaluations[executionStage].states[index]?.shortPass);
            continue;
        }

        const snapshots = collectSnapshots(evaluations, bar.t, cursors);
        const longDecision = buildDirectionDecision(blueprint, 'long', snapshots, activeStageKeys, executionStage);
        const shortDecision = buildDirectionDecision(blueprint, 'short', snapshots, activeStageKeys, executionStage);

        const candidates: DirectionDecision[] = [];
        if (longDecision.eligible && !previousExecutionLong) candidates.push(longDecision);
        if (shortDecision.eligible && !previousExecutionShort) candidates.push(shortDecision);

        const selected = pickCandidate(candidates);
        if (selected) {
            const stopPrice = selected.direction === 'long'
                ? bar.c * (1 - blueprint.risk.stopPct / 100)
                : bar.c * (1 + blueprint.risk.stopPct / 100);
            const targetPrice = selected.direction === 'long'
                ? bar.c * (1 + blueprint.risk.targetPct / 100)
                : bar.c * (1 - blueprint.risk.targetPct / 100);
            openTrade = {
                id: `bt_${String(trades.length + 1).padStart(4, '0')}`,
                side: selected.direction,
                entryIndex: index,
                entryTime: bar.t,
                entryPrice: bar.c,
                stopPrice,
                targetPrice,
                snapshots: selected.snapshots,
                score: selected.score,
            };
        }

        previousExecutionLong = Boolean(evaluations[executionStage].states[index]?.longPass);
        previousExecutionShort = Boolean(evaluations[executionStage].states[index]?.shortPass);
    }

    if (openTrade) {
        const lastBar = executionBars[executionBars.length - 1];
        trades.push(finalizeTrade(symbol, openTrade, lastBar, executionBars.length - 1, 'end_of_data', lastBar.c));
    }

    return trades;
}

function maybeCloseTrade(
    symbol: string,
    trade: OpenTrade,
    bar: CandleData,
    currentIndex: number,
    maxBars: number
): CandidateTrade | null {
    if (trade.side === 'long') {
        if (bar.l <= trade.stopPrice) {
            return finalizeTrade(symbol, trade, bar, currentIndex, 'stop', trade.stopPrice);
        }
        if (bar.h >= trade.targetPrice) {
            return finalizeTrade(symbol, trade, bar, currentIndex, 'target', trade.targetPrice);
        }
    } else {
        if (bar.h >= trade.stopPrice) {
            return finalizeTrade(symbol, trade, bar, currentIndex, 'stop', trade.stopPrice);
        }
        if (bar.l <= trade.targetPrice) {
            return finalizeTrade(symbol, trade, bar, currentIndex, 'target', trade.targetPrice);
        }
    }

    if (currentIndex - trade.entryIndex >= maxBars) {
        return finalizeTrade(symbol, trade, bar, currentIndex, 'timeout', bar.c);
    }

    return null;
}

function finalizeTrade(
    symbol: string,
    trade: OpenTrade,
    bar: CandleData,
    currentIndex: number,
    exitReason: CandidateTrade['exitReason'],
    exitPrice: number
): CandidateTrade {
    const pnlPct = trade.side === 'long'
        ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;

    return {
        id: trade.id,
        symbol,
        side: trade.side,
        entryTime: trade.entryTime,
        exitTime: bar.t,
        entryPrice: roundNumber(trade.entryPrice, 4),
        exitPrice: roundNumber(exitPrice, 4),
        pnlPct: roundNumber(pnlPct, 2),
        barsHeld: Math.max(1, currentIndex - trade.entryIndex),
        exitReason,
        score: trade.score,
        stages: trade.snapshots,
    };
}

function collectSnapshots(
    evaluations: Record<StageKey, StageEvaluation>,
    time: number,
    cursors: Record<StageKey, number>
): Record<StageKey, StageState | null> {
    return {
        trend: lookupState(evaluations.trend, time, cursors, 'trend'),
        setup: lookupState(evaluations.setup, time, cursors, 'setup'),
        trigger: lookupState(evaluations.trigger, time, cursors, 'trigger'),
    };
}

function lookupState(
    evaluation: StageEvaluation,
    time: number,
    cursors: Record<StageKey, number>,
    stageKey: StageKey
): StageState | null {
    let cursor = cursors[stageKey];
    while (cursor + 1 < evaluation.states.length && evaluation.states[cursor + 1].time <= time) {
        cursor += 1;
    }
    cursors[stageKey] = cursor;
    return cursor >= 0 ? evaluation.states[cursor] : null;
}

function buildDirectionDecision(
    blueprint: BacktestBlueprintInput,
    direction: Direction,
    snapshots: Record<StageKey, StageState | null>,
    activeStageKeys: StageKey[],
    executionStage: StageKey
): DirectionDecision {
    const resultSnapshots = {} as Record<StageKey, BacktestStageSnapshot>;
    let passedStages = 0;
    let score = 0;
    let requiredStagesOk = true;

    for (const stageKey of ['trend', 'setup', 'trigger'] as StageKey[]) {
        const stage = blueprint.stages[stageKey];
        const active = activeStageKeys.includes(stageKey);
        const snapshot = snapshots[stageKey];
        const passed = active && (direction === 'long' ? Boolean(snapshot?.longPass) : Boolean(snapshot?.shortPass));
        const requiredHits = direction === 'long'
            ? (snapshot?.longRequiredHits || [])
            : (snapshot?.shortRequiredHits || []);
        const optionalHits = direction === 'long'
            ? (snapshot?.longOptionalHits || [])
            : (snapshot?.shortOptionalHits || []);

        resultSnapshots[stageKey] = {
            timeframe: stage.timeframe,
            passed,
            requiredHits,
            optionalHits,
        };

        if (!active) continue;
        if (passed) passedStages += 1;
        if (stage.required && !passed) requiredStagesOk = false;
        score += requiredHits.length * 2 + optionalHits.length;
    }

    const directionAllowed = blueprint.direction === 'both' || blueprint.direction === direction;
    const executionPassed = resultSnapshots[executionStage].passed;
    const eligible = directionAllowed
        && executionPassed
        && requiredStagesOk
        && passedStages >= Math.min(blueprint.stageThreshold, activeStageKeys.length);

    return {
        direction,
        eligible,
        passedStages,
        score: passedStages * 100 + score,
        snapshots: resultSnapshots,
    };
}

function pickCandidate(candidates: DirectionDecision[]): DirectionDecision | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    if (sorted[0].score === sorted[1].score) {
        return null;
    }
    return sorted[0];
}

function buildStageStats(
    blueprint: BacktestBlueprintInput,
    evaluations: Record<StageKey, StageEvaluation>,
    coreStartTime: number,
    activeStageKeys: StageKey[]
): Record<StageKey, BacktestStageStats> {
    return Object.fromEntries(
        (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
            const evaluation = evaluations[stageKey];
            const coreStates = evaluation.states.filter((state) => state.time >= coreStartTime);
            const passedBars = coreStates.filter((state) => state.longPass || state.shortPass).length;
            const passRate = coreStates.length > 0 ? passedBars / coreStates.length : 0;
            const stage = blueprint.stages[stageKey];
            const active = activeStageKeys.includes(stageKey);

            return [stageKey, {
                timeframe: stage.timeframe,
                passRate: active ? passRate : 0,
                passedBars: active ? passedBars : 0,
                coreBars: active ? coreStates.length : 0,
                ruleCount: stage.rules.length,
                requiredRuleCount: stage.rules.filter((rule) => rule.required).length,
            }];
        })
    ) as Record<StageKey, BacktestStageStats>;
}

function buildSingleSymbolSummary(trades: CandidateTrade[]): SingleSymbolSummary {
    if (trades.length === 0) {
        return {
            totalTrades: 0,
            winRate: 0,
            totalPnlPct: 0,
            averagePnlPct: 0,
            profitFactor: 0,
            maxDrawdownPct: 0,
            averageBarsHeld: 0,
        };
    }

    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnlPct, 0);
    const wins = trades.filter((trade) => trade.pnlPct > 0);
    const losses = trades.filter((trade) => trade.pnlPct < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlPct, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnlPct, 0));
    const averageBarsHeld = trades.reduce((sum, trade) => sum + trade.barsHeld, 0) / trades.length;

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const trade of trades) {
        equity += trade.pnlPct;
        peak = Math.max(peak, equity);
        maxDrawdown = Math.min(maxDrawdown, equity - peak);
    }

    return {
        totalTrades: trades.length,
        winRate: wins.length / trades.length,
        totalPnlPct: roundNumber(totalPnl, 2),
        averagePnlPct: roundNumber(totalPnl / trades.length, 2),
        profitFactor: roundNumber(grossLoss > 0 ? grossProfit / grossLoss : grossProfit, 2),
        maxDrawdownPct: roundNumber(maxDrawdown, 2),
        averageBarsHeld: roundNumber(averageBarsHeld, 1),
    };
}

function simulatePortfolio(
    symbolRuns: SingleSymbolRunResult[],
    portfolio: PortfolioConfig
): {
    executedTrades: BacktestTrade[];
    skippedTrades: BacktestSkippedTrade[];
    maxConcurrentPositions: number;
} {
    const candidateTrades = symbolRuns
        .flatMap((run) => run.trades)
        .sort((left, right) => left.entryTime - right.entryTime || right.score - left.score || left.symbol.localeCompare(right.symbol));

    const executedTrades: BacktestTrade[] = [];
    const skippedTrades: BacktestSkippedTrade[] = [];
    const openPositions: ExecutedPosition[] = [];
    let cash = portfolio.initialCapital;
    let maxConcurrentPositions = 0;

    const releaseClosedPositions = (entryTime: number): void => {
        openPositions.sort((left, right) => left.trade.exitTime - right.trade.exitTime);
        while (openPositions.length > 0 && openPositions[0].trade.exitTime <= entryTime) {
            const position = openPositions.shift();
            if (!position) break;
            const grossPnlAmount = roundNumber((position.allocatedCapital * position.trade.pnlPct) / 100, 2);
            const exitNotional = Math.max(0, position.allocatedCapital + grossPnlAmount);
            const exitCommissionAmount = roundNumber(exitNotional * (portfolio.commissionPct / 100), 2);
            cash += position.allocatedCapital + grossPnlAmount - exitCommissionAmount;
            executedTrades.push({
                ...position.trade,
                quantity: roundNumber(position.allocatedCapital / Math.max(1e-9, position.trade.entryPrice), 6),
                allocatedCapital: roundNumber(position.allocatedCapital, 2),
                grossPnlAmount,
                netPnlAmount: roundNumber(grossPnlAmount - position.entryCommissionAmount - exitCommissionAmount, 2),
                entryCommissionAmount: roundNumber(position.entryCommissionAmount, 2),
                exitCommissionAmount,
                endingBalance: roundNumber(cash, 2),
            });
        }
    };

    for (const trade of candidateTrades) {
        releaseClosedPositions(trade.entryTime);

        const allocatedCapital = portfolio.positionSize;
        const entryCommissionAmount = roundNumber(allocatedCapital * (portfolio.commissionPct / 100), 2);
        const requiredCash = allocatedCapital + entryCommissionAmount;
        if (cash + 1e-9 < requiredCash) {
            skippedTrades.push({
                id: `${trade.id}_skipped`,
                symbol: trade.symbol,
                side: trade.side,
                entryTime: trade.entryTime,
                entryPrice: trade.entryPrice,
                requiredCash: roundNumber(requiredCash, 2),
                availableCash: roundNumber(cash, 2),
                score: trade.score,
                reason: 'insufficient_cash',
            });
            continue;
        }

        cash -= requiredCash;
        openPositions.push({
            trade,
            allocatedCapital,
            entryCommissionAmount,
        });
        maxConcurrentPositions = Math.max(maxConcurrentPositions, openPositions.length);
    }

    releaseClosedPositions(Number.POSITIVE_INFINITY);
    executedTrades.sort((left, right) => left.entryTime - right.entryTime || left.symbol.localeCompare(right.symbol));

    return {
        executedTrades,
        skippedTrades,
        maxConcurrentPositions,
    };
}

function buildPortfolioSummary(
    portfolioRun: {
        executedTrades: BacktestTrade[];
        skippedTrades: BacktestSkippedTrade[];
        maxConcurrentPositions: number;
    },
    portfolio: PortfolioConfig
): BacktestRunSummary {
    const trades = portfolioRun.executedTrades;
    if (trades.length === 0) {
        return {
            totalTrades: 0,
            winRate: 0,
            totalPnlPct: 0,
            averagePnlPct: 0,
            profitFactor: 0,
            maxDrawdownPct: 0,
            averageBarsHeld: 0,
            initialCapital: roundNumber(portfolio.initialCapital, 2),
            finalBalance: roundNumber(portfolio.initialCapital, 2),
            totalGrossPnlAmount: 0,
            totalNetPnlAmount: 0,
            totalCommissionAmount: 0,
            skippedTrades: portfolioRun.skippedTrades.length,
            maxConcurrentPositions: portfolioRun.maxConcurrentPositions,
        };
    }

    const totalGrossPnlAmount = trades.reduce((sum, trade) => sum + trade.grossPnlAmount, 0);
    const totalCommissionAmount = trades.reduce((sum, trade) => sum + trade.entryCommissionAmount + trade.exitCommissionAmount, 0);
    const finalBalance = portfolio.initialCapital + trades.reduce((sum, trade) => sum + trade.netPnlAmount, 0);
    const wins = trades.filter((trade) => trade.netPnlAmount > 0);
    const losses = trades.filter((trade) => trade.netPnlAmount < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnlAmount, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnlAmount, 0));
    const averageBarsHeld = trades.reduce((sum, trade) => sum + trade.barsHeld, 0) / trades.length;
    const totalPnlPct = ((finalBalance - portfolio.initialCapital) / Math.max(1e-9, portfolio.initialCapital)) * 100;

    let peakBalance = portfolio.initialCapital;
    let maxDrawdownPct = 0;
    for (const trade of trades) {
        peakBalance = Math.max(peakBalance, trade.endingBalance);
        const drawdownPct = ((trade.endingBalance - peakBalance) / Math.max(1e-9, peakBalance)) * 100;
        maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);
    }

    return {
        totalTrades: trades.length,
        winRate: wins.length / trades.length,
        totalPnlPct: roundNumber(totalPnlPct, 2),
        averagePnlPct: roundNumber(trades.reduce((sum, trade) => sum + trade.pnlPct, 0) / trades.length, 2),
        profitFactor: roundNumber(grossLoss > 0 ? grossProfit / grossLoss : grossProfit, 2),
        maxDrawdownPct: roundNumber(maxDrawdownPct, 2),
        averageBarsHeld: roundNumber(averageBarsHeld, 1),
        initialCapital: roundNumber(portfolio.initialCapital, 2),
        finalBalance: roundNumber(finalBalance, 2),
        totalGrossPnlAmount: roundNumber(totalGrossPnlAmount, 2),
        totalNetPnlAmount: roundNumber(finalBalance - portfolio.initialCapital, 2),
        totalCommissionAmount: roundNumber(totalCommissionAmount, 2),
        skippedTrades: portfolioRun.skippedTrades.length,
        maxConcurrentPositions: portfolioRun.maxConcurrentPositions,
    };
}

function aggregateStageStats(
    blueprint: BacktestBlueprintInput,
    symbolRuns: SingleSymbolRunResult[]
): Record<StageKey, BacktestStageStats> {
    return Object.fromEntries(
        (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
            const passedBars = symbolRuns.reduce((sum, run) => sum + run.stageStats[stageKey].passedBars, 0);
            const coreBars = symbolRuns.reduce((sum, run) => sum + run.stageStats[stageKey].coreBars, 0);
            const passRate = coreBars > 0 ? passedBars / coreBars : 0;
            return [stageKey, {
                timeframe: blueprint.stages[stageKey].timeframe,
                passRate,
                passedBars,
                coreBars,
                ruleCount: blueprint.stages[stageKey].rules.length,
                requiredRuleCount: blueprint.stages[stageKey].rules.filter((rule) => rule.required).length,
            }];
        })
    ) as Record<StageKey, BacktestStageStats>;
}

function aggregateRange(symbolRuns: SingleSymbolRunResult[]): { from: number; to: number } {
    const from = Math.min(...symbolRuns.map((run) => run.range.from));
    const to = Math.max(...symbolRuns.map((run) => run.range.to));
    return { from, to };
}

function aggregateDataPoints(symbolRuns: SingleSymbolRunResult[]): Record<StageKey, number> {
    return {
        trend: symbolRuns.reduce((sum, run) => sum + run.dataPoints.trend, 0),
        setup: symbolRuns.reduce((sum, run) => sum + run.dataPoints.setup, 0),
        trigger: symbolRuns.reduce((sum, run) => sum + run.dataPoints.trigger, 0),
    };
}

function buildSymbolStats(
    portfolioRun: {
        executedTrades: BacktestTrade[];
        skippedTrades: BacktestSkippedTrade[];
    },
    symbols: string[],
    initialCapital: number
): BacktestSymbolStats[] {
    return symbols.map((symbol) => {
        const executed = portfolioRun.executedTrades.filter((trade) => trade.symbol === symbol);
        const skipped = portfolioRun.skippedTrades.filter((trade) => trade.symbol === symbol);
        const netPnlAmount = executed.reduce((sum, trade) => sum + trade.netPnlAmount, 0);
        const commission = executed.reduce((sum, trade) => sum + trade.entryCommissionAmount + trade.exitCommissionAmount, 0);
        const wins = executed.filter((trade) => trade.netPnlAmount > 0).length;
        return {
            symbol,
            totalTrades: executed.length,
            skippedTrades: skipped.length,
            winRate: executed.length > 0 ? wins / executed.length : 0,
            returnPct: initialCapital > 0 ? roundNumber((netPnlAmount / initialCapital) * 100, 2) : 0,
            netPnlAmount: roundNumber(netPnlAmount, 2),
            totalCommissionAmount: roundNumber(commission, 2),
        };
    }).sort((left, right) => right.netPnlAmount - left.netPnlAmount);
}

function deriveRange(bars: CandleData[], coreStartTime: number): { from: number; to: number } {
    const coreBars = bars.filter((bar) => bar.t >= coreStartTime);
    if (coreBars.length === 0) {
        const fallback = bars[bars.length - 1]?.t || Math.floor(Date.now() / 1000);
        return { from: fallback, to: fallback };
    }
    return {
        from: coreBars[0].t,
        to: coreBars[coreBars.length - 1].t,
    };
}

function buildNotes(
    blueprint: BacktestBlueprintInput,
    summary: SingleSymbolSummary,
    stageStats: Record<StageKey, BacktestStageStats>,
    testWindowDays: number,
    activeStageKeys: StageKey[],
    executionStage: StageKey
): string[] {
    const notes = [
        `${testWindowDays} gunluk pencere tarandi. Girisler aktif stage'ler icindeki en alt timeframe olan ${executionStage} stage'inin yeni aktif oldugu barda uretiliyor.`,
        'Price action kurallari local heuristics ile calisiyor; bu ilk surumde broker-grade execution modeli yok.',
        `Risk modeli sabit: %${roundNumber(blueprint.risk.stopPct, 1)} stop, %${roundNumber(blueprint.risk.targetPct, 1)} target, ${blueprint.risk.maxBars} bar timeout.`,
        `Aktif stage'ler: ${activeStageKeys.join(', ')}. Kural olmayan stage'ler devre disi sayildi.`,
    ];

    if (summary.totalTrades === 0) {
        const tightestStage = activeStageKeys
            .map((stageKey) => ({ stageKey, rate: stageStats[stageKey].passRate }))
            .sort((a, b) => a.rate - b.rate)[0];
        notes.push(`${tightestStage.stageKey} stage'i en dar bogaz olarak gorunuyor. Pass rate su an %${roundNumber(stageStats[tightestStage.stageKey].passRate * 100, 1)}.`);
    }

    return notes;
}

function buildPortfolioNotes(
    summary: BacktestRunSummary,
    stageStats: Record<StageKey, BacktestStageStats>,
    testWindowDays: number,
    activeStageKeys: StageKey[],
    executionStage: StageKey,
    symbolRuns: SingleSymbolRunResult[],
    portfolio: PortfolioConfig,
    symbolErrors: Array<{ symbol: string; message: string }>
): string[] {
    const notes = [
        `${symbolRuns.length} sembol ${testWindowDays} gunluk pencerede tarandi. Girisler aktif stage'ler icindeki en alt timeframe olan ${executionStage} stage'inin yeni aktif oldugu barda uretildi.`,
        `Portfoy modeli: baslangic bakiye ${formatMoney(portfolio.initialCapital)} TL, islem basi ${formatMoney(portfolio.positionSize)} TL, komisyon %${roundNumber(portfolio.commissionPct, 3)} her giris ve cikista dusuldu.`,
        `Aktif stage'ler: ${activeStageKeys.join(', ')}. Kural olmayan stage'ler devre disi sayildi.`,
        `Son bakiye ${formatMoney(summary.finalBalance)} TL. Toplam komisyon ${formatMoney(summary.totalCommissionAmount)} TL, yetersiz bakiye nedeniyle ${summary.skippedTrades} trade atlandi.`,
    ];

    if (summary.totalTrades === 0) {
        const tightestStage = activeStageKeys
            .map((stageKey) => ({ stageKey, rate: stageStats[stageKey].passRate }))
            .sort((a, b) => a.rate - b.rate)[0];
        notes.push(`${tightestStage.stageKey} stage'i en dar bogaz olarak gorunuyor. Agregede pass rate %${roundNumber(stageStats[tightestStage.stageKey].passRate * 100, 1)}.`);
    }

    if (symbolErrors.length > 0) {
        notes.push(`${symbolErrors.length} sembol veri hatasi nedeniyle kosuya dahil edilmedi.`);
    }

    return notes;
}

function deriveWarmupBars(blueprint: BacktestBlueprintInput): number {
    let maxParam = 50;
    for (const stageKey of ['trend', 'setup', 'trigger'] as StageKey[]) {
        for (const rule of blueprint.stages[stageKey].rules) {
            for (const value of Object.values(rule.params)) {
                if (Number.isFinite(value)) {
                    maxParam = Math.max(maxParam, Math.ceil(value));
                }
            }
        }
    }
    return Math.max(160, maxParam * 3);
}

function getActiveStageKeys(blueprint: BacktestBlueprintInput): StageKey[] {
    return (['trend', 'setup', 'trigger'] as StageKey[]).filter((stageKey) => blueprint.stages[stageKey].rules.length > 0);
}

function getExecutionStageKey(blueprint: BacktestBlueprintInput, activeStageKeys: StageKey[]): StageKey {
    return [...activeStageKeys].sort((left, right) => {
        const leftSec = getTimeframeSeconds(blueprint.stages[left].timeframe);
        const rightSec = getTimeframeSeconds(blueprint.stages[right].timeframe);
        return leftSec - rightSec;
    })[0];
}

function normalizeSymbols(blueprint: BacktestBlueprintInput): string[] {
    const rawSymbols = [
        ...((blueprint.symbols || []).map((symbol) => String(symbol).trim().toUpperCase())),
        String(blueprint.symbol || '').trim().toUpperCase(),
    ].filter((symbol) => symbol.length > 0);

    const unique = Array.from(new Set(rawSymbols));
    if (unique.length === 0) {
        throw new Error('En az bir sembol secmelisin.');
    }
    return unique;
}

function normalizePortfolioConfig(input?: BacktestBlueprintInput['portfolio']): PortfolioConfig {
    const initialCapital = clampNumber(input?.initialCapital, 100000, 1000, 1_000_000_000);
    const positionSize = clampNumber(input?.positionSize, Math.min(initialCapital, 10000), 100, initialCapital);
    const commissionPct = clampNumber(input?.commissionPct, 0.1, 0, 10);
    return {
        initialCapital: roundNumber(initialCapital, 2),
        positionSize: roundNumber(positionSize, 2),
        commissionPct: roundNumber(commissionPct, 4),
    };
}

async function runWithConcurrency<TInput, TOutput>(
    items: TInput[],
    concurrency: number,
    worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
    const results = new Array<TOutput>(items.length);
    let cursor = 0;

    const runNext = async (): Promise<void> => {
        const current = cursor;
        cursor += 1;
        if (current >= items.length) return;
        results[current] = await worker(items[current]);
        await runNext();
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
    await Promise.all(workers);
    return results;
}

function createEmptyMask(length: number): RuleMask {
    return {
        long: new Array<boolean>(length).fill(false),
        short: new Array<boolean>(length).fill(false),
    };
}

function ema(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const out = new Array<number>(values.length);
    out[0] = values[0];
    for (let i = 1; i < values.length; i += 1) {
        out[i] = values[i] * k + out[i - 1] * (1 - k);
    }
    return out;
}

function computeTrueRange(bars: CandleData[]): number[] {
    const out = new Array<number>(bars.length).fill(0);
    for (let i = 0; i < bars.length; i += 1) {
        if (i === 0) {
            out[i] = bars[i].h - bars[i].l;
            continue;
        }
        const previousClose = bars[i - 1].c;
        out[i] = Math.max(
            bars[i].h - bars[i].l,
            Math.abs(bars[i].h - previousClose),
            Math.abs(bars[i].l - previousClose)
        );
    }
    return out;
}

function wilderSmoothing(values: number[], period: number): number[] {
    const out = new Array<number>(values.length).fill(0);
    if (values.length < period) return out;

    let runningTotal = 0;
    for (let i = 0; i < period; i += 1) {
        runningTotal += values[i];
    }
    out[period - 1] = runningTotal;
    for (let i = period; i < values.length; i += 1) {
        out[i] = out[i - 1] - (out[i - 1] / period) + values[i];
    }
    return out;
}

function smoothDirectionalIndex(values: number[], period: number): number[] {
    const out = new Array<number>(values.length).fill(0);
    const start = (period * 2) - 2;
    if (values.length <= start) return out;

    let initialTotal = 0;
    for (let i = period - 1; i <= start; i += 1) {
        initialTotal += values[i];
    }
    out[start] = initialTotal / period;
    for (let i = start + 1; i < values.length; i += 1) {
        out[i] = ((out[i - 1] * (period - 1)) + values[i]) / period;
    }
    return out;
}

function computeAtr(bars: CandleData[], period: number): number[] {
    const tr = computeTrueRange(bars);
    const smoothed = wilderSmoothing(tr, period);
    const out = new Array<number>(bars.length).fill(0);
    for (let i = period - 1; i < bars.length; i += 1) {
        out[i] = smoothed[i] / period;
    }
    return out;
}

function computeRsi(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const out = new Array<number>(values.length).fill(0);
    const alpha = 1 / period;
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < values.length; i += 1) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        if (i === 1) {
            avgGain = gain;
            avgLoss = loss;
        } else {
            avgGain = gain * alpha + avgGain * (1 - alpha);
            avgLoss = loss * alpha + avgLoss * (1 - alpha);
        }

        if (avgLoss === 0) {
            out[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            out[i] = 100 - (100 / (1 + rs));
        }
    }

    return out;
}

function sma(values: number[], period: number): number[] {
    const out = new Array<number>(values.length).fill(0);
    let rolling = 0;
    for (let i = 0; i < values.length; i += 1) {
        rolling += values[i];
        if (i >= period) rolling -= values[i - period];
        out[i] = i >= period - 1 ? rolling / period : 0;
    }
    return out;
}

function standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function findLowestBar(bars: CandleData[], start: number, end: number): { index: number; value: number } {
    let bestIndex = start;
    let bestValue = Number.POSITIVE_INFINITY;
    for (let i = start; i < end; i += 1) {
        if (bars[i].l < bestValue) {
            bestValue = bars[i].l;
            bestIndex = i;
        }
    }
    return { index: bestIndex, value: bestValue };
}

function findHighestBar(bars: CandleData[], start: number, end: number): { index: number; value: number } {
    let bestIndex = start;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let i = start; i < end; i += 1) {
        if (bars[i].h > bestValue) {
            bestValue = bars[i].h;
            bestIndex = i;
        }
    }
    return { index: bestIndex, value: bestValue };
}

function maxHigh(bars: CandleData[], start: number, end: number): number {
    let high = Number.NEGATIVE_INFINITY;
    for (let i = start; i < end; i += 1) {
        high = Math.max(high, bars[i].h);
    }
    return high;
}

function minLow(bars: CandleData[], start: number, end: number): number {
    let low = Number.POSITIVE_INFINITY;
    for (let i = start; i < end; i += 1) {
        low = Math.min(low, bars[i].l);
    }
    return low;
}

function sumSlice(values: number[], start: number, end: number): number {
    let total = 0;
    for (let i = start; i < end; i += 1) {
        total += values[i];
    }
    return total;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.min(max, Math.max(min, numberValue));
}

function roundNumber(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatMoney(value: number): string {
    return roundNumber(value, 2).toFixed(2);
}

function normalizeUnixSeconds(value: unknown): number {
    if (typeof value === 'number') {
        return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
    }
    if (typeof value === 'string') {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
            return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
        }
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return Math.floor(parsed / 1000);
        }
    }
    return Math.floor(Date.now() / 1000);
}

function formatDayKey(unixSeconds: number): string {
    const date = new Date(unixSeconds * 1000);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getTimeframeSeconds(tf: TimeFrame): number {
    const map: Record<TimeFrame, number> = {
        '1m': 60,
        '3m': 180,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '2h': 7200,
        '4h': 14400,
        '6h': 21600,
        '12h': 43200,
        '1d': 86400,
        '3d': 259200,
        '1w': 604800,
        '1M': 2592000,
    };
    return map[tf];
}
