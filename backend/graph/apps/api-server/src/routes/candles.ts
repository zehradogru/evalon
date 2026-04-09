import type { FastifyPluginAsync } from 'fastify';
import type { CandleData, CandleResponse } from '@graph/shared-types';

/**
 * Candle routes — GET /candles
 * Primary source: backtest API (/v1/prices)
 * Fallback: local mock data
 */
export const candleRoutes: FastifyPluginAsync = async (app) => {
    const backtestBase = (process.env.BACKTEST_API_BASE || 'http://localhost:8000/v1').replace(/\/$/, '');
    const allowSyntheticFallback = process.env.ALLOW_SYNTHETIC_CANDLES_FALLBACK === '1';

    app.get('/candles', async (request, reply) => {
        const { symbol, tf, from, to, limit, cursor: _cursor } = request.query as {
            symbol: string;
            tf: string;
            from?: string;
            to?: string;
            limit?: string;
            cursor?: string;
        };

        if (!symbol || !tf) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol and tf are required',
                requestId: request.id,
            });
        }

        const barCount = Math.min(Math.max(Number(limit) || 500, 1), 100000);
        const tfSeconds = getTimeframeSeconds(tf);
        const fromTs = Number(from);
        const toTs = Number(to);
        const hasFrom = from !== undefined && Number.isFinite(fromTs);
        const hasTo = to !== undefined && Number.isFinite(toTs);

        const backtestUrl = new URL(`${backtestBase}/prices`);
        backtestUrl.searchParams.set('ticker', symbol);
        backtestUrl.searchParams.set('timeframe', tf);

        // Upstream query semantics:
        // Oracle side uses ORDER BY ascending + FETCH FIRST.
        // For pagination (to-only), send BOTH start+end with an over-scan window, then tail on server.
        const isPaginationQuery = hasTo && !hasFrom;
        let paginationStartSec: number | null = null;
        let upstreamLimit = barCount;

        if (hasFrom) {
            backtestUrl.searchParams.set('start', new Date(fromTs * 1000).toISOString());
        }
        if (hasTo) {
            const endSec = isPaginationQuery ? Math.max(0, toTs - tfSeconds) : toTs;
            backtestUrl.searchParams.set('end', new Date(endSec * 1000).toISOString());

            if (isPaginationQuery) {
                const scanMultiplier = getPaginationScanMultiplier(tf);
                const scanWindowSec = Math.max(tfSeconds, barCount * tfSeconds * scanMultiplier);
                paginationStartSec = Math.max(0, endSec - scanWindowSec);
                backtestUrl.searchParams.set('start', new Date(paginationStartSec * 1000).toISOString());
                upstreamLimit = Math.min(200000, Math.max(barCount, barCount * scanMultiplier));
            }
        }
        backtestUrl.searchParams.set('limit', String(upstreamLimit));

        try {
            const upstreamRes = await fetch(backtestUrl.toString());
            if (upstreamRes.ok) {
                const upstream = await upstreamRes.json() as {
                    data?: Array<{ t: string | number; o: number; h: number; l: number; c: number; v: number }>;
                };

                const data: CandleData[] = (upstream.data || [])
                    .map((bar) => ({
                        t: normalizeUnixSeconds(bar.t),
                        o: Number(bar.o),
                        h: Number(bar.h),
                        l: Number(bar.l),
                        c: Number(bar.c),
                        v: Number(bar.v),
                    }))
                    .filter((bar) => Number.isFinite(bar.t))
                    .sort((a, b) => a.t - b.t);

                const sliced = isPaginationQuery ? data.slice(-barCount) : data;

                if (sliced.length > 0) {
                    const hasMore = isPaginationQuery
                        ? sliced.length === barCount && (paginationStartSec === null || sliced[0].t > paginationStartSec)
                        : data.length === upstreamLimit;

                    const response: CandleResponse = {
                        symbol,
                        tf: tf as any,
                        data: sliced,
                        nextCursor: `cur_${sliced[0].t}`,
                        hasMore,
                    };

                    return reply.send(response);
                }

                app.log.warn(
                    { symbol, tf, upstreamUrl: backtestUrl.toString() },
                    'Backtest prices upstream returned empty data; falling back to mock candles'
                );
            } else {
                const detail = await upstreamRes.text();
                app.log.warn(
                    { status: upstreamRes.status, detail, symbol, tf, upstreamUrl: backtestUrl.toString() },
                    'Backtest prices upstream returned non-OK'
                );
            }
        } catch (err) {
            app.log.warn({ err, symbol, tf, upstreamUrl: backtestUrl.toString() }, 'Backtest prices upstream request failed');
        }

        if (!allowSyntheticFallback) {
            return reply.status(502).send({
                error: 'UPSTREAM_UNAVAILABLE',
                message: 'Backtest prices upstream unavailable or returned empty data.',
                requestId: request.id,
            });
        }

        const toTime = Number(to) || Math.floor(Date.now() / 1000);
        // Generate mock candle data
        const data: CandleData[] = [];
        let price = 37000 + Math.random() * 3000;

        for (let i = barCount - 1; i >= 0; i -= 1) {
            const t = toTime - i * tfSeconds;
            const change = (Math.random() - 0.48) * price * 0.015;
            const open = price;
            const close = open + change;
            const high = Math.max(open, close) + Math.random() * price * 0.005;
            const low = Math.min(open, close) - Math.random() * price * 0.005;
            const volume = Math.random() * 1000 + 100;

            data.push({
                t: t,
                o: Number(open.toFixed(2)),
                h: Number(high.toFixed(2)),
                l: Number(low.toFixed(2)),
                c: Number(close.toFixed(2)),
                v: Number(volume.toFixed(2)),
            });

            price = close;
        }

        const response: CandleResponse = {
            symbol,
            tf: tf as any,
            data,
            nextCursor: data.length > 0 ? `cur_${data[0].t}` : null,
            hasMore: false,
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

function getTimeframeSeconds(tf: string): number {
    const map: Record<string, number> = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
        '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
    };
    return map[tf] || 3600;
}

function getPaginationScanMultiplier(tf: string): number {
    const map: Record<string, number> = {
        '1m': 6,
        '3m': 8,
        '5m': 8,
        '15m': 10,
        '30m': 12,
        '1h': 14,
        '2h': 16,
        '4h': 18,
        '6h': 20,
        '12h': 24,
        '1d': 30,
        '3d': 36,
        '1w': 48,
        '1M': 72,
    };
    return map[tf] || 12;
}
