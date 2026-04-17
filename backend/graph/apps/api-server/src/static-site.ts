import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = resolve(CURRENT_DIR, '../../chart-client/dist');
const WEB_DIST_DIR = process.env.GRAPH_WEB_DIST_DIR
    ? resolve(process.env.GRAPH_WEB_DIST_DIR)
    : DEFAULT_DIST_DIR;

const FRIENDLY_HTML_ROUTES = new Map<string, string>([
    ['/', 'index.html'],
    ['/index', 'index.html'],
    ['/chart', 'chart.html'],
    ['/backtest', 'backtest.html'],
    ['/ai', 'ai.html'],
]);

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
};

export function registerStaticSite(app: FastifyInstance): void {
    app.get('/*', async (request, reply) => {
        if (!existsSync(WEB_DIST_DIR)) {
            return reply.status(503).send({
                error: 'STATIC_BUILD_MISSING',
                message: `Chart client dist not found at ${WEB_DIST_DIR}`,
                requestId: request.id,
            });
        }

        const targetPath = resolveStaticAssetPath(request.raw.url || '/');
        if (!targetPath) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Static asset not found.',
                requestId: request.id,
            });
        }

        let fileInfo;
        try {
            fileInfo = await stat(targetPath);
        } catch {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Static asset not found.',
                requestId: request.id,
            });
        }

        if (!fileInfo.isFile()) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Static asset not found.',
                requestId: request.id,
            });
        }

        applyStaticHeaders(reply, targetPath);
        return reply.send(createReadStream(targetPath));
    });
}

export function getWebDistDir(): string {
    return WEB_DIST_DIR;
}

function resolveStaticAssetPath(rawUrl: string): string | null {
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    const friendlyHtml = FRIENDLY_HTML_ROUTES.get(pathname);
    if (friendlyHtml) {
        return resolve(WEB_DIST_DIR, friendlyHtml);
    }

    const requested = pathname.replace(/^\/+/, '');
    if (!requested) {
        return resolve(WEB_DIST_DIR, 'index.html');
    }

    const normalizedPath = normalize(requested);
    if (normalizedPath.startsWith('..') || normalizedPath.includes('/../') || normalizedPath.includes('\\..\\')) {
        return null;
    }

    if (!extname(normalizedPath)) {
        const htmlCandidate = `${normalizedPath}.html`;
        return resolve(WEB_DIST_DIR, htmlCandidate);
    }

    return resolve(WEB_DIST_DIR, normalizedPath);
}

function applyStaticHeaders(reply: FastifyReply, targetPath: string): void {
    const extension = extname(targetPath).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[extension] || 'application/octet-stream';
    const isImmutableAsset = targetPath.includes('/assets/');

    reply.type(contentType);
    reply.header('Cache-Control', isImmutableAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
}
