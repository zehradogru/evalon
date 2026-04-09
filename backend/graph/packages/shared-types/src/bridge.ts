// ─── WebView Bridge Types ──────────────────────────────────────

/** Message envelope for all bridge communication */
export interface BridgeMessage<T = unknown> {
    /** Unique message ID for ACK correlation */
    id: string;
    /** Command or event type */
    type: BridgeCommandType | BridgeEventType | 'ack' | 'error';
    /** Message payload */
    payload: T;
    /** Unix timestamp (ms) */
    ts: number;
}

// ─── Native → Web Commands ─────────────────────────────────────

export type BridgeCommandType =
    | 'setSymbol'
    | 'setTimeframe'
    | 'toggleLayer'
    | 'loadBacktest'
    | 'setStrategy'
    | 'setTheme';

export interface SetSymbolPayload {
    symbol: string;
}

export interface SetTimeframePayload {
    tf: string;
}

export type LayerName = 'drawings' | 'trades' | 'signals';

export interface ToggleLayerPayload {
    layer: LayerName;
    visible: boolean;
}

export interface LoadBacktestPayload {
    runId: string;
}

export interface SetStrategyPayload {
    strategyId: string;
    params: Record<string, unknown>;
}

export type ThemeName = 'dark' | 'light';

export interface SetThemePayload {
    theme: ThemeName;
}

// ─── Web → Native Events ──────────────────────────────────────

export type BridgeEventType =
    | 'ready'
    | 'markerClicked'
    | 'drawingCreated'
    | 'drawingUpdated'
    | 'drawingDeleted'
    | 'selectionChanged'
    | 'crosshairMoved';

export interface ReadyPayload {
    version: string;
    lwcVersion: string;
}

export type MarkerType = 'backtest_entry' | 'backtest_exit' | 'backtest_stop' | 'backtest_tp' | 'signal_buy' | 'signal_sell';

export interface MarkerClickedPayload {
    markerId: string;
    markerType: MarkerType;
    time: number;
    price: number;
    side?: string;
    tradeId?: string;
}

export interface DrawingCreatedPayload {
    drawingId: string;
    type: string;
    anchors: Array<{ time: number; price: number }>;
}

export interface DrawingUpdatedPayload {
    drawingId: string;
    changes: Record<string, unknown>;
}

export interface DrawingDeletedPayload {
    drawingId: string;
}

export interface SelectionChangedPayload {
    selectedDrawingId: string | null;
    type?: string;
}

export interface CrosshairMovedPayload {
    time: number;
    price: number;
    x: number;
    y: number;
}

// ─── ACK / Error ───────────────────────────────────────────────

export interface AckPayload {
    success: boolean;
}

export interface ErrorPayload {
    code: string;
    message: string;
}
