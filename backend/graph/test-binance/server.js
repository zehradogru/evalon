const Fastify = require('fastify');
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const fs = require('fs');

const app = Fastify({ logger: true });

// Register plugins
app.register(cors, { origin: true });
app.register(websocket);

// Global data store
let rawCandles = []; // 1m candles: { t, o, h, l, c, v }

// Helper: Load CSV Data
function loadData() {
    const filePath = './data.csv';
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        // Skip header (potentially)
        // Header: ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol
        const startIndex = lines[0].startsWith('ts_event') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 9) continue;

            // parts[0] is ISO8601: "2023-03-28T11:00:00.000000000Z"
            const t = Math.floor(new Date(parts[0]).getTime() / 1000);
            const o = parseFloat(parts[4]);
            const h = parseFloat(parts[5]);
            const l = parseFloat(parts[6]);
            const c = parseFloat(parts[7]);
            const v = parseFloat(parts[8]);

            if (!isNaN(t) && !isNaN(o) && v > 0) {
                rawCandles.push({ t, o, h, l, c, v });
            }
        }

        // Ensure sorted by time
        rawCandles.sort((a, b) => a.t - b.t);

        console.log(`Loaded ${rawCandles.length} candles from CSV.`);
    } catch (err) {
        console.error('Failed to load data.csv:', err);
    }
}

// Helper: Aggregate 1m candles to target timeframe
function getAggregatedData(tf) {
    if (tf === '1m') return rawCandles;

    const tfSeconds = getTimeframeSeconds(tf);
    if (!tfSeconds) return rawCandles; // Fallback

    const aggregated = [];
    let currentBar = null;

    for (const c of rawCandles) {
        const barStart = Math.floor(c.t / tfSeconds) * tfSeconds;

        if (!currentBar) {
            currentBar = { t: barStart, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v };
        } else if (barStart === currentBar.t) {
            // Update existing bar
            currentBar.h = Math.max(currentBar.h, c.h);
            currentBar.l = Math.min(currentBar.l, c.l);
            currentBar.c = c.c;
            currentBar.v += c.v;
        } else {
            // Push completed bar and start new one
            aggregated.push(currentBar);
            currentBar = { t: barStart, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v };
        }
    }

    if (currentBar) aggregated.push(currentBar);

    return aggregated;
}

function getTimeframeSeconds(tf) {
    const map = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
        '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
    };
    return map[tf] || 3600;
}

// Load data at startup
loadData();

// Routes
// 1. Candles (Historical Data)
app.get('/api/v1/candles', async (req, reply) => {
    const { symbol, tf, to, limit, cursor } = req.query;

    // Aggregate data
    const candles = getAggregatedData(tf || '1h');

    // Pagination logic
    let endTimeMs = to ? Number(to) : Math.floor(Date.now() / 1000);
    if (cursor && cursor.startsWith('cur_')) {
        const ts = Number(cursor.split('_')[1]);
        if (!isNaN(ts)) endTimeMs = ts;
    }

    const barCount = Math.min(Number(limit) || 500, 5000); // Allow more for aggregation

    // Find index of last candle <= endTimeMs
    // Since array is sorted, we can search backwards or binary search
    // Simple backward search for now
    let endIndex = candles.length - 1;
    while (endIndex >= 0 && candles[endIndex].t > endTimeMs) {
        endIndex--;
    }

    const startIndex = Math.max(0, endIndex - barCount + 1);
    const data = candles.slice(startIndex, endIndex + 1);

    // Determine next cursor
    let nextCursor = null;
    if (data.length > 0 && startIndex > 0) {
        // next cursor is time of the bar *before* the first returned bar
        nextCursor = `cur_${candles[startIndex - 1].t}`;
    } else if (data.length > 0) {
        nextCursor = `cur_${data[0].t}`; // Or null if at start
    }

    return {
        symbol,
        tf,
        data,
        nextCursor,
        hasMore: startIndex > 0
    };
});

// 2. Stream (Real-time Data - Simulation)
app.register(async function (fastify) {
    fastify.get('/api/v1/stream', { websocket: true }, (connection /* SocketStream */, req /* FastifyRequest */) => {
        const socket = connection.socket
        let interval = null;

        socket.on('message', (message) => {
            try {
                const msg = JSON.parse(message);

                if (msg.action === 'subscribe') {
                    const { symbol, tf } = msg;
                    app.log.info(`Simulating stream for ${symbol} ${tf}`);

                    // Simulate updates every 1s using last known price + random noise
                    if (interval) clearInterval(interval);

                    const lastCandle = rawCandles[rawCandles.length - 1];
                    let currentPrice = lastCandle ? lastCandle.c : 100;
                    let currentBar = {
                        t: Math.floor(Date.now() / 1000),
                        o: currentPrice, h: currentPrice, l: currentPrice, c: currentPrice, v: 0
                    };

                    interval = setInterval(() => {
                        const change = (Math.random() - 0.5) * currentPrice * 0.001;
                        currentPrice += change;

                        currentBar.c = currentPrice;
                        currentBar.h = Math.max(currentBar.h, currentPrice);
                        currentBar.l = Math.min(currentBar.l, currentPrice);
                        currentBar.v += Math.random() * 10;

                        // Send update
                        if (socket.readyState === 1) {
                            socket.send(JSON.stringify({
                                type: 'bar_update',
                                symbol,
                                tf,
                                data: currentBar
                            }));
                        }
                    }, 1000);
                }

                if (msg.action === 'unsubscribe') {
                    if (interval) clearInterval(interval);
                }

                if (msg.action === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong' }));
                }

            } catch (err) {
                app.log.error(err);
            }
        });

        socket.on('close', () => {
            if (interval) clearInterval(interval);
        });
    });
});

// Mock other routes
app.get('/api/v1/drawings', async () => ({ drawings: [], count: 0 }));
app.post('/api/v1/drawings', async (req, reply) => {
    return reply.code(201).send({ id: `mock_${Date.now()}`, version: 1, createdAt: new Date().toISOString() });
});
app.patch('/api/v1/drawings/:id', async () => ({ version: 2, updatedAt: new Date().toISOString() }));
app.delete('/api/v1/drawings/:id', async (req, reply) => reply.code(204).send());
app.get('/api/v1/backtests/:runId/events', async () => ({ events: [], summary: {}, page: 1, totalPages: 1 }));
app.get('/api/v1/signals', async () => ({ signals: [], count: 0 }));
app.post('/api/v1/signals/run', async () => ({ runId: 'mock_run', count: 0, signals: [] }));

// Start server
const start = async () => {
    try {
        await app.listen({ port: 3001, host: '0.0.0.0' });
        app.log.info(`Local CSV Server running on port 3001`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
