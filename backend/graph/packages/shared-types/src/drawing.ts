// ─── Drawing Types ─────────────────────────────────────────────

export type DrawingType =
    | 'trendline'
    | 'horizontal_line'
    | 'vertical_line'
    | 'rectangle'
    | 'fibonacci'
    | 'parallel_channel'
    | 'measure'
    | 'text'
    | 'ray'
    | 'brush'
    | 'long_position'
    | 'short_position';

export interface Anchor {
    /** Unix timestamp (seconds). 0 for time-independent drawings (e.g., horizontal_line) */
    time: number;
    /** Price level. 0 for price-independent drawings (e.g., vertical_line) */
    price: number;
}

export type LineExtend = 'none' | 'left' | 'right' | 'both';

export interface DrawingStyle {
    color: string;
    width: number;
    dash: number[];
    opacity: number;
    extend?: LineExtend;
    fontSize?: number;
    fontFamily?: string;
    text?: string;
    fillColor?: string;
    fillOpacity?: number;
}

export interface DrawingMeta {
    name: string;
    locked: boolean;
    hidden: boolean;
}

export interface DrawingModel {
    id: string;
    ownerId: string;
    symbol: string;
    tf: string;
    type: DrawingType;
    anchors: Anchor[];
    style: DrawingStyle;
    meta: DrawingMeta;
    version: number;
    createdAt: string;
    updatedAt: string;
}

// ─── Drawing API DTOs ──────────────────────────────────────────

export interface CreateDrawingRequest {
    symbol: string;
    tf: string;
    type: DrawingType;
    anchors: Anchor[];
    style: Partial<DrawingStyle>;
    meta: Partial<DrawingMeta>;
}

export interface CreateDrawingResponse {
    id: string;
    version: number;
    createdAt: string;
}

export interface UpdateDrawingRequest {
    version: number;
    anchors?: Anchor[];
    style?: Partial<DrawingStyle>;
    meta?: Partial<DrawingMeta>;
}

export interface UpdateDrawingResponse {
    id: string;
    version: number;
    updatedAt: string;
}

export interface DrawingListResponse {
    drawings: DrawingModel[];
    count: number;
}
