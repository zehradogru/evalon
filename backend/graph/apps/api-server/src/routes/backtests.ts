import type { FastifyPluginAsync } from 'fastify';
import { getBacktestApiBase } from '../config/backtest-api.js';

export const backtestRoutes: FastifyPluginAsync = async (app) => {
    const backtestBase = getBacktestApiBase();

    app.get('/backtests/catalog/rules', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/backtests/catalog/rules`, request.id);
    });

    app.get('/backtests/catalog/presets', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/backtests/catalog/presets`, request.id);
    });

    app.post('/backtests/run', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/backtests/run`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.post('/backtests/start', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/backtests/start`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.get('/backtests/:runId/status', async (request, reply) => {
        const { runId } = request.params as { runId: string };
        return proxyJson(app, reply, `${backtestBase}/backtests/${runId}/status`, request.id);
    });

    app.get('/backtests/:runId/events', async (request, reply) => {
        const { runId } = request.params as { runId: string };
        const { page, limit } = request.query as { page?: string; limit?: string };
        const url = new URL(`${backtestBase}/backtests/${runId}/events`);
        if (page) url.searchParams.set('page', page);
        if (limit) url.searchParams.set('limit', limit);
        return proxyJson(app, reply, url.toString(), request.id);
    });

    app.get('/backtests/:runId/portfolio-curve', async (request, reply) => {
        const { runId } = request.params as { runId: string };
        return proxyJson(app, reply, `${backtestBase}/backtests/${runId}/portfolio-curve`, request.id);
    });

    app.get('/ai/tools', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/ai/tools`, request.id);
    });

    app.post('/ai/sessions', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/ai/sessions`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.get('/ai/sessions/:sessionId', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        return proxyJson(app, reply, `${backtestBase}/ai/sessions/${sessionId}`, request.id);
    });

    app.post('/ai/sessions/:sessionId/messages', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        return proxyJson(app, reply, `${backtestBase}/ai/sessions/${sessionId}/messages`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.get('/ai/assets', async (request, reply) => {
        const { userId } = request.query as { userId?: string };
        const url = new URL(`${backtestBase}/ai/assets`);
        if (userId) url.searchParams.set('userId', userId);
        return proxyJson(app, reply, url.toString(), request.id);
    });

    app.post('/ai/strategies', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/ai/strategies`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.post('/ai/rules', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/ai/rules`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });

    app.post('/ai/indicators', async (request, reply) => {
        return proxyJson(app, reply, `${backtestBase}/ai/indicators`, request.id, {
            method: 'POST',
            body: JSON.stringify(request.body || {}),
            headers: {
                'content-type': 'application/json',
            },
        });
    });
};

async function proxyJson(
    app: { log: { warn: (...args: unknown[]) => void } },
    reply: { status: (code: number) => { send: (payload: unknown) => unknown }; send: (payload: unknown) => unknown },
    url: string,
    requestId: string,
    init?: RequestInit
) {
    try {
        const response = await fetch(url, init);
        const text = await response.text();
        const payload = text ? safeJsonParse(text) : {};

        if (!response.ok) {
            return reply.status(response.status).send(
                payload || {
                    error: 'UPSTREAM_ERROR',
                    message: text.slice(0, 400),
                    requestId,
                }
            );
        }

        return reply.send(payload);
    } catch (error) {
        app.log.warn({ err: error, url }, 'Backtest API proxy failed');
        return reply.status(502).send({
            error: 'UPSTREAM_UNAVAILABLE',
            message: 'Backtest API unavailable.',
            requestId,
        });
    }
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return { raw: value };
    }
}
