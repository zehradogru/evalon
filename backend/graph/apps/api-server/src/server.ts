import Fastify from 'fastify';
import { createRequire } from 'node:module';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { candleRoutes } from './routes/candles.js';
import { indicatorRoutes } from './routes/indicators.js';
import { drawingRoutes } from './routes/drawings.js';
import { backtestRoutes } from './routes/backtests.js';
import { signalRoutes } from './routes/signals.js';
import { streamRoutes } from './routes/stream.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const require = createRequire(import.meta.url);

async function bootstrap() {
    const loggerOptions: any = { level: 'info' };
    try {
        require.resolve('pino-pretty');
        loggerOptions.transport = {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss' },
        };
    } catch {
        // pino-pretty is optional; use default JSON logs when not installed.
    }

    const app = Fastify({
        logger: loggerOptions,
    });

    // ─── Plugins ─────────────────────────────────────────────────
    await app.register(cors, {
        origin: true,
        credentials: true,
    });

    await app.register(websocket);

    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // ─── Routes ──────────────────────────────────────────────────
    await app.register(candleRoutes, { prefix: '/api/v1' });
    await app.register(indicatorRoutes, { prefix: '/api/v1' });
    await app.register(drawingRoutes, { prefix: '/api/v1' });
    await app.register(backtestRoutes, { prefix: '/api/v1' });
    await app.register(signalRoutes, { prefix: '/api/v1' });
    await app.register(streamRoutes, { prefix: '/api/v1' });

    // ─── Health Check ────────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

    // ─── Error Handler ───────────────────────────────────────────
    app.setErrorHandler((error: unknown, _request, reply) => {
        const err = error as any;
        app.log.error(error);
        reply.status(err.statusCode || 500).send({
            error: err.code || 'INTERNAL_ERROR',
            message: err.message,
            requestId: _request.id,
        });
    });

    // ─── Start ───────────────────────────────────────────────────
    try {
        await app.listen({ port: PORT, host: HOST });
        app.log.info(`🚀 API Server running on http://${HOST}:${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

bootstrap();
