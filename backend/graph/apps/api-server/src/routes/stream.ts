import type { FastifyPluginAsync } from 'fastify';
import type { StreamSubscription, StreamEvent } from '@graph/shared-types';
import { getBacktestApiBase } from '../config/backtest-api.js';

/**
 * WebSocket stream route — WS /stream
 * Broadcasts mock real-time bar updates to subscribed clients.
 */
export const streamRoutes: FastifyPluginAsync = async (app) => {
    const backtestBase = getBacktestApiBase();

    app.get('/stream', { websocket: true }, (socket, _req) => {
        let subscription: { symbol: string; tf: string } | null = null;
        let updateInterval: ReturnType<typeof setInterval> | null = null;
        let lastPrice = 37000 + Math.random() * 3000;
        let currentBar: { t: number; o: number; h: number; l: number; c: number; v: number } | null = null;

        app.log.info('[WS] client connected');

        socket.on('message', async (raw: Buffer) => {
            try {
                const msg = JSON.parse(raw.toString());

                if (msg.action === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                if (msg.action === 'subscribe') {
                    const sub = msg as StreamSubscription;
                    subscription = { symbol: sub.symbol, tf: sub.tf };
                    app.log.info(`[WS] subscribed: ${sub.symbol} ${sub.tf}`);

                    // Seed stream around latest real close to avoid price-scale spikes.
                    const latestClose = await fetchLatestClose(backtestBase, sub.symbol, sub.tf);
                    if (latestClose !== null) {
                        lastPrice = latestClose;
                    }

                    // Start sending mock updates every 1-3 seconds
                    if (updateInterval) clearInterval(updateInterval);

                    // Initialize current bar
                    const now = Math.floor(Date.now() / 1000);
                    const tfSeconds = getTimeframeSeconds(sub.tf);
                    const barStart = now - (now % tfSeconds);

                    currentBar = {
                        t: barStart,
                        o: lastPrice,
                        h: lastPrice,
                        l: lastPrice,
                        c: lastPrice,
                        v: 0,
                    };

                    updateInterval = setInterval(() => {
                        if (!subscription || !currentBar) return;

                        const now = Math.floor(Date.now() / 1000);
                        const tfSec = getTimeframeSeconds(subscription.tf);
                        const expectedBarStart = now - (now % tfSec);

                        // Check if we need a new bar
                        if (expectedBarStart > currentBar.t) {
                            // Emit new_bar
                            lastPrice = currentBar.c;
                            currentBar = {
                                t: expectedBarStart,
                                o: lastPrice,
                                h: lastPrice,
                                l: lastPrice,
                                c: lastPrice,
                                v: 0,
                            };

                            const newBarEvent: StreamEvent = {
                                type: 'new_bar',
                                symbol: subscription.symbol,
                                tf: subscription.tf as any,
                                data: { ...currentBar },
                            };
                            socket.send(JSON.stringify(newBarEvent));
                        } else {
                            // Update current bar
                            const change = (Math.random() - 0.48) * lastPrice * 0.002;
                            currentBar.c = Number((currentBar.c + change).toFixed(2));
                            currentBar.h = Math.max(currentBar.h, currentBar.c);
                            currentBar.l = Math.min(currentBar.l, currentBar.c);
                            currentBar.v += Number((Math.random() * 10).toFixed(2));

                            const updateEvent: StreamEvent = {
                                type: 'bar_update',
                                symbol: subscription.symbol,
                                tf: subscription.tf as any,
                                data: { ...currentBar },
                            };
                            socket.send(JSON.stringify(updateEvent));
                        }
                    }, 1500 + Math.random() * 1500);
                }

                if (msg.action === 'unsubscribe') {
                    subscription = null;
                    if (updateInterval) {
                        clearInterval(updateInterval);
                        updateInterval = null;
                    }
                }
            } catch (err) {
                app.log.error('[WS] message parse error:', err as any);
            }
        });

        socket.on('close', () => {
            app.log.info('[WS] client disconnected');
            if (updateInterval) clearInterval(updateInterval);
        });
    });
};

function getTimeframeSeconds(tf: string): number {
    const map: Record<string, number> = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
        '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
    };
    return map[tf] || 3600;
}

async function fetchLatestClose(
    backtestBase: string,
    symbol: string,
    tf: string
): Promise<number | null> {
    try {
        const url = new URL(`${backtestBase}/prices`);
        url.searchParams.set('ticker', symbol);
        url.searchParams.set('timeframe', tf);
        url.searchParams.set('limit', '1');

        const res = await fetch(url.toString());
        if (!res.ok) return null;

        const data = await res.json() as {
            data?: Array<{ c?: number }>;
        };
        const close = data.data?.[0]?.c;
        if (typeof close !== 'number' || !Number.isFinite(close)) {
            return null;
        }
        return close;
    } catch {
        return null;
    }
}
