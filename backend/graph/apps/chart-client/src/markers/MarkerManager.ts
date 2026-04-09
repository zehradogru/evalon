import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { BacktestEvent, SignalModel } from '@graph/shared-types';

/**
 * MarkerManager — renders backtest trade markers and strategy signal markers
 * using LWC's built-in marker API (setMarkers on the candlestick series).
 */

export interface MarkerConfig {
    backtestVisible: boolean;
    signalsVisible: boolean;
}

interface LWCMarker {
    time: any;
    position: 'aboveBar' | 'belowBar' | 'inBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
    text: string;
    size?: number;
    id?: string;
}

export class MarkerManager {
    // private chart: IChartApi;
    private candleSeries: ISeriesApi<'Candlestick'>;
    private backtestEvents: BacktestEvent[] = [];
    private signals: SignalModel[] = [];
    private config: MarkerConfig = { backtestVisible: true, signalsVisible: true };

    /** Callback when user clicks a marker */
    onMarkerClicked?: (markerId: string, markerType: string, event: BacktestEvent | SignalModel) => void;

    constructor(_chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) {
        // this.chart = chart;
        this.candleSeries = candleSeries;

        // Subscribe to crosshair click for marker detection
        _chart.subscribeCrosshairMove((param) => {
            // Marker click detection happens via the crosshair data
            if (param.time && param.seriesData) {
                // This is a simplified approach; full implementation would use
                // custom hit-testing on marker regions
            }
        });
    }

    /**
     * Rebind marker rendering to the current main series.
     * Needed when chart type switches and the previous series is replaced.
     */
    setSeries(series: ISeriesApi<any>): void {
        this.candleSeries = series as ISeriesApi<'Candlestick'>;
        this.updateMarkers();
    }

    /** Load backtest trade events as markers */
    setBacktestEvents(events: BacktestEvent[]): void {
        this.backtestEvents = events;
        this.updateMarkers();
    }

    /** Load strategy signal markers */
    setSignals(signals: SignalModel[]): void {
        this.signals = signals;
        this.updateMarkers();
    }

    /** Toggle visibility of marker layers */
    setLayerVisibility(layer: 'trades' | 'signals', visible: boolean): void {
        if (layer === 'trades') {
            this.config.backtestVisible = visible;
        } else {
            this.config.signalsVisible = visible;
        }
        this.updateMarkers();
    }

    /** Rebuild and apply all markers to the series */
    private updateMarkers(): void {
        const markers: LWCMarker[] = [];

        // Backtest markers
        if (this.config.backtestVisible) {
            for (const evt of this.backtestEvents) {
                markers.push(this.backtestEventToMarker(evt));
            }
        }

        // Signal markers
        if (this.config.signalsVisible) {
            for (const sig of this.signals) {
                markers.push(this.signalToMarker(sig));
            }
        }

        // Sort by time (required by LWC)
        markers.sort((a, b) => (a.time as number) - (b.time as number));

        this.candleSeries.setMarkers(markers as any);
    }

    /** Convert a backtest event to an LWC marker */
    private backtestEventToMarker(evt: BacktestEvent): LWCMarker {
        const isLong = evt.side === 'long';
        const iconMap: Record<string, { shape: LWCMarker['shape']; color: string; position: LWCMarker['position'] }> = {
            entry: {
                shape: isLong ? 'arrowUp' : 'arrowDown',
                color: isLong ? '#10b981' : '#ef4444',
                position: isLong ? 'belowBar' : 'aboveBar',
            },
            exit: {
                shape: 'circle',
                color: '#6b7280',
                position: isLong ? 'aboveBar' : 'belowBar',
            },
            stop: {
                shape: 'square',
                color: '#ef4444',
                position: isLong ? 'belowBar' : 'aboveBar',
            },
            tp: {
                shape: 'circle',
                color: '#10b981',
                position: isLong ? 'aboveBar' : 'belowBar',
            },
            scale_in: {
                shape: isLong ? 'arrowUp' : 'arrowDown',
                color: '#3b82f6',
                position: isLong ? 'belowBar' : 'aboveBar',
            },
            scale_out: {
                shape: 'circle',
                color: '#f59e0b',
                position: isLong ? 'aboveBar' : 'belowBar',
            },
        };

        const config = iconMap[evt.type] || iconMap.entry;

        const label = evt.pnl !== null
            ? `${evt.type.toUpperCase()} ${evt.pnl >= 0 ? '+' : ''}${evt.pnl.toFixed(2)}`
            : `${evt.type.toUpperCase()} ${evt.side}`;

        return {
            time: evt.time,
            position: config.position,
            color: config.color,
            shape: config.shape,
            text: label,
            size: 1,
            id: evt.id,
        };
    }

    /** Convert a signal to an LWC marker */
    private signalToMarker(sig: SignalModel): LWCMarker {
        const isBuy = sig.side === 'buy';

        return {
            time: sig.time,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#10b981' : '#ef4444',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: sig.label || (isBuy ? 'BUY' : 'SELL'),
            size: 1,
            id: sig.id,
        };
    }

    /** Clear all markers */
    clear(): void {
        this.backtestEvents = [];
        this.signals = [];
        this.candleSeries.setMarkers([]);
    }
}
