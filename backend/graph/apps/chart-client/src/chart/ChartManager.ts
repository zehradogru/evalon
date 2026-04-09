import {
    createChart,
    ColorType,
    CrosshairMode,
    type IChartApi,
    type ISeriesApi,
    type CandlestickData,
    type LineData,
    type HistogramData,
    type Time,
} from 'lightweight-charts';
import type { CandleData, ScaleMode } from '@graph/shared-types';
import { registerSeries, clearSeriesRegistry, unregisterSeries, setPrimarySeries } from '@graph/chart-utils';

export interface ChartManagerOptions {
    container: HTMLElement;
    theme?: 'dark' | 'light';
}

/**
 * ChartManager — wraps LWC lifecycle.
 * Manages the chart instance, candlestick + volume series,
 * auto-scale, log/linear toggle, and theme application.
 */
export class ChartManager {
    private chart: IChartApi;
    private mainSeries: ISeriesApi<any>;
    private mainSeriesType: 'Candlestick' | 'Line' | 'Area' = 'Candlestick';
    private volumeSeries: ISeriesApi<'Histogram'>;
    private indicatorSeries = new Set<ISeriesApi<any>>();
    private indicatorScaleBySeries = new Map<ISeriesApi<any>, string>();
    private indicatorScales = new Set<string>();
    private mainPaneBottomRatio = 1;
    private scaleMode: ScaleMode = 'linear';
    private lastData: CandleData[] = [];
    // private container: HTMLElement;

    constructor(options: ChartManagerOptions) {
        // this.container = options.container;
        const isDark = (options.theme ?? 'dark') === 'dark';

        this.chart = createChart(options.container, {
            width: options.container.clientWidth,
            height: options.container.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: isDark ? '#0a0e17' : '#ffffff' },
                textColor: isDark ? '#9ca3af' : '#4b5563',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: 12,
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: isDark ? '#1f293744' : '#e5e7eb44' },
                horzLines: { color: isDark ? '#1f293744' : '#e5e7eb44' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { labelBackgroundColor: isDark ? '#3b82f6' : '#2563eb' },
                horzLine: { labelBackgroundColor: isDark ? '#3b82f6' : '#2563eb' },
            },
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.25 },
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                minBarSpacing: 2,
            },
            handleScroll: { vertTouchDrag: false },
        } as any);

        // Candlestick series
        // Initial series: Candlestick
        this.mainSeries = this.createSeries('Candlestick');
        registerSeries(this.chart, this.mainSeries);
        setPrimarySeries(this.chart, this.mainSeries);

        // Volume histogram
        this.volumeSeries = this.chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            priceLineVisible: false,
            lastValueVisible: false,
        } as any);
        this.chart.priceScale('volume').applyOptions({
            visible: false,
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        registerSeries(this.chart, this.volumeSeries);
        this.applyPaneLayout();

        // Responsive resize
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                this.chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(options.container);
    }

    /** Get the LWC chart instance (used by overlay for coordinate transforms) */
    getChart(): IChartApi {
        return this.chart;
    }

    /** Get the main series (generic) */
    getMainSeries(): ISeriesApi<any> {
        return this.mainSeries;
    }

    /** Legacy accessor for CandleSeries specifically (if needed by MarkerManager) */
    getCandleSeries(): ISeriesApi<'Candlestick'> {
        return this.mainSeries as ISeriesApi<'Candlestick'>;
    }

    /** Load candle data into the chart */
    setData(candles: CandleData[]): void {
        this.lastData = candles;

        if (this.mainSeriesType === 'Candlestick') {
            const data: CandlestickData[] = candles.map((c) => ({
                time: c.t as Time,
                open: c.o,
                high: c.h,
                low: c.l,
                close: c.c,
            }));
            this.mainSeries.setData(data);
        } else {
            const data: LineData[] = candles.map((c) => ({
                time: c.t as Time,
                value: c.c,
            }));
            this.mainSeries.setData(data);
        }

        const volumeData: HistogramData[] = candles.map((c) => ({
            time: c.t as Time,
            value: c.v,
            color: c.c >= c.o
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(239, 68, 68, 0.3)',
        }));
        this.volumeSeries.setData(volumeData);
    }

    /** Append older historical data (prepend) */
    prependData(_candles: CandleData[]): void {
        // LWC doesn't support prepend natively — we need to re-set all data
        // This is handled by DataLoader which maintains the full dataset
    }

    /** Update the last bar in real-time */
    updateBar(candle: CandleData): void {
        // Update cached data (simplified: append or update last)
        if (this.lastData.length > 0 && this.lastData[this.lastData.length - 1].t === candle.t) {
            this.lastData[this.lastData.length - 1] = candle;
        } else {
            this.lastData.push(candle);
        }

        if (this.mainSeriesType === 'Candlestick') {
            this.mainSeries.update({
                time: candle.t as Time,
                open: candle.o,
                high: candle.h,
                low: candle.l,
                close: candle.c,
            });
        } else {
            this.mainSeries.update({
                time: candle.t as Time,
                value: candle.c,
            });
        }

        this.volumeSeries.update({
            time: candle.t as Time,
            value: candle.v,
            color: candle.c >= candle.o
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(239, 68, 68, 0.3)',
        });
    }

    /** Toggle between linear and logarithmic scale */
    setScaleMode(mode: ScaleMode): void {
        this.scaleMode = mode;
        this.chart.priceScale('right').applyOptions({
            mode: mode === 'logarithmic' ? 1 : 0,
        });
        this.applyPaneLayout();
    }

    getScaleMode(): ScaleMode {
        return this.scaleMode;
    }

    /** Auto-fit visible data */
    autoScale(): void {
        this.chart.timeScale().fitContent();
    }

    getMainPaneBottomRatio(): number {
        return this.mainPaneBottomRatio;
    }

    /** Apply theme */
    setTheme(theme: 'dark' | 'light'): void {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        this.chart.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: isDark ? '#0a0e17' : '#ffffff' },
                textColor: isDark ? '#9ca3af' : '#4b5563',
            },
            grid: {
                vertLines: { color: isDark ? '#1f293744' : '#e5e7eb44' },
                horzLines: { color: isDark ? '#1f293744' : '#e5e7eb44' },
            },
        } as any);

        // Re-apply options to current series if needed (colors depend on type)
        // For simplicity, we just rebuild series in setSeriesType if theme changes dynamically, or applyOptions here.
        // But since we use static colors mostly, implementing applyOptions partially:
        if (this.mainSeriesType === 'Candlestick') {
            this.mainSeries.applyOptions({
                upColor: isDark ? '#10b981' : '#059669',
                downColor: isDark ? '#ef4444' : '#dc2626',
                borderDownColor: isDark ? '#ef4444' : '#dc2626',
                borderUpColor: isDark ? '#10b981' : '#059669',
                wickDownColor: isDark ? '#ef444488' : '#dc262688',
                wickUpColor: isDark ? '#10b98188' : '#05966988',
            });
        } else {
            // Line/Area colors
            this.mainSeries.applyOptions({
                color: '#2962FF', // Default blue
            });
        }
    }

    /** Switch chart type: 'Candle' | 'Line' | 'Area' */
    setSeriesType(type: 'Candle' | 'Line' | 'Area'): void {
        const targetType = type === 'Candle' ? 'Candlestick' : type;
        if (this.mainSeriesType === targetType) return;

        this.chart.removeSeries(this.mainSeries);
        unregisterSeries(this.chart, this.mainSeries);
        this.mainSeriesType = targetType as any;
        this.mainSeries = this.createSeries(targetType as any);

        // Update registry: clear old references and re-register active series
        clearSeriesRegistry(this.chart);
        registerSeries(this.chart, this.mainSeries);
        setPrimarySeries(this.chart, this.mainSeries);
        registerSeries(this.chart, this.volumeSeries);
        for (const series of this.indicatorSeries) {
            registerSeries(this.chart, series);
        }

        // Restore data
        if (this.lastData.length > 0) {
            this.setData(this.lastData);
        }
        this.applyPaneLayout();
    }

    private createSeries(type: 'Candlestick' | 'Line' | 'Area'): ISeriesApi<any> {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isDark = theme === 'dark';

        if (type === 'Candlestick') {
            return this.chart.addCandlestickSeries({
                priceScaleId: 'right',
                upColor: isDark ? '#10b981' : '#059669',
                downColor: isDark ? '#ef4444' : '#dc2626',
                borderDownColor: isDark ? '#ef4444' : '#dc2626',
                borderUpColor: isDark ? '#10b981' : '#059669',
                wickDownColor: isDark ? '#ef444488' : '#dc262688',
                wickUpColor: isDark ? '#10b98188' : '#05966988',
            });
        } else if (type === 'Area') {
            return this.chart.addAreaSeries({
                priceScaleId: 'right',
                lineColor: '#2962FF',
                topColor: '#2962FF',
                bottomColor: 'rgba(41, 98, 255, 0.28)',
            });
        } else {
            return this.chart.addLineSeries({
                priceScaleId: 'right',
                color: '#2962FF',
                lineWidth: 2,
            });
        }
    }

    /** Clean up */
    destroy(): void {
        clearSeriesRegistry(this.chart);
        this.chart.remove();
    }

    /** Add indicator series (Line or Histogram) to a specific panel */
    addIndicatorSeries(type: 'line' | 'histogram', data: any[], options: any = {}, panelIdx: number = 1): ISeriesApi<any> {
        const priceScaleId = this.getIndicatorScaleId(panelIdx);

        let series: ISeriesApi<any>;

        if (type === 'histogram') {
            series = this.chart.addHistogramSeries({
                ...options,
                priceScaleId,
                priceLineVisible: false,
                lastValueVisible: false,
            } as any);
        } else {
            series = this.chart.addLineSeries({
                ...options,
                priceScaleId,
                priceLineVisible: false,
                lastValueVisible: false,
            } as any);
        }

        series.setData(data);
        this.indicatorSeries.add(series);
        this.indicatorScaleBySeries.set(series, priceScaleId);
        if (priceScaleId !== 'right') {
            this.indicatorScales.add(priceScaleId);
        }
        this.applyPaneLayout();
        registerSeries(this.chart, series);
        return series;
    }

    /** Remove a series */
    removeSeries(series: ISeriesApi<any>): void {
        const scaleId = this.indicatorScaleBySeries.get(series);
        if (this.indicatorSeries.has(series)) {
            this.indicatorSeries.delete(series);
            this.indicatorScaleBySeries.delete(series);
            if (scaleId && scaleId !== 'right') {
                let stillUsed = false;
                for (const usedScaleId of this.indicatorScaleBySeries.values()) {
                    if (usedScaleId === scaleId) {
                        stillUsed = true;
                        break;
                    }
                }
                if (!stillUsed) {
                    this.indicatorScales.delete(scaleId);
                }
            }
        }
        unregisterSeries(this.chart, series);
        this.chart.removeSeries(series);
        this.applyPaneLayout();
    }

    private getIndicatorScaleId(panelIdx: number): string {
        if (panelIdx <= 0) return 'right';
        return `indicator_panel_${panelIdx}`;
    }

    private getIndicatorScaleOrder(scaleId: string): number {
        const match = scaleId.match(/_(\d+)$/);
        if (!match) return Number.MAX_SAFE_INTEGER;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    }

    private applyPaneLayout(): void {
        const indicatorScaleIds = [...this.indicatorScales].sort(
            (a, b) => this.getIndicatorScaleOrder(a) - this.getIndicatorScaleOrder(b)
        );
        const hasIndicatorPanes = indicatorScaleIds.length > 0;

        if (hasIndicatorPanes) {
            const indicatorPanelCount = indicatorScaleIds.length;

            // lightweight-charts@4.x has no true multi-pane API. We emulate
            // two panes by assigning non-overlapping scale margins.
            const topPaneTop = 0.02;
            const indicatorAreaTop = indicatorPanelCount === 1 ? 0.66 : 0.56;
            const indicatorAreaBottom = 0.04;
            const paneGap = 0.015;
            const topPaneBottom = Math.max(0.2, 1 - (indicatorAreaTop - paneGap));
            this.mainPaneBottomRatio = 1 - topPaneBottom;

            this.chart.priceScale('right').applyOptions({
                mode: this.scaleMode === 'logarithmic' ? 1 : 0,
                scaleMargins: { top: topPaneTop, bottom: topPaneBottom },
            } as any);
            this.chart.priceScale('left').applyOptions({
                visible: true,
                borderVisible: false,
                scaleMargins: { top: 0, bottom: 0 },
            } as any);

            // Keep volume inside the upper pane.
            this.chart.priceScale('volume').applyOptions({
                visible: false,
                scaleMargins: { top: Math.min(0.88, topPaneBottom + 0.12), bottom: topPaneBottom },
            } as any);

            const totalHeight = Math.max(0.05, 1 - indicatorAreaTop - indicatorAreaBottom);
            const panelHeight = totalHeight / Math.max(1, indicatorScaleIds.length);

            indicatorScaleIds.forEach((scaleId, idx) => {
                const paneTop = indicatorAreaTop + idx * panelHeight;
                const paneBottom = Math.max(0, 1 - (indicatorAreaTop + (idx + 1) * panelHeight));
                this.chart.priceScale(scaleId).applyOptions({
                    visible: true,
                    position: 'left',
                    borderVisible: false,
                    ticksVisible: true,
                    scaleMargins: { top: paneTop, bottom: paneBottom },
                } as any);
            });
            return;
        }

        // Default single-pane layout.
        this.mainPaneBottomRatio = 1;
        this.chart.priceScale('right').applyOptions({
            mode: this.scaleMode === 'logarithmic' ? 1 : 0,
            scaleMargins: { top: 0.1, bottom: 0.25 },
        } as any);

        this.chart.priceScale('volume').applyOptions({
            visible: false,
            scaleMargins: { top: 0.8, bottom: 0 },
        } as any);
        this.chart.priceScale('left').applyOptions({
            visible: false,
        } as any);
    }
}
