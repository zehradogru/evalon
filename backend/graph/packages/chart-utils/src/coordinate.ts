import type { IChartApi, ITimeScaleApi } from 'lightweight-charts';

/**
 * Coordinate transformation utilities.
 * Converts between data-space (time, price) and screen-space (x, y pixels).
 * All drawings store anchors in data-space; these helpers bridge to pixel coords for rendering.
 */

export interface PixelPoint {
    x: number;
    y: number;
}

export interface DataPoint {
    time: number;
    price: number;
}

/**
 * Convert a data-space point (time, price) to pixel coordinates on the chart canvas.
 * Returns null if the point is outside the visible range.
 */
export function dataToPixel(
    chart: IChartApi,
    time: number,
    price: number,
    seriesIndex: number = 0
): PixelPoint | null {
    const timeScale = chart.timeScale();
    // const series = (chart as any)._private__seriesMap?.values()?.[seriesIndex];

    // Use LWC's coordinate conversion APIs
    const x = timeScale.timeToCoordinate(time as any);
    if (x === null) return null;

    // Get the first series for price conversion
    const allSeries = getAllSeries(chart);
    if (allSeries.length === 0) return null;

    const targetSeries = pickTargetSeries(chart, allSeries, seriesIndex);
    const y = targetSeries.priceToCoordinate(price);
    if (y === null) return null;

    return { x, y };
}

/**
 * Convert pixel coordinates to data-space (time, price).
 * Used for hit-testing and placing new anchor points.
 */
export function pixelToData(
    chart: IChartApi,
    x: number,
    y: number,
    seriesIndex: number = 0
): DataPoint | null {
    const timeScale = chart.timeScale();

    const time = timeScale.coordinateToTime(x);
    if (time === null) return null;

    const allSeries = getAllSeries(chart);
    if (allSeries.length === 0) return null;

    const targetSeries = pickTargetSeries(chart, allSeries, seriesIndex);
    const price = targetSeries.coordinateToPrice(y);
    if (price === null) return null;

    return { time: time as number, price };
}

/**
 * Get the visible time range as pixel boundaries.
 * Useful for clipping overlay rendering to the visible area.
 */
export function getVisibleRange(timeScale: ITimeScaleApi<any>): { from: number; to: number } | null {
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return null;
    return { from: range.from, to: range.to };
}

/**
 * Helper to retrieve all series from a chart.
 * LWC doesn't have a public getAllSeries API, so we track series externally via ChartManager.
 */
let _seriesRegistry = new WeakMap<IChartApi, any[]>();
let _primarySeriesRegistry = new WeakMap<IChartApi, any>();

export function registerSeries(chart: IChartApi, series: any): void {
    const existing = _seriesRegistry.get(chart) || [];
    if (!existing.includes(series)) {
        existing.push(series);
    }
    _seriesRegistry.set(chart, existing);
}

export function unregisterSeries(chart: IChartApi, series: any): void {
    const existing = _seriesRegistry.get(chart) || [];
    if (existing.length === 0) return;
    const next = existing.filter((s) => s !== series);
    _seriesRegistry.set(chart, next);
}

export function getAllSeries(chart: IChartApi): any[] {
    return _seriesRegistry.get(chart) || [];
}

export function clearSeriesRegistry(chart: IChartApi): void {
    _seriesRegistry.delete(chart);
    _primarySeriesRegistry.delete(chart);
}

export function setPrimarySeries(chart: IChartApi, series: any): void {
    _primarySeriesRegistry.set(chart, series);
}

function pickTargetSeries(chart: IChartApi, allSeries: any[], seriesIndex: number): any {
    const primary = _primarySeriesRegistry.get(chart);
    if (primary && allSeries.includes(primary)) return primary;

    const indexed = allSeries[seriesIndex];
    if (indexed) return indexed;

    const rightScaleSeries = allSeries.find((series) => {
        try {
            return (series.options?.().priceScaleId ?? 'right') === 'right';
        } catch {
            return false;
        }
    });

    return rightScaleSeries || allSeries[0];
}
