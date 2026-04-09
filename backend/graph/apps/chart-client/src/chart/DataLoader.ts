import type { CandleData, CandleResponse, TimeFrame } from '@graph/shared-types';
import { ChartManager } from './ChartManager';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

/**
 * DataLoader — fetches candle data via REST with cursor-based pagination.
 * Maintains the full dataset in memory and handles left-scroll loading.
 */
export class DataLoader {
    private static readonly LEFT_EDGE_THRESHOLD = 40;
    private static readonly MIN_LEFT_MOVE = 1.5;
    private static readonly PROGRAMMATIC_UPDATE_GUARD_MS = 350;
    private static readonly PAGINATION_COOLDOWN_MS = 500;

    private chartManager: ChartManager;
    private symbol: string = '';
    private tf: TimeFrame = '1h';
    private data: CandleData[] = [];
    private nextCursor: string | null = null;
    private hasMore: boolean = true;
    private isLoading: boolean = false;
    private lastVisibleFrom: number | null = null;
    private ignoreRangeEventsUntil: number = 0;
    private paginationCooldownUntil: number = 0;

    /** Callback when historical data is loaded */
    onHistoricalDataLoaded?: (newBars: number) => void;

    constructor(chartManager: ChartManager) {
        this.chartManager = chartManager;
        this.setupScrollHandler();
    }

    /** Load initial data for a symbol/timeframe */
    async load(symbol: string, tf: TimeFrame): Promise<void> {
        this.symbol = symbol;
        this.tf = tf;
        this.data = [];
        this.nextCursor = null;
        this.hasMore = true;
        this.lastVisibleFrom = null;
        this.ignoreRangeEventsUntil = 0;
        this.paginationCooldownUntil = 0;

        const response = await this.fetchCandles();
        if (!response) return;

        this.data = response.data.map((bar) => ({
            ...bar,
            t: this.normalizeTime(bar.t as unknown),
        }));
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;

        this.ignoreRangeEventsUntil = Date.now() + DataLoader.PROGRAMMATIC_UPDATE_GUARD_MS;
        this.chartManager.setData(this.data);
        this.chartManager.autoScale();
    }

    /** Get the current full dataset */
    getData(): CandleData[] {
        return this.data;
    }

    /** Get current symbol */
    getSymbol(): string {
        return this.symbol;
    }

    /** Get current timeframe */
    getTimeframe(): TimeFrame {
        return this.tf;
    }

    /** Load more historical data (triggered by scroll-left) */
    async loadMore(): Promise<void> {
        if (this.isLoading || !this.hasMore) return;
        this.isLoading = true;

        try {
            const oldestTime = this.data.length > 0 ? this.data[0].t : undefined;
            const response = await this.fetchCandles(oldestTime);
            if (!response || response.data.length === 0) {
                this.hasMore = false;
                return;
            }

            // Prepend older data
            const normalized = response.data.map((bar) => ({
                ...bar,
                t: this.normalizeTime(bar.t as unknown),
            })).sort((a, b) => a.t - b.t);

            const olderOnly = typeof oldestTime === 'number'
                ? normalized.filter((bar) => bar.t < oldestTime)
                : normalized;

            // Stop pagination if backend returns no strictly older bars.
            if (olderOnly.length === 0) {
                this.hasMore = false;
                return;
            }

            this.data = [...olderOnly, ...this.data];
            this.nextCursor = response.nextCursor;
            this.hasMore = response.hasMore && olderOnly.length > 0;

            // Re-set all data (LWC doesn't support prepend)
            this.ignoreRangeEventsUntil = Date.now() + DataLoader.PROGRAMMATIC_UPDATE_GUARD_MS;
            this.chartManager.setData(this.data);
            this.onHistoricalDataLoaded?.(olderOnly.length);
        } finally {
            this.isLoading = false;
        }
    }

    /** Fetch candles from REST API */
    private async fetchCandles(to?: number): Promise<CandleResponse | null> {
        try {
            const isInitial = typeof to !== 'number';
            const limit = isInitial ? this.getInitialLimit(this.tf) : this.getPaginationLimit(this.tf);

            const params = new URLSearchParams({
                symbol: this.symbol,
                tf: this.tf,
                limit: String(limit),
            });

            if (typeof to === 'number') {
                params.set('to', String(to));
            } else {
                const now = Math.floor(Date.now() / 1000);
                // Keep the first paint fast; deeper history already loads on left-scroll.
                const windowSec = limit * this.getTimeframeSeconds(this.tf);
                params.set('from', String(Math.max(0, now - windowSec)));
                params.set('to', String(now));
            }
            if (this.nextCursor) params.set('cursor', this.nextCursor);

            const res = await fetch(`${API_BASE}/candles?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json() as CandleResponse;
        } catch (err) {
            console.error('[DataLoader] fetch error:', err);
            return null;
        }
    }

    /** Detect left-edge scroll and trigger pagination */
    private setupScrollHandler(): void {
        const chart = this.chartManager.getChart();
        const timeScale = chart.timeScale();

        timeScale.subscribeVisibleLogicalRangeChange((range) => {
            if (!range) return;
            const from = Number(range.from);
            if (!Number.isFinite(from)) return;

            const now = Date.now();
            const previousFrom = this.lastVisibleFrom;
            this.lastVisibleFrom = from;

            if (now < this.ignoreRangeEventsUntil) return;
            if (now < this.paginationCooldownUntil) return;
            if (previousFrom === null) return;
            if (from > DataLoader.LEFT_EDGE_THRESHOLD) return;

            // Trigger only when user moves further left, not on static/programmatic range updates.
            if (from >= previousFrom - DataLoader.MIN_LEFT_MOVE) return;

            this.paginationCooldownUntil = now + DataLoader.PAGINATION_COOLDOWN_MS;
            void this.loadMore();
        });
    }

    /** Accepts ISO string / unix-ms / unix-sec and returns unix-sec */
    private normalizeTime(value: unknown): number {
        if (typeof value === 'number') {
            return value > 1e12 ? Math.floor(value / 1000) : value;
        }
        if (typeof value === 'string') {
            const asNumber = Number(value);
            if (!Number.isNaN(asNumber)) {
                return asNumber > 1e12 ? Math.floor(asNumber / 1000) : asNumber;
            }
            const parsedMs = Date.parse(value);
            if (!Number.isNaN(parsedMs)) {
                return Math.floor(parsedMs / 1000);
            }
        }
        return Math.floor(Date.now() / 1000);
    }

    private getInitialLimit(tf: TimeFrame): number {
        const map: Record<TimeFrame, number> = {
            '1m': 10000,
            '3m': 8000,
            '5m': 6000,
            '15m': 4000,
            '30m': 3000,
            '1h': 2000,
            '2h': 1800,
            '4h': 1600,
            '6h': 1400,
            '12h': 1200,
            '1d': 1000,
            '3d': 800,
            '1w': 600,
            '1M': 360,
        };
        return map[tf] || 1500;
    }

    private getPaginationLimit(tf: TimeFrame): number {
        const map: Record<TimeFrame, number> = {
            '1m': 10000,
            '3m': 7000,
            '5m': 5000,
            '15m': 3000,
            '30m': 2000,
            '1h': 1500,
            '2h': 1200,
            '4h': 1000,
            '6h': 900,
            '12h': 800,
            '1d': 700,
            '3d': 500,
            '1w': 300,
            '1M': 200,
        };
        return map[tf] || 1000;
    }

    private getTimeframeSeconds(tf: TimeFrame): number {
        const map: Record<TimeFrame, number> = {
            '1m': 60,
            '3m': 180,
            '5m': 300,
            '15m': 900,
            '30m': 1800,
            '1h': 3600,
            '2h': 7200,
            '4h': 14400,
            '6h': 21600,
            '12h': 43200,
            '1d': 86400,
            '3d': 259200,
            '1w': 604800,
            '1M': 2592000,
        };
        return map[tf] || 3600;
    }
}
