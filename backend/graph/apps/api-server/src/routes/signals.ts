import type { FastifyPluginAsync } from 'fastify';
import type {
    SignalModel,
    SignalRunRequest,
    SignalRunResponse,
    StrategyCatalogResponse,
    StrategyDefinition,
} from '@graph/shared-types';
import * as crypto from 'crypto';

interface CandleBar {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

interface StrategyRunItem {
    id: string;
    params: Record<string, unknown>;
}

const STRATEGY_CATALOG: StrategyDefinition[] = [
    {
        id: 'rsi',
        label: 'RSI Strategy',
        params: [
            { key: 'period', label: 'Period', type: 'number', defaultValue: 14, min: 2, max: 300, step: 1 },
            { key: 'entryLevel', label: 'Entry Level', type: 'number', defaultValue: 30, min: 1, max: 99, step: 0.5 },
        ],
    },
    {
        id: 'macd',
        label: 'MACD Strategy',
        params: [
            { key: 'fast', label: 'Fast', type: 'number', defaultValue: 12, min: 2, max: 300, step: 1 },
            { key: 'slow', label: 'Slow', type: 'number', defaultValue: 26, min: 2, max: 400, step: 1 },
            { key: 'signal', label: 'Signal', type: 'number', defaultValue: 9, min: 2, max: 300, step: 1 },
        ],
    },
];

const KNOWN_STRATEGIES = new Set(STRATEGY_CATALOG.map((s) => s.id));

/**
 * Signal routes — POST /signals/run, GET /signals, GET /strategies/catalog
 * Supports multiple strategies and server-side combinator (AND/OR).
 */
export const signalRoutes: FastifyPluginAsync = async (app) => {
    const backtestBase = (process.env.BACKTEST_API_BASE || 'http://localhost:8000/v1').replace(/\/$/, '');

    app.get('/strategies/catalog', async (_request, reply) => {
        const response: StrategyCatalogResponse = {
            count: STRATEGY_CATALOG.length,
            strategies: STRATEGY_CATALOG,
        };
        return reply.send(response);
    });

    app.post('/signals/run', async (request, reply) => {
        const body = request.body as Partial<SignalRunRequest>;

        if (!body.symbol || !body.tf) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol and tf are required',
                requestId: request.id,
            });
        }

        const selectedStrategies = normalizeSelectedStrategies(body);
        if (selectedStrategies.length === 0) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'strategyId or strategies are required',
                requestId: request.id,
            });
        }

        const unknown = selectedStrategies.find((s) => !KNOWN_STRATEGIES.has(s.id));
        if (unknown) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: `Unknown strategy: ${unknown.id}`,
                requestId: request.id,
            });
        }

        const bars = await fetchBars(backtestBase, body.symbol, body.tf, body.range);
        if (bars.length === 0) {
            const emptyResponse: SignalRunResponse = {
                runId: `sigrun_${crypto.randomBytes(4).toString('hex')}`,
                strategyId: selectedStrategies.length === 1 ? selectedStrategies[0].id : 'combinator',
                signals: [],
                count: 0,
            };
            return reply.send(emptyResponse);
        }

        const combineMode = body.combine === 'or' ? 'or' : 'and';
        const strategyMasks = selectedStrategies.map((strategy) => computeStrategyMask(strategy, bars));
        const combinedMask = combineMasks(strategyMasks, combineMode);
        const signals = buildSignals(combinedMask, bars, selectedStrategies, combineMode);

        const response: SignalRunResponse = {
            runId: `sigrun_${crypto.randomBytes(4).toString('hex')}`,
            strategyId: selectedStrategies.length === 1 ? selectedStrategies[0].id : 'combinator',
            signals,
            count: signals.length,
        };

        return reply.send(response);
    });

    app.get('/signals', async (request, reply) => {
        const { symbol, tf } = request.query as {
            symbol: string;
            tf: string;
        };

        if (!symbol || !tf) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol and tf are required',
                requestId: request.id,
            });
        }

        return reply.send({ signals: [], count: 0 });
    });
};

function normalizeSelectedStrategies(body: Partial<SignalRunRequest>): StrategyRunItem[] {
    if (Array.isArray(body.strategies) && body.strategies.length > 0) {
        return body.strategies
            .map((item) => ({
                id: normalizeStrategyId(String(item.id || '')),
                params: item.params || {},
            }))
            .filter((item) => item.id.length > 0);
    }

    if (typeof body.strategyId === 'string' && body.strategyId.trim().length > 0) {
        return [{
            id: normalizeStrategyId(body.strategyId),
            params: body.params || {},
        }];
    }

    if (Array.isArray(body.strategyIds) && body.strategyIds.length > 0) {
        const fallbackParams = body.params || {};
        return body.strategyIds
            .map((id) => normalizeStrategyId(String(id || '')))
            .filter((id) => id.length > 0)
            .map((id, idx) => ({
                id,
                params: idx === 0 ? fallbackParams : {},
            }));
    }

    return [];
}

function normalizeStrategyId(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

async function fetchBars(
    backtestBase: string,
    symbol: string,
    tf: string,
    range?: { from: number; to: number }
): Promise<CandleBar[]> {
    const now = Math.floor(Date.now() / 1000);
    const tfSec = getTimeframeSeconds(tf);
    const from = Number.isFinite(range?.from) ? Number(range?.from) : Math.max(0, now - 90 * 86400);
    const to = Number.isFinite(range?.to) ? Number(range?.to) : now;
    const rawLimit = Math.ceil(Math.max(1, to - from) / tfSec) + 5;
    const limit = Math.min(200_000, Math.max(250, rawLimit));

    const url = new URL(`${backtestBase}/prices`);
    url.searchParams.set('ticker', symbol);
    url.searchParams.set('timeframe', tf);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('start', new Date(from * 1000).toISOString());
    url.searchParams.set('end', new Date(to * 1000).toISOString());

    try {
        const res = await fetch(url.toString());
        if (!res.ok) return [];
        const payload = await res.json() as {
            data?: Array<{ t: string | number; o: number; h: number; l: number; c: number; v: number }>;
        };

        return (payload.data || [])
            .map((bar) => ({
                t: normalizeUnixSeconds(bar.t),
                o: Number(bar.o),
                h: Number(bar.h),
                l: Number(bar.l),
                c: Number(bar.c),
                v: Number(bar.v),
            }))
            .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c))
            .sort((a, b) => a.t - b.t);
    } catch {
        return [];
    }
}

function computeStrategyMask(strategy: StrategyRunItem, bars: CandleBar[]): boolean[] {
    if (bars.length === 0) return [];

    switch (strategy.id) {
        case 'rsi':
            return computeRsiMask(strategy.params, bars);
        case 'macd':
            return computeMacdMask(strategy.params, bars);
        default:
            return new Array<boolean>(bars.length).fill(false);
    }
}

function computeRsiMask(params: Record<string, unknown>, bars: CandleBar[]): boolean[] {
    const closes = bars.map((bar) => bar.c);
    const period = clampInt(params.period, 14, 2, 300);
    const entryLevel = clampNumber(params.entryLevel ?? params.entry_level, 30, 1, 99);

    const rsi = computeRsi(closes, period);
    const out = new Array<boolean>(bars.length).fill(false);
    for (let i = 1; i < bars.length; i += 1) {
        out[i] = rsi[i - 1] < entryLevel && rsi[i] >= entryLevel;
    }
    return out;
}

function computeMacdMask(params: Record<string, unknown>, bars: CandleBar[]): boolean[] {
    const closes = bars.map((bar) => bar.c);
    const fast = clampInt(params.fast ?? params.fast_period, 12, 2, 300);
    const slow = clampInt(params.slow ?? params.slow_period, 26, 2, 400);
    const signal = clampInt(params.signal ?? params.signal_period, 9, 2, 300);

    const safeFast = Math.min(fast, Math.max(2, slow - 1));
    const safeSlow = Math.max(slow, safeFast + 1);
    const emaFast = ema(closes, safeFast);
    const emaSlow = ema(closes, safeSlow);
    const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
    const signalLine = ema(macdLine, signal);

    const out = new Array<boolean>(bars.length).fill(false);
    for (let i = 1; i < bars.length; i += 1) {
        out[i] = macdLine[i - 1] < signalLine[i - 1] && macdLine[i] >= signalLine[i];
    }
    return out;
}

function combineMasks(masks: boolean[][], mode: 'and' | 'or'): boolean[] {
    if (masks.length === 0) return [];
    if (masks.length === 1) return masks[0];

    const length = masks[0].length;
    const out = new Array<boolean>(length).fill(mode === 'and');

    for (let i = 0; i < length; i += 1) {
        if (mode === 'and') {
            let allTrue = true;
            for (const mask of masks) {
                allTrue = allTrue && Boolean(mask[i]);
                if (!allTrue) break;
            }
            out[i] = allTrue;
        } else {
            let anyTrue = false;
            for (const mask of masks) {
                anyTrue = anyTrue || Boolean(mask[i]);
                if (anyTrue) break;
            }
            out[i] = anyTrue;
        }
    }

    return out;
}

function buildSignals(
    mask: boolean[],
    bars: CandleBar[],
    strategies: StrategyRunItem[],
    combineMode: 'and' | 'or'
): SignalModel[] {
    const labels = strategies.map((s) => s.id.toUpperCase()).join('+');
    const label = strategies.length > 1
        ? `${combineMode.toUpperCase()} ${labels} BUY`
        : `${labels} BUY`;

    const signals: SignalModel[] = [];
    for (let i = 0; i < mask.length; i += 1) {
        if (!mask[i]) continue;
        const bar = bars[i];
        signals.push({
            id: `sig_${crypto.randomBytes(5).toString('hex')}`,
            time: bar.t,
            price: Number(bar.c.toFixed(4)),
            side: 'buy',
            label,
            confidence: strategies.length > 1 ? 0.8 : 0.7,
            meta: {
                combine: combineMode,
                strategies: strategies.map((s) => ({ id: s.id, params: s.params })),
            },
        });
    }
    return signals;
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

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function normalizeUnixSeconds(value: string | number): number {
    if (typeof value === 'number') {
        return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
    }
    const asNum = Number(value);
    if (!Number.isNaN(asNum)) {
        return asNum > 1e12 ? Math.floor(asNum / 1000) : Math.floor(asNum);
    }
    const parsedMs = Date.parse(value);
    return Number.isNaN(parsedMs) ? Math.floor(Date.now() / 1000) : Math.floor(parsedMs / 1000);
}

function getTimeframeSeconds(tf: string): number {
    const map: Record<string, number> = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
        '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
    };
    return map[tf] || 3600;
}
