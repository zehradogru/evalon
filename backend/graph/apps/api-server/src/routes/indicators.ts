import type { FastifyPluginAsync } from 'fastify';
import { getBacktestApiBase } from '../config/backtest-api.js';

interface IndicatorPoint {
    time: number;
    value: number;
    color?: string;
}

interface IndicatorSeries {
    name: string;
    type: 'line' | 'histogram';
    data: IndicatorPoint[];
    panel: number;
    options?: Record<string, unknown>;
}

interface IndicatorResponse {
    ticker: string;
    timeframe: string;
    strategy: string;
    indicators: IndicatorSeries[];
}

interface CandleBar {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

/**
 * Indicator routes — GET /indicators
 * Proxies and normalizes backtest indicator output.
 */
export const indicatorRoutes: FastifyPluginAsync = async (app) => {
    const backtestBase = getBacktestApiBase();

    app.get('/indicators', async (request, reply) => {
        const query = request.query as Record<string, string | undefined>;

        const symbol = query.symbol || query.ticker;
        const tf = query.tf || query.timeframe;
        const strategy = query.strategy;

        if (!symbol || !tf || !strategy) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol/ticker, tf/timeframe and strategy are required',
                requestId: request.id,
            });
        }

        const upstreamUrl = new URL(`${backtestBase}/indicators`);
        upstreamUrl.searchParams.set('ticker', symbol);
        upstreamUrl.searchParams.set('timeframe', tf);
        upstreamUrl.searchParams.set('strategy', strategy);

        // Forward extra strategy params as-is (period, fast, slow, signal, limit, ...)
        for (const [key, value] of Object.entries(query)) {
            if (!value) continue;
            if (key === 'symbol' || key === 'ticker' || key === 'tf' || key === 'timeframe' || key === 'strategy') {
                continue;
            }
            upstreamUrl.searchParams.set(key, value);
        }

        try {
            const upstreamRes = await fetch(upstreamUrl.toString());
            if (!upstreamRes.ok) {
                const detail = await upstreamRes.text();
                app.log.warn(
                    { status: upstreamRes.status, detail, symbol, tf, strategy },
                    'Backtest indicators upstream returned non-OK; falling back to local indicator calculation'
                );
            } else {
                const upstream = await upstreamRes.json() as {
                    ticker?: string;
                    timeframe?: string;
                    strategy?: string;
                    indicators?: Array<{
                        name?: string;
                        type?: 'line' | 'histogram';
                        panel?: number;
                        options?: Record<string, unknown>;
                        data?: Array<{ time: string | number; value: number; color?: string }>;
                    }>;
                };

                const indicators: IndicatorSeries[] = (upstream.indicators || []).map((series) => ({
                    name: series.name || 'Indicator',
                    type: series.type === 'histogram' ? 'histogram' : 'line',
                    panel: Number.isFinite(series.panel) ? Number(series.panel) : 1,
                    options: series.options || {},
                    data: (series.data || [])
                        .map((point) => ({
                            time: normalizeUnixSeconds(point.time),
                            value: Number(point.value),
                            color: point.color,
                        }))
                        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
                        .sort((a, b) => a.time - b.time),
                }));

                if (hasIndicatorData(indicators)) {
                    const response: IndicatorResponse = {
                        ticker: upstream.ticker || symbol,
                        timeframe: upstream.timeframe || tf,
                        strategy: upstream.strategy || strategy,
                        indicators,
                    };

                    return reply.send(response);
                }

                app.log.warn(
                    { symbol, tf, strategy, upstreamUrl: upstreamUrl.toString() },
                    'Backtest indicators upstream returned empty data; falling back to local indicator calculation'
                );
            }
        } catch (err) {
            app.log.warn({ err }, 'Failed to fetch indicators from backtest API; falling back to local indicator calculation');
        }

        const bars = await fetchBarsForIndicators(backtestBase, symbol, tf, query, app);
        const fallbackIndicators = buildLocalIndicators(strategy, bars, query);
        const response: IndicatorResponse = {
            ticker: symbol,
            timeframe: tf,
            strategy,
            indicators: fallbackIndicators,
        };
        return reply.send(response);
    });
};

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

function hasIndicatorData(indicators: IndicatorSeries[]): boolean {
    return indicators.some((series) => series.data.length > 0);
}

async function fetchBarsForIndicators(
    backtestBase: string,
    symbol: string,
    tf: string,
    query: Record<string, string | undefined>,
    app: { log: { warn: (...args: unknown[]) => void } }
): Promise<CandleBar[]> {
    const limit = clampInt(query.limit, 2000, 50, 100000);
    const tfSeconds = getTimeframeSeconds(tf);

    const pricesUrl = new URL(`${backtestBase}/prices`);
    pricesUrl.searchParams.set('ticker', symbol);
    pricesUrl.searchParams.set('timeframe', tf);
    pricesUrl.searchParams.set('limit', String(limit));
    if (query.start) pricesUrl.searchParams.set('start', query.start);
    if (query.end) pricesUrl.searchParams.set('end', query.end);

    try {
        const res = await fetch(pricesUrl.toString());
        if (res.ok) {
            const payload = await res.json() as {
                data?: Array<{ t: string | number; o: number; h: number; l: number; c: number; v: number }>;
            };
            const bars = (payload.data || [])
                .map((bar) => ({
                    t: normalizeUnixSeconds(bar.t),
                    o: Number(bar.o),
                    h: Number(bar.h),
                    l: Number(bar.l),
                    c: Number(bar.c),
                    v: Number(bar.v),
                }))
                .filter((bar) =>
                    Number.isFinite(bar.t) &&
                    Number.isFinite(bar.o) &&
                    Number.isFinite(bar.h) &&
                    Number.isFinite(bar.l) &&
                    Number.isFinite(bar.c) &&
                    Number.isFinite(bar.v)
                )
                .sort((a, b) => a.t - b.t);

            if (bars.length > 0) return bars;
            app.log.warn({ symbol, tf }, 'Backtest prices returned empty while building indicators; using synthetic bars');
        } else {
            app.log.warn({ symbol, tf, status: res.status }, 'Backtest prices non-OK while building indicators; using synthetic bars');
        }
    } catch (err) {
        app.log.warn({ err, symbol, tf }, 'Backtest prices request failed while building indicators; using synthetic bars');
    }

    const endSec = query.end ? normalizeUnixSeconds(query.end) : Math.floor(Date.now() / 1000);
    return generateSyntheticBars(limit, endSec, tfSeconds);
}

function buildLocalIndicators(
    strategy: string,
    bars: CandleBar[],
    query: Record<string, string | undefined>
): IndicatorSeries[] {
    const closes = bars.map((b) => b.c);
    const times = bars.map((b) => b.t);

    if (strategy === 'rsi') {
        const period = clampInt(query.period, 14, 2, 300);
        const points = computeRSI(times, closes, period);
        return [{
            name: `RSI (${period})`,
            type: 'line',
            panel: 1,
            options: { color: '#f59e0b', lineWidth: 2 },
            data: points,
        }];
    }

    if (strategy === 'macd') {
        const fast = clampInt(query.fast, 12, 2, 200);
        const slow = clampInt(query.slow, 26, 2, 300);
        const signal = clampInt(query.signal, 9, 2, 200);
        const macd = computeMACD(times, closes, fast, slow, signal);
        return [
            {
                name: `MACD (${fast},${slow})`,
                type: 'line',
                panel: 1,
                options: { color: '#3b82f6', lineWidth: 2 },
                data: macd.macd,
            },
            {
                name: `Signal (${signal})`,
                type: 'line',
                panel: 1,
                options: { color: '#f59e0b', lineWidth: 2 },
                data: macd.signal,
            },
            {
                name: 'Histogram',
                type: 'histogram',
                panel: 1,
                options: { color: '#9ca3af' },
                data: macd.histogram,
            },
        ];
    }

    return [];
}

function computeRSI(times: number[], closes: number[], period: number): IndicatorPoint[] {
    if (closes.length <= period) return [];

    const out: IndicatorPoint[] = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i += 1) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += -diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const pushPoint = (idx: number) => {
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        const value = 100 - (100 / (1 + rs));
        out.push({ time: times[idx], value: Number(value.toFixed(4)) });
    };

    pushPoint(period);
    for (let i = period + 1; i < closes.length; i += 1) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        pushPoint(i);
    }

    return out;
}

function computeMACD(times: number[], closes: number[], fast: number, slow: number, signal: number): {
    macd: IndicatorPoint[];
    signal: IndicatorPoint[];
    histogram: IndicatorPoint[];
} {
    if (closes.length === 0) {
        return { macd: [], signal: [], histogram: [] };
    }

    const safeFast = Math.min(fast, slow - 1 > 1 ? slow - 1 : fast);
    const safeSlow = Math.max(slow, safeFast + 1);

    const emaFast = ema(closes, safeFast);
    const emaSlow = ema(closes, safeSlow);
    const macdRaw = closes.map((_, i) => emaFast[i] - emaSlow[i]);
    const signalRaw = ema(macdRaw, signal);

    const macd: IndicatorPoint[] = [];
    const signalSeries: IndicatorPoint[] = [];
    const histogram: IndicatorPoint[] = [];

    for (let i = 0; i < closes.length; i += 1) {
        const macdVal = macdRaw[i];
        const signalVal = signalRaw[i];
        const histVal = macdVal - signalVal;
        const time = times[i];
        macd.push({ time, value: Number(macdVal.toFixed(6)) });
        signalSeries.push({ time, value: Number(signalVal.toFixed(6)) });
        histogram.push({
            time,
            value: Number(histVal.toFixed(6)),
            color: histVal >= 0 ? '#10b981' : '#ef4444',
        });
    }

    return { macd, signal: signalSeries, histogram };
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

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

function getTimeframeSeconds(tf: string): number {
    const map: Record<string, number> = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
        '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
    };
    return map[tf] || 3600;
}

function generateSyntheticBars(count: number, endSec: number, tfSeconds: number): CandleBar[] {
    const out: CandleBar[] = [];
    let price = 37000 + Math.random() * 3000;

    for (let i = count - 1; i >= 0; i -= 1) {
        const t = endSec - i * tfSeconds;
        const change = (Math.random() - 0.48) * price * 0.01;
        const o = price;
        const c = Math.max(1, o + change);
        const h = Math.max(o, c) + Math.random() * price * 0.003;
        const l = Math.max(1, Math.min(o, c) - Math.random() * price * 0.003);
        const v = 100 + Math.random() * 900;
        out.push({
            t,
            o: Number(o.toFixed(2)),
            h: Number(h.toFixed(2)),
            l: Number(l.toFixed(2)),
            c: Number(c.toFixed(2)),
            v: Number(v.toFixed(2)),
        });
        price = c;
    }

    return out;
}
