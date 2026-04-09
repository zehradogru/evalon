// ─── Market Data Types ─────────────────────────────────────────

export interface CandleData {
    /** Unix timestamp (seconds) */
    t: number;
    /** Open price */
    o: number;
    /** High price */
    h: number;
    /** Low price */
    l: number;
    /** Close price */
    c: number;
    /** Volume */
    v: number;
}

export type TimeFrame =
    | '1m' | '3m' | '5m' | '15m' | '30m'
    | '1h' | '2h' | '4h' | '6h' | '12h'
    | '1d' | '3d' | '1w' | '1M';

export interface CandleRequest {
    symbol: string;
    tf: TimeFrame;
    from?: number;
    to?: number;
    limit?: number;
    cursor?: string;
}

export interface CandleResponse {
    symbol: string;
    tf: TimeFrame;
    data: CandleData[];
    nextCursor: string | null;
    hasMore: boolean;
}

// ─── WebSocket Stream Types ────────────────────────────────────

export type StreamAction = 'subscribe' | 'unsubscribe';

export interface StreamSubscription {
    action: StreamAction;
    symbol: string;
    tf: TimeFrame;
}

export type StreamEventType = 'bar_update' | 'new_bar';

export interface StreamEvent {
    type: StreamEventType;
    symbol: string;
    tf: TimeFrame;
    data: CandleData;
}
