// ─── Signal Types ──────────────────────────────────────────────

export type SignalSide = 'buy' | 'sell';

export interface SignalModel {
    id: string;
    /** Unix timestamp (seconds) */
    time: number;
    price: number;
    side: SignalSide;
    label: string;
    confidence?: number;
    meta: Record<string, unknown>;
}

// ─── Signal API DTOs ───────────────────────────────────────────

export interface SignalRunRequest {
    symbol: string;
    tf: string;
    range: { from: number; to: number };
    strategyId: string;
    params: Record<string, unknown>;
    strategyIds?: string[];
    strategies?: Array<{ id: string; params?: Record<string, unknown> }>;
    combine?: 'and' | 'or';
}

export interface SignalRunResponse {
    runId: string;
    strategyId: string;
    signals: SignalModel[];
    count: number;
}

export interface SignalListResponse {
    signals: SignalModel[];
    count: number;
}

export interface StrategyParamSchema {
    key: string;
    label: string;
    type: 'number';
    defaultValue: number;
    min?: number;
    max?: number;
    step?: number;
}

export interface StrategyDefinition {
    id: string;
    label: string;
    params: StrategyParamSchema[];
}

export interface StrategyCatalogResponse {
    count: number;
    strategies: StrategyDefinition[];
}
