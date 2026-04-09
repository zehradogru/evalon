// ─── Common Types ──────────────────────────────────────────────

/** Standard API error response */
export interface ApiError {
    error: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
}

/** Pagination parameters */
export interface PaginationParams {
    page?: number;
    limit?: number;
}

/** Chart scale mode */
export type ScaleMode = 'linear' | 'logarithmic';

/** Chart interaction modes */
export type InteractionMode = 'explore' | 'draw' | 'edit';
