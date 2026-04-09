import type {
    DrawingModel,
    CreateDrawingRequest,
    UpdateDrawingRequest,
    Anchor,
    DrawingType,
    DrawingStyle,
} from '@graph/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

/**
 * DrawingStore — manages drawing state locally and syncs with backend.
 * Implements optimistic updates with server reconciliation.
 */

export type DrawingChangeCallback = (drawings: DrawingModel[]) => void;

export class DrawingStore {
    private drawings: Map<string, DrawingModel> = new Map();
    private localIdCounter = 0;
    private listeners: DrawingChangeCallback[] = [];
    private symbol: string = '';
    private tf: string = '';

    onChange(cb: DrawingChangeCallback): void {
        this.listeners.push(cb);
    }

    /** Load all drawings for a symbol/tf from the server */
    async load(symbol: string, tf: string): Promise<void> {
        this.symbol = symbol;
        this.tf = tf;
        this.drawings.clear();

        try {
            const res = await fetch(`${API_BASE}/drawings?symbol=${symbol}&tf=${tf}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            for (const d of data.drawings) {
                this.drawings.set(d.id, d);
            }
        } catch (err) {
            console.error('[DrawingStore] load error:', err);
        }

        this.notify();
    }

    /** Get all drawings as array */
    getAll(): DrawingModel[] {
        return Array.from(this.drawings.values());
    }

    /** Get a single drawing by ID */
    get(id: string): DrawingModel | undefined {
        return this.drawings.get(id);
    }

    /** Create a new drawing (optimistic) */
    async create(
        type: DrawingType,
        anchors: Anchor[],
        style: Partial<DrawingStyle>
    ): Promise<DrawingModel> {
        // Create local drawing immediately
        const localId = `local_${++this.localIdCounter}`;
        const now = new Date().toISOString();

        const fullStyle: DrawingStyle = {
            color: '#3b82f6',
            width: 2,
            dash: [],
            opacity: 1.0,
            ...style,
            text: style.text,
        };

        const drawing: DrawingModel = {
            id: localId,
            ownerId: '',
            symbol: this.symbol,
            tf: this.tf,
            type,
            anchors,
            style: fullStyle,
            meta: { name: `${type} ${this.drawings.size + 1}`, locked: false, hidden: false },
            version: 0,
            createdAt: now,
            updatedAt: now,
        };

        this.drawings.set(localId, drawing);
        this.notify();

        // Sync to server
        try {
            const req: CreateDrawingRequest = {
                symbol: this.symbol,
                tf: this.tf,
                type,
                anchors,
                style,
                meta: drawing.meta,
            };

            const res = await fetch(`${API_BASE}/drawings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });

            if (res.ok) {
                const serverResponse = await res.json();
                // Replace local ID with server ID
                this.drawings.delete(localId);
                drawing.id = serverResponse.id;
                drawing.version = serverResponse.version;
                drawing.createdAt = serverResponse.createdAt;
                this.drawings.set(drawing.id, drawing);
                this.notify();
            }
        } catch (err) {
            console.error('[DrawingStore] create sync error:', err);
            // Keep local drawing (offline support can sync later)
        }

        return drawing;
    }

    /** Update a drawing (optimistic) */
    async update(
        id: string,
        changes: { anchors?: Anchor[]; style?: Partial<DrawingStyle>; meta?: Partial<DrawingModel['meta']> },
        options: { sync?: boolean } = {}
    ): Promise<void> {
        const drawing = this.drawings.get(id);
        if (!drawing) return;
        const shouldSync = options.sync !== false;

        // const prevState = { ...drawing };

        // Apply changes locally
        if (changes.anchors) drawing.anchors = changes.anchors;
        if (changes.style) drawing.style = { ...drawing.style, ...changes.style };
        if (changes.meta) drawing.meta = { ...drawing.meta, ...changes.meta };
        drawing.updatedAt = new Date().toISOString();

        this.notify();

        // Sync to server
        if (shouldSync && !id.startsWith('local_')) {
            try {
                const req: UpdateDrawingRequest = {
                    version: drawing.version,
                    ...changes,
                };

                const res = await fetch(`${API_BASE}/drawings/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(req),
                });

                if (res.ok) {
                    const serverResponse = await res.json();
                    drawing.version = serverResponse.version;
                } else if (res.status === 409) {
                    // Version conflict — re-fetch
                    console.warn('[DrawingStore] version conflict, re-fetching');
                    await this.load(this.symbol, this.tf);
                }
            } catch (err) {
                console.error('[DrawingStore] update sync error:', err);
            }
        }
    }

    /** Delete a drawing */
    async delete(id: string): Promise<DrawingModel | null> {
        const drawing = this.drawings.get(id);
        if (!drawing) return null;

        this.drawings.delete(id);
        this.notify();

        // Sync to server
        if (!id.startsWith('local_')) {
            try {
                await fetch(`${API_BASE}/drawings/${id}`, { method: 'DELETE' });
            } catch (err) {
                console.error('[DrawingStore] delete sync error:', err);
            }
        }

        return drawing;
    }

    /** Restore a deleted drawing (for undo) */
    restore(drawing: DrawingModel): void {
        this.drawings.set(drawing.id, drawing);
        this.notify();
    }

    /** Remove all drawings for current symbol/timeframe */
    async clearAll(): Promise<number> {
        const ids = Array.from(this.drawings.keys());
        if (ids.length === 0) return 0;

        const remoteIds = ids.filter((id) => !id.startsWith('local_'));
        this.drawings.clear();
        this.notify();

        await Promise.all(
            remoteIds.map(async (id) => {
                try {
                    await fetch(`${API_BASE}/drawings/${id}`, { method: 'DELETE' });
                } catch (err) {
                    console.error('[DrawingStore] clearAll delete sync error:', err);
                }
            })
        );

        return ids.length;
    }

    private notify(): void {
        const all = this.getAll();
        for (const cb of this.listeners) {
            cb(all);
        }
    }
}
