import type { TimeFrame } from '@graph/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface IndicatorDataPoint {
    time: number; // unix timestamp (seconds) or millis depending on chart config
    value: number;
    color?: string;
}

export interface IndicatorSeries {
    name: string;
    type: 'line' | 'histogram';
    data: IndicatorDataPoint[];
    panel: number;
    options?: {
        color?: string;
        lineWidth?: number;
        lineStyle?: number;
        [key: string]: any;
    };
}

export interface IndicatorResponse {
    ticker: string;
    timeframe: string;
    strategy: string;
    indicators: IndicatorSeries[];
}

export class IndicatorService {
    private static instance: IndicatorService;

    private constructor() {}

    public static getInstance(): IndicatorService {
        if (!IndicatorService.instance) {
            IndicatorService.instance = new IndicatorService();
        }
        return IndicatorService.instance;
    }

    async fetchIndicators(
        symbol: string,
        tf: TimeFrame,
        strategy: string,
        params: Record<string, unknown> = {}
    ): Promise<IndicatorSeries[]> {
        try {
            const url = new URL(`${API_BASE}/indicators`, window.location.origin);
            url.searchParams.append('symbol', symbol);
            url.searchParams.append('tf', tf);
            url.searchParams.append('strategy', strategy);
            
            // Add extra params (period, fast, slow, etc.)
            Object.entries(params).forEach(([key, val]) => {
                if (val !== undefined && val !== null) {
                    url.searchParams.append(key, String(val));
                }
            });

            const res = await fetch(url.toString());
            if (!res.ok) {
                console.error('Indicator fetch failed:', res.statusText);
                return [];
            }

            const data: IndicatorResponse = await res.json();

            return data.indicators.map(series => ({
                ...series,
                data: series.data.map((d: any) => ({
                    ...d,
                    time: normalizeTime(d.time),
                }))
            }));

        } catch (err) {
            console.error('IndicatorService error:', err);
            return [];
        }
    }
}

function normalizeTime(value: unknown): number {
    if (typeof value === 'number') {
        return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
    }
    if (typeof value === 'string') {
        const asNumber = Number(value);
        if (!Number.isNaN(asNumber)) {
            return asNumber > 1e12 ? Math.floor(asNumber / 1000) : Math.floor(asNumber);
        }
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return Math.floor(parsed / 1000);
        }
    }
    return Math.floor(Date.now() / 1000);
}
