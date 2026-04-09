import type { FastifyPluginAsync } from 'fastify';
import type { DrawingModel, CreateDrawingRequest, UpdateDrawingRequest } from '@graph/shared-types';
import * as crypto from 'crypto';

/**
 * Drawing routes — CRUD for chart drawings.
 * MVP: in-memory store. Replace with PostgreSQL + Drizzle ORM.
 */

// In-memory store (MVP)
const drawingsDb = new Map<string, DrawingModel>();

export const drawingRoutes: FastifyPluginAsync = async (app) => {

    // ─── GET /drawings ─────────────────────────────────────────
    app.get('/drawings', async (request, reply) => {
        const { symbol, tf } = request.query as { symbol: string; tf: string };

        if (!symbol || !tf) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol and tf are required',
                requestId: request.id,
            });
        }

        const drawings = Array.from(drawingsDb.values())
            .filter((d) => d.symbol === symbol && d.tf === tf);

        return reply.send({ drawings, count: drawings.length });
    });

    // ─── POST /drawings ────────────────────────────────────────
    app.post('/drawings', async (request, reply) => {
        const body = request.body as CreateDrawingRequest;

        if (!body.symbol || !body.tf || !body.type || !body.anchors) {
            return reply.status(400).send({
                error: 'VALIDATION_ERROR',
                message: 'symbol, tf, type, and anchors are required',
                requestId: request.id,
            });
        }

        const id = `drw_${crypto.randomBytes(6).toString('hex')}`;
        const now = new Date().toISOString();

        const drawing: DrawingModel = {
            id,
            ownerId: 'usr_demo', // MVP: no auth
            symbol: body.symbol,
            tf: body.tf,
            type: body.type,
            anchors: body.anchors,
            style: {
                color: '#3b82f6',
                width: 2,
                dash: [],
                opacity: 1.0,
                ...body.style,
            },
            meta: {
                name: `Drawing ${drawingsDb.size + 1}`,
                locked: false,
                hidden: false,
                ...body.meta,
            },
            version: 1,
            createdAt: now,
            updatedAt: now,
        };

        drawingsDb.set(id, drawing);
        app.log.info(`Drawing created: ${id} (${body.type})`);

        return reply.status(201).send({
            id: drawing.id,
            version: drawing.version,
            createdAt: drawing.createdAt,
        });
    });

    // ─── PATCH /drawings/:id ───────────────────────────────────
    app.patch('/drawings/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as UpdateDrawingRequest;

        const drawing = drawingsDb.get(id);
        if (!drawing) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: `Drawing ${id} not found`,
                requestId: request.id,
            });
        }

        // Optimistic locking
        if (body.version !== undefined && body.version !== drawing.version) {
            return reply.status(409).send({
                error: 'VERSION_CONFLICT',
                message: `Expected version ${body.version} but found ${drawing.version}`,
                currentVersion: drawing.version,
            });
        }

        // Apply updates
        if (body.anchors) drawing.anchors = body.anchors;
        if (body.style) drawing.style = { ...drawing.style, ...body.style };
        if (body.meta) drawing.meta = { ...drawing.meta, ...body.meta };
        drawing.version++;
        drawing.updatedAt = new Date().toISOString();

        app.log.info(`Drawing updated: ${id} (v${drawing.version})`);

        return reply.send({
            id: drawing.id,
            version: drawing.version,
            updatedAt: drawing.updatedAt,
        });
    });

    // ─── DELETE /drawings/:id ──────────────────────────────────
    app.delete('/drawings/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!drawingsDb.has(id)) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: `Drawing ${id} not found`,
                requestId: request.id,
            });
        }

        drawingsDb.delete(id);
        app.log.info(`Drawing deleted: ${id}`);

        return reply.status(204).send();
    });
};
