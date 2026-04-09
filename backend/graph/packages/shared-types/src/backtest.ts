// ─── Backtest Event Types ──────────────────────────────────────

export type BacktestEventType =
    | 'entry'
    | 'exit'
    | 'stop'
    | 'tp'
    | 'scale_in'
    | 'scale_out';

export type TradeSide = 'long' | 'short';

export interface BacktestEvent {
    id: string;
    type: BacktestEventType;
    /** Unix timestamp (seconds) */
    time: number;
    price: number;
    side: TradeSide;
    qty: number;
    tradeId: string;
    orderId: string;
    /** PnL — null for entries, populated for exits */
    pnl: number | null;
    reason: string;
    meta: Record<string, unknown>;
}

export interface BacktestSummary {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
}

export interface BacktestEventsResponse {
    runId: string;
    events: BacktestEvent[];
    summary: BacktestSummary;
    page: number;
    totalPages: number;
    totalEvents: number;
}
