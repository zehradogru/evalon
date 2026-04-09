import type {
    TimeFrame,
    SetSymbolPayload,
    SetTimeframePayload,
    ToggleLayerPayload,
    LoadBacktestPayload,
    SetStrategyPayload,
    SetThemePayload,
    BacktestEventsResponse,
    StrategyDefinition,
    DrawingStyle,
    Anchor,
    SignalModel,
} from '@graph/shared-types';
import { pixelToData, snapToOHLC } from '@graph/chart-utils';

import { ChartManager } from './chart/ChartManager';
import { DataLoader } from './chart/DataLoader';
import { RealtimeStream } from './chart/RealtimeStream';
import { OverlayCanvas } from './overlay/OverlayCanvas';
import { ModeStateMachine, type DrawTool } from './overlay/state/ModeStateMachine';
import { UndoRedoManager } from './overlay/state/UndoRedoManager';
import { TrendlineTool } from './overlay/tools/TrendlineTool';
import { HLineTool } from './overlay/tools/HLineTool';
import { VLineTool } from './overlay/tools/VLineTool';
import { RectangleTool } from './overlay/tools/RectangleTool';
import { FibonacciTool } from './overlay/tools/FibonacciTool';
import { TextTool } from './overlay/tools/TextTool';
import { BaseTool, type ToolEvent } from './overlay/tools/BaseTool';
import { ParallelChannelTool } from './overlay/tools/ParallelChannelTool';
import { MeasureTool } from './overlay/tools/MeasureTool';
import { PositionTool } from './overlay/tools/PositionTool';
import { BrushTool } from './overlay/tools/BrushTool';
import { MarkerManager } from './markers/MarkerManager';
import { BridgeManager } from './bridge/BridgeManager';
import { DrawingStore } from './store/DrawingStore';
import { IndicatorService } from './chart/IndicatorService';
import { StrategyService } from './chart/StrategyService';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const APP_VERSION = '0.1.0';
const LWC_VERSION = '4.2.0';
const SIGNAL_PREVIEW_KEY = 'graph.chart.signal-preview.v1';

type IndicatorOption = { id: string; label: string };
type IndicatorLegendItem = { key: string; strategyId: string; name: string; color: string };
type StrategyLegendItem = { key: string; strategyId: string; name: string; color: string };
type IndicatorParamField = {
    key: string;
    label: string;
    defaultValue: number;
    min?: number;
    max?: number;
    step?: number;
};
type StrategyParamField = IndicatorParamField;

interface DragState {
    drawingId: string;
    hitType: 'anchor' | 'body';
    anchorIndex?: number;
    startDataPoint: Anchor;
    startAnchors: Anchor[];
    latestAnchors: Anchor[];
}

const INDICATOR_PARAM_FIELDS: Partial<Record<string, IndicatorParamField[]>> = {
    sma: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    ema: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    wma: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    dema: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    tema: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    trima: [{ key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 }],
    kama: [{ key: 'period', label: 'Period', defaultValue: 10, min: 1, max: 500, step: 1 }],
    t3: [
        { key: 'period', label: 'Period', defaultValue: 5, min: 1, max: 500, step: 1 },
        { key: 'vfactor', label: 'V Factor', defaultValue: 0.7, min: 0.01, max: 1.0, step: 0.01 },
    ],
    bbands: [
        { key: 'period', label: 'Period', defaultValue: 20, min: 1, max: 500, step: 1 },
        { key: 'nbdevup', label: 'StdDev Up', defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
        { key: 'nbdevdn', label: 'StdDev Down', defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    ],
    rsi: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    stoch: [
        { key: 'fastk_period', label: 'Fast K', defaultValue: 14, min: 1, max: 500, step: 1 },
        { key: 'slowk_period', label: 'Slow K', defaultValue: 3, min: 1, max: 500, step: 1 },
        { key: 'slowd_period', label: 'Slow D', defaultValue: 3, min: 1, max: 500, step: 1 },
    ],
    stochrsi: [
        { key: 'period', label: 'RSI Period', defaultValue: 14, min: 2, max: 500, step: 1 },
        { key: 'fastk_period', label: 'Fast K', defaultValue: 5, min: 1, max: 200, step: 1 },
        { key: 'fastd_period', label: 'Fast D', defaultValue: 3, min: 1, max: 200, step: 1 },
    ],
    cci: [{ key: 'period', label: 'Period', defaultValue: 20, min: 2, max: 500, step: 1 }],
    adx: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    adxr: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    macd: [
        { key: 'fast', label: 'Fast', defaultValue: 12, min: 2, max: 500, step: 1 },
        { key: 'slow', label: 'Slow', defaultValue: 26, min: 2, max: 500, step: 1 },
        { key: 'signal', label: 'Signal', defaultValue: 9, min: 2, max: 500, step: 1 },
    ],
    apo: [
        { key: 'fast', label: 'Fast', defaultValue: 12, min: 2, max: 500, step: 1 },
        { key: 'slow', label: 'Slow', defaultValue: 26, min: 2, max: 500, step: 1 },
    ],
    ppo: [
        { key: 'fast', label: 'Fast', defaultValue: 12, min: 2, max: 500, step: 1 },
        { key: 'slow', label: 'Slow', defaultValue: 26, min: 2, max: 500, step: 1 },
    ],
    mfi: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    willr: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    roc: [{ key: 'period', label: 'Period', defaultValue: 10, min: 1, max: 500, step: 1 }],
    mom: [{ key: 'period', label: 'Period', defaultValue: 10, min: 1, max: 500, step: 1 }],
    ultosc: [
        { key: 'period1', label: 'Period 1', defaultValue: 7, min: 1, max: 500, step: 1 },
        { key: 'period2', label: 'Period 2', defaultValue: 14, min: 1, max: 500, step: 1 },
        { key: 'period3', label: 'Period 3', defaultValue: 28, min: 1, max: 500, step: 1 },
    ],
    atr: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    natr: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    adosc: [
        { key: 'fast', label: 'Fast', defaultValue: 3, min: 1, max: 500, step: 1 },
        { key: 'slow', label: 'Slow', defaultValue: 10, min: 1, max: 500, step: 1 },
    ],
    aroon: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
    aroonosc: [{ key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 500, step: 1 }],
};

const INDICATOR_OPTIONS: IndicatorOption[] = [
    { id: 'sma', label: 'SMA' },
    { id: 'ema', label: 'EMA' },
    { id: 'wma', label: 'WMA' },
    { id: 'dema', label: 'DEMA' },
    { id: 'tema', label: 'TEMA' },
    { id: 'trima', label: 'TRIMA' },
    { id: 'kama', label: 'KAMA' },
    { id: 't3', label: 'T3' },
    { id: 'bbands', label: 'Bollinger Bands' },
    { id: 'rsi', label: 'RSI' },
    { id: 'stoch', label: 'Stochastic' },
    { id: 'stochrsi', label: 'Stoch RSI' },
    { id: 'cci', label: 'CCI' },
    { id: 'adx', label: 'ADX' },
    { id: 'adxr', label: 'ADXR' },
    { id: 'macd', label: 'MACD' },
    { id: 'apo', label: 'APO' },
    { id: 'ppo', label: 'PPO' },
    { id: 'mfi', label: 'MFI' },
    { id: 'willr', label: 'Williams %R' },
    { id: 'roc', label: 'ROC' },
    { id: 'mom', label: 'MOM' },
    { id: 'ultosc', label: 'Ultimate Oscillator' },
    { id: 'atr', label: 'ATR' },
    { id: 'natr', label: 'NATR' },
    { id: 'obv', label: 'OBV' },
    { id: 'ad', label: 'Chaikin A/D' },
    { id: 'adosc', label: 'Chaikin Oscillator' },
    { id: 'aroon', label: 'Aroon' },
    { id: 'aroonosc', label: 'Aroon Oscillator' },
];

const INDICATOR_LABEL_BY_ID = new Map(INDICATOR_OPTIONS.map((opt) => [opt.id, opt.label]));
const STRATEGY_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#a855f7'];

const FALLBACK_STRATEGIES: StrategyDefinition[] = [
    {
        id: 'rsi',
        label: 'RSI Strategy',
        params: [
            { key: 'period', label: 'Period', type: 'number', defaultValue: 14, min: 2, max: 300, step: 1 },
            { key: 'entryLevel', label: 'Entry Level', type: 'number', defaultValue: 30, min: 1, max: 99, step: 0.5 },
        ],
    },
    {
        id: 'macd',
        label: 'MACD Strategy',
        params: [
            { key: 'fast', label: 'Fast', type: 'number', defaultValue: 12, min: 2, max: 300, step: 1 },
            { key: 'slow', label: 'Slow', type: 'number', defaultValue: 26, min: 2, max: 400, step: 1 },
            { key: 'signal', label: 'Signal', type: 'number', defaultValue: 9, min: 2, max: 300, step: 1 },
        ],
    },
];

function normalizeIndicatorId(name: string): string | null {
    const key = name.trim().toLowerCase();
    if (INDICATOR_LABEL_BY_ID.has(key)) return key;

    const compact = key.replace(/[\s_%/-]+/g, '');
    for (const opt of INDICATOR_OPTIONS) {
        const idCompact = opt.id.replace(/[\s_%/-]+/g, '');
        const labelCompact = opt.label.toLowerCase().replace(/[\s_%/-]+/g, '');
        if (compact === idCompact || compact === labelCompact) {
            return opt.id;
        }
    }
    return null;
}

function normalizeStrategyId(name: string): string {
    return name.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

interface InitialChartConfig {
    symbol: string;
    tf: TimeFrame;
}

interface SignalPreviewPayload {
    symbol: string;
    tf: TimeFrame;
    generatedAt: number;
    signals: SignalModel[];
}

declare global {
    interface Window {
        __GRAPH_INIT__?: {
            symbol?: string;
            tf?: string;
            timeframe?: string;
        };
    }
}

const VALID_TIMEFRAMES: readonly TimeFrame[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w', '1M'] as const;

function sanitizeSymbol(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = raw.trim().toUpperCase();
    if (!cleaned) return null;
    return cleaned;
}

function isValidTimeframe(raw: string | null | undefined): raw is TimeFrame {
    if (!raw) return false;
    return (VALID_TIMEFRAMES as readonly string[]).includes(raw);
}

function resolveInitialChartConfig(): InitialChartConfig {
    const query = new URLSearchParams(window.location.search);
    const globalInit = window.__GRAPH_INIT__;

    const querySymbol = sanitizeSymbol(query.get('symbol') || query.get('ticker'));
    const globalSymbol = sanitizeSymbol(globalInit?.symbol);
    const symbol = querySymbol || globalSymbol || 'THYAO';

    const queryTf = query.get('tf') || query.get('timeframe');
    const globalTf = globalInit?.tf || globalInit?.timeframe;
    const tf = isValidTimeframe(queryTf) ? queryTf : isValidTimeframe(globalTf) ? globalTf : '1h';

    return { symbol, tf };
}

function readSignalPreviewFromStorage(): SignalPreviewPayload | null {
    const query = new URLSearchParams(window.location.search);
    if (query.get('signalPreview') !== '1') return null;

    try {
        const raw = window.localStorage.getItem(SIGNAL_PREVIEW_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SignalPreviewPayload;
        return isValidTimeframe(parsed.tf) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Main application entry point.
 * Wires together all modules: ChartManager, DataLoader, RealtimeStream,
 * OverlayCanvas, drawing tools, MarkerManager, BridgeManager.
 */

// ─── DOM Elements ──────────────────────────────────────────────
const chartContainer = document.getElementById('chart')!;
const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
const toolbar = document.getElementById('toolbar')!;

// ─── Core Instances ────────────────────────────────────────────
const chartManager = new ChartManager({ container: chartContainer, theme: 'dark' });
const dataLoader = new DataLoader(chartManager);
const realtimeStream = new RealtimeStream();
const overlay = new OverlayCanvas(overlayCanvas, chartManager.getChart());
const modeFSM = new ModeStateMachine();
const undoRedo = new UndoRedoManager();
const drawingStore = new DrawingStore();
const markerManager = new MarkerManager(chartManager.getChart(), chartManager.getCandleSeries());
const signalPreview = readSignalPreviewFromStorage();
const bridge = new BridgeManager();

let activeTool: BaseTool | null = null;
let magnetOn = false;
let selectedDrawingId: string | null = null;
let activeDrag: DragState | null = null;
let indicatorParamPanel: HTMLDivElement | null = null;
let indicatorParamForm: HTMLFormElement | null = null;
let indicatorParamTitle: HTMLDivElement | null = null;
let indicatorParamApplyBtn: HTMLButtonElement | null = null;
let indicatorParamRemoveBtn: HTMLButtonElement | null = null;
let indicatorParamTarget: string | null = null;
let strategyParamPanel: HTMLDivElement | null = null;
let strategyParamForm: HTMLFormElement | null = null;
let strategyParamTitle: HTMLDivElement | null = null;
let strategyParamApplyBtn: HTMLButtonElement | null = null;
let strategyParamRemoveBtn: HTMLButtonElement | null = null;
let strategyParamTarget: string | null = null;

const priceAxisMask = document.createElement('div');
priceAxisMask.className = 'price-axis-mask';
chartContainer.appendChild(priceAxisMask);

const chartLoadStatus = document.createElement('div');
chartLoadStatus.className = 'chart-load-status';
chartLoadStatus.setAttribute('aria-live', 'polite');
chartContainer.appendChild(chartLoadStatus);

function shouldEnableRealtime(symbol: string): boolean {
    return symbol.trim().toUpperCase() !== 'TEST';
}

function syncRealtimeSubscription(symbol: string, tf: TimeFrame): void {
    realtimeStream.unsubscribe();
    if (shouldEnableRealtime(symbol)) {
        realtimeStream.subscribe(symbol, tf);
    }
}

function normalizeDrawingStyle(style: Partial<DrawingStyle>): DrawingStyle {
    return {
        color: '#3b82f6',
        width: 2,
        dash: [],
        opacity: 1.0,
        ...style,
    };
}

function toRawAnchor(offsetX: number, offsetY: number): Anchor | null {
    const point = pixelToData(chartManager.getChart(), offsetX, offsetY);
    if (!point) return null;

    const height = overlayCanvas.getBoundingClientRect().height;
    const chartOptions = chartManager.getChart().options() as any;
    const margins = chartOptions?.rightPriceScale?.scaleMargins || { top: 0, bottom: 0 };
    const topY = Math.max(0, Math.floor((margins.top ?? 0) * height));
    const bottomY = Math.max(topY + 1, Math.ceil((1 - (margins.bottom ?? 0)) * height));

    const series = chartManager.getMainSeries();
    const topPrice = series.coordinateToPrice(topY);
    const bottomPrice = series.coordinateToPrice(bottomY);
    let price = point.price;
    if (topPrice !== null && bottomPrice !== null) {
        const min = Math.min(topPrice, bottomPrice);
        const max = Math.max(topPrice, bottomPrice);
        price = Math.max(min, Math.min(max, point.price));
    }

    return { time: Math.round(point.time), price };
}

function toToolAnchor(offsetX: number, offsetY: number): Anchor | null {
    const point = toRawAnchor(offsetX, offsetY);
    if (!point) return null;
    if (!magnetOn) {
        return point;
    }

    const snapped = snapToOHLC(
        point.time,
        point.price,
        dataLoader.getData(),
        (price) => chartManager.getMainSeries().priceToCoordinate(price)
    );
    return { time: snapped.time, price: snapped.price };
}

function toCanvasPoint(e: MouseEvent): { x: number; y: number } {
    const rect = overlayCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function syncPriceAxisMask(): void {
    const ratio = chartManager.getMainPaneBottomRatio();
    if (ratio >= 0.999) {
        priceAxisMask.style.display = 'none';
        return;
    }

    priceAxisMask.style.display = 'block';
    priceAxisMask.style.top = `${(ratio * 100).toFixed(2)}%`;
}

function setChartLoadStatus(message: string | null): void {
    if (!message) {
        chartLoadStatus.classList.remove('visible');
        chartLoadStatus.textContent = '';
        return;
    }

    chartLoadStatus.textContent = message;
    chartLoadStatus.classList.add('visible');
}

function setSelectedDrawing(id: string | null): void {
    selectedDrawingId = id;
    overlay.setSelected(id);
}

// ─── Drawing Store → Overlay sync ──────────────────────────────
drawingStore.onChange((drawings) => {
    overlay.setDrawings(drawings);
    if (selectedDrawingId && !drawings.some((d) => d.id === selectedDrawingId)) {
        setSelectedDrawing(null);
        if (modeFSM.isEdit()) {
            modeFSM.deselect();
        }
    }
});

// ─── Realtime Stream Events ────────────────────────────────────
realtimeStream.onBarUpdate = (candle) => {
    chartManager.updateBar(candle);
};

realtimeStream.onNewBar = (candle) => {
    chartManager.updateBar(candle);
};

// ─── Tool Event Handler ────────────────────────────────────────
function handleToolEvent(event: ToolEvent): void {
    switch (event.type) {
        case 'preview_update':
            // Construct a temporary preview model to show on the overlay
            if (activeTool) {
                const style = normalizeDrawingStyle({
                    ...activeTool.defaultStyle,
                    ...(event.style || {}),
                });
                const previewModel: any = {
                    id: 'preview',
                    type: activeTool.drawingType,
                    style,
                    anchors: [...event.anchors],
                    meta: { hidden: false, locked: false, name: 'Preview' },
                };
                if (event.previewAnchor) {
                    previewModel.anchors.push(event.previewAnchor);
                }
                overlay.setPreviewDrawing(previewModel);
            }
            break;

        case 'complete':
            if (activeTool) {
                const type = activeTool.drawingType;
                const style = normalizeDrawingStyle({
                    ...activeTool.defaultStyle,
                    ...(event.style || {}),
                });
                drawingStore.create(type, event.anchors, style);

                undoRedo.push({
                    type: 'create',
                    drawingId: '', // will be updated after create returns
                    before: null,
                    after: { type, anchors: event.anchors, style },
                });

                modeFSM.drawingCompleted();

                // Emit bridge event
                bridge.sendEvent('drawingCreated', {
                    drawingId: '',
                    type,
                    anchors: event.anchors,
                });
            }
            overlay.setPreviewDrawing(null);
            break;

        case 'cancel':
            overlay.setPreviewDrawing(null);
            modeFSM.deselect();
            break;
    }
}

// ─── Tool Factory ──────────────────────────────────────────────
function createTool(toolName: DrawTool): BaseTool {
    switch (toolName) {
        case 'trendline': return new TrendlineTool(handleToolEvent);
        case 'horizontal_line': return new HLineTool(handleToolEvent);
        case 'vertical_line': return new VLineTool(handleToolEvent);
        case 'rectangle': return new RectangleTool(handleToolEvent);
        case 'fibonacci': return new FibonacciTool(handleToolEvent);
        case 'parallel_channel': return new ParallelChannelTool(handleToolEvent);
        case 'measure': return new MeasureTool(handleToolEvent);
        case 'brush': return new BrushTool(handleToolEvent);
        case 'long_position': return new PositionTool(handleToolEvent, 'long_position');
        case 'short_position': return new PositionTool(handleToolEvent, 'short_position');
        case 'text': return new TextTool(handleToolEvent);
    }
}

// ─── Mode Change Handler ───────────────────────────────────────
modeFSM.onChange((state) => {
    // Update overlay interactivity
    overlay.setInteractive(state.mode !== 'explore');

    // Update cursor
    overlayCanvas.style.cursor =
        state.mode === 'draw'
            ? 'crosshair'
            : state.mode === 'edit'
                ? 'grab'
                : 'default';

    // Create or destroy active tool
    if (state.mode === 'draw' && state.activeTool) {
        activeTool = createTool(state.activeTool);
        activeTool.setMagnet(magnetOn);
    } else {
        activeTool = null;
    }

    // Update toolbar visual state
    updateToolbarState(state.mode, state.activeTool);

    // Update mode indicator
    const indicator = toolbar.querySelector('.mode-indicator') as HTMLElement;
    if (indicator) {
        indicator.textContent = state.mode.toUpperCase();
        indicator.setAttribute('data-mode', state.mode);
    }

    if (state.mode !== 'edit') {
        activeDrag = null;
    }
});

// ─── Canvas Mouse/Touch Events ─────────────────────────────────
function getDrawingCloneAnchors(drawingId: string): Anchor[] | null {
    const drawing = drawingStore.get(drawingId);
    if (!drawing) return null;
    return drawing.anchors.map((a) => ({ ...a }));
}

function buildDraggedAnchors(drawingId: string, drag: DragState, currentPoint: Anchor): Anchor[] {
    const drawing = drawingStore.get(drawingId);
    const type = drawing?.type;
    const dt = currentPoint.time - drag.startDataPoint.time;
    const dp = currentPoint.price - drag.startDataPoint.price;

    if (drag.hitType === 'anchor' && Number.isInteger(drag.anchorIndex)) {
        const next = drag.startAnchors.map((a) => ({ ...a }));
        const idx = drag.anchorIndex as number;
        if (!next[idx]) return next;

        if (type === 'horizontal_line') {
            next[idx] = { ...next[idx], price: currentPoint.price };
            return next;
        }

        if (type === 'vertical_line') {
            next[idx] = { ...next[idx], time: currentPoint.time };
            return next;
        }

        next[idx] = { time: currentPoint.time, price: currentPoint.price };
        return next;
    }

    return drag.startAnchors.map((a) => {
        if (type === 'horizontal_line') {
            return { ...a, price: a.price + dp };
        }
        if (type === 'vertical_line') {
            return { ...a, time: Math.round(a.time + dt) };
        }
        return { time: Math.round(a.time + dt), price: a.price + dp };
    });
}

function startEditingFromHit(hit: { drawingId: string; hitType: 'anchor' | 'body'; anchorIndex?: number }, point: { x: number; y: number }): void {
    const startPoint = toRawAnchor(point.x, point.y);
    const startAnchors = getDrawingCloneAnchors(hit.drawingId);
    if (!startPoint || !startAnchors) return;

    setSelectedDrawing(hit.drawingId);
    modeFSM.selectDrawing();
    activeDrag = {
        drawingId: hit.drawingId,
        hitType: hit.hitType,
        anchorIndex: hit.anchorIndex,
        startDataPoint: startPoint,
        startAnchors,
        latestAnchors: startAnchors.map((a) => ({ ...a })),
    };
    overlayCanvas.style.cursor = 'grabbing';
}

function applyDragMove(clientX: number, clientY: number): void {
    if (!activeDrag) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const currentPoint = toRawAnchor(offsetX, offsetY);
    if (!currentPoint) return;

    const nextAnchors = buildDraggedAnchors(activeDrag.drawingId, activeDrag, currentPoint);
    activeDrag.latestAnchors = nextAnchors;
    void drawingStore.update(activeDrag.drawingId, { anchors: nextAnchors }, { sync: false });
}

function finishDrag(): void {
    if (!activeDrag) return;
    const { drawingId, latestAnchors } = activeDrag;
    activeDrag = null;
    void drawingStore.update(drawingId, { anchors: latestAnchors }, { sync: true });
    overlayCanvas.style.cursor = modeFSM.isEdit() ? 'grab' : 'default';
}

overlayCanvas.addEventListener('mousedown', (e) => {
    if (activeTool) {
        const anchor = toToolAnchor(e.offsetX, e.offsetY);
        if (anchor) {
            activeTool.onAnchorPlaced(anchor);
        }
        return;
    }

    const hit = overlay.hitTest(e.offsetX, e.offsetY);
    if (hit) {
        e.preventDefault();
        e.stopPropagation();
        startEditingFromHit(hit, { x: e.offsetX, y: e.offsetY });
        return;
    }

    if (modeFSM.isEdit()) {
        setSelectedDrawing(null);
        modeFSM.deselect();
    }
});

overlayCanvas.addEventListener('mousemove', (e) => {
    if (activeTool) {
        const anchor = toToolAnchor(e.offsetX, e.offsetY);
        if (anchor) {
            activeTool.onPreviewMove(anchor);
        }
        return;
    }

    if (activeDrag) {
        e.preventDefault();
        applyDragMove(e.clientX, e.clientY);
        return;
    }

    if (modeFSM.isEdit()) {
        const hit = overlay.hitTest(e.offsetX, e.offsetY);
        overlayCanvas.style.cursor = hit ? (hit.hitType === 'anchor' ? 'grab' : 'move') : 'default';
    }
});

overlayCanvas.addEventListener('mouseup', () => {
    finishDrag();
});

window.addEventListener('mousemove', (e) => {
    if (!activeDrag) return;
    e.preventDefault();
    applyDragMove(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
    finishDrag();
});

chartContainer.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('#indicator-param-panel') || target?.closest('#strategy-param-panel')) return;
    if (!modeFSM.isExplore()) return;
    const point = toCanvasPoint(e);
    const hit = overlay.hitTest(point.x, point.y);
    if (!hit) return;

    e.preventDefault();
    e.stopPropagation();
    startEditingFromHit(hit, point);
}, true);

// ─── Keyboard Shortcuts ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
    }

    // Escape → deselect / cancel
    if (e.key === 'Escape') {
        if (indicatorParamPanel && !indicatorParamPanel.classList.contains('hidden')) {
            indicatorParamPanel.classList.add('hidden');
            indicatorParamTarget = null;
        }
        if (strategyParamPanel && !strategyParamPanel.classList.contains('hidden')) {
            strategyParamPanel.classList.add('hidden');
            strategyParamTarget = null;
        }
        if (activeTool) activeTool.cancel();
        finishDrag();
        setSelectedDrawing(null);
        modeFSM.deselect();
    }

    // Ctrl+Z → Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const action = undoRedo.undo();
        if (action) {
            if (action.type === 'create') {
                drawingStore.delete(action.drawingId);
            } else if (action.type === 'delete' && action.before) {
                drawingStore.restore(action.before as any);
            }
            // update actions would restore previous state
        }
    }

    // Ctrl+Shift+Z → Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        const action = undoRedo.redo();
        if (action) {
            if (action.type === 'create' && action.after) {
                drawingStore.create(
                    (action.after as any).type,
                    (action.after as any).anchors,
                    (action.after as any).style || {}
                );
            } else if (action.type === 'delete') {
                drawingStore.delete(action.drawingId);
            }
        }
    }

    // Delete → delete selected drawing
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedDrawingId) return;
        e.preventDefault();
        const id = selectedDrawingId;
        setSelectedDrawing(null);
        modeFSM.deselect();
        void drawingStore.delete(id);
    }
});

class IndicatorManager {
    private activeIndicators: Set<string> = new Set();
    private currentSeries: Map<string, any[]> = new Map();
    private paramsByIndicator: Map<string, Record<string, unknown>> = new Map();
    private selectionListeners: Array<() => void> = [];
    private legendItems: IndicatorLegendItem[] = [];
    private legendListeners: Array<(items: IndicatorLegendItem[]) => void> = [];

    constructor() { }

    hasActiveIndicators(): boolean {
        return this.activeIndicators.size > 0;
    }

    isActive(name: string): boolean {
        const normalized = this.normalizeName(name);
        if (!normalized) return false;
        return this.activeIndicators.has(normalized);
    }

    getParams(name: string): Record<string, unknown> {
        const normalized = this.normalizeName(name);
        if (!normalized) return {};
        return { ...(this.paramsByIndicator.get(normalized) || {}) };
    }

    onSelectionChange(listener: () => void): void {
        this.selectionListeners.push(listener);
    }

    onLegendChange(listener: (items: IndicatorLegendItem[]) => void): void {
        this.legendListeners.push(listener);
    }

    private emitSelectionChange(): void {
        this.selectionListeners.forEach((listener) => listener());
    }

    getLegendItems(): IndicatorLegendItem[] {
        return [...this.legendItems];
    }

    private emitLegendChange(): void {
        const snapshot = this.getLegendItems();
        this.legendListeners.forEach((listener) => listener(snapshot));
    }

    async toggle(name: string): Promise<void> {
        const normalized = this.normalizeName(name);
        if (!normalized) return;

        if (this.activeIndicators.has(normalized)) {
            this.remove(normalized);
        } else {
            await this.add(normalized);
        }
    }

    async add(name: string, params: Record<string, unknown> = {}): Promise<void> {
        const normalized = this.normalizeName(name);
        if (!normalized) return;

        this.activeIndicators.add(normalized);
        this.emitSelectionChange();
        const existing = this.paramsByIndicator.get(normalized) || {};
        this.paramsByIndicator.set(normalized, { ...existing, ...params });
        await this.refresh();
    }

    async updateParams(name: string, params: Record<string, unknown>): Promise<void> {
        const normalized = this.normalizeName(name);
        if (!normalized) return;

        const existing = this.paramsByIndicator.get(normalized) || {};
        this.paramsByIndicator.set(normalized, { ...existing, ...params });
        if (this.activeIndicators.has(normalized)) {
            await this.refresh();
        }
    }

    remove(name: string): void {
        const normalized = this.normalizeName(name);
        if (!normalized) return;

        this.activeIndicators.delete(normalized);
        this.emitSelectionChange();
        // Remove series from chart
        const seriesList = this.currentSeries.get(normalized);
        if (seriesList) {
            seriesList.forEach((s) => chartManager.removeSeries(s));
            this.currentSeries.delete(normalized);
        }
        this.legendItems = this.legendItems.filter((item) => item.strategyId !== normalized);
        this.emitLegendChange();
        overlay.invalidate();
        syncPriceAxisMask();
    }

    async applyStrategy(strategyId: string, params: Record<string, unknown> = {}): Promise<void> {
        const normalized = this.normalizeName(strategyId);
        if (!normalized) return;
        await this.add(normalized, params);
    }

    async refresh(): Promise<void> {
        // 1. Clean existing rendered indicator series
        this.currentSeries.forEach((seriesList) => {
            seriesList.forEach((s) => chartManager.removeSeries(s));
        });
        this.currentSeries.clear();

        // 2. Fetch and draw enabled indicators
        const symbol = dataLoader.getSymbol();
        const tf = dataLoader.getTimeframe();
        const candles = dataLoader.getData();
        const oldest = candles.length > 0 ? candles[0].t : undefined;
        const newest = candles.length > 0 ? candles[candles.length - 1].t : undefined;
        const rangeParams: Record<string, unknown> = {};
        if (typeof oldest === 'number') {
            rangeParams.start = new Date(oldest * 1000).toISOString();
        }
        if (typeof newest === 'number') {
            rangeParams.end = new Date(newest * 1000).toISOString();
        }
        if (candles.length > 0) {
            rangeParams.limit = Math.min(candles.length, 200_000);
        }
        const service = IndicatorService.getInstance();
        const nextLegend: IndicatorLegendItem[] = [];

        for (const name of this.activeIndicators) {
            const strategyKey = name.toLowerCase();
            const params = this.paramsByIndicator.get(name) || {};
            const indicators = await service.fetchIndicators(symbol, tf, strategyKey, {
                ...params,
                ...rangeParams,
            });

            const addedSeries: any[] = [];
            indicators.forEach((ind) => {
                const options = {
                    color: ind.options?.color || '#2962FF',
                    lineWidth: ind.options?.lineWidth || 1,
                    lineStyle: ind.options?.lineStyle || 0,
                    ...(ind.type === 'histogram' ? { color: ind.options?.color } : {}),
                };

                const series = chartManager.addIndicatorSeries(
                    ind.type,
                    ind.data,
                    options,
                    ind.panel
                );
                addedSeries.push(series);

                const firstDataColor = ind.data.find((d: any) => typeof d?.color === 'string')?.color as string | undefined;
                const label = ind.name || INDICATOR_LABEL_BY_ID.get(name) || name.toUpperCase();
                nextLegend.push({
                    key: `${name}:${label}:${nextLegend.length}`,
                    strategyId: name,
                    name: label,
                    color: (ind.options?.color as string) || firstDataColor || '#60a5fa',
                });
            });
            this.currentSeries.set(name, addedSeries);
        }
        this.legendItems = nextLegend;
        this.emitLegendChange();

        // Price-scale/pane updates do not always trigger overlay redraw events.
        // Force a redraw so existing drawings stay aligned after indicator toggles.
        overlay.invalidate();
        syncPriceAxisMask();
    }

    private normalizeName(name: string): string | null {
        return normalizeIndicatorId(name);
    }
}

class StrategyManager {
    private service = StrategyService.getInstance();
    private activeStrategies: Set<string> = new Set();
    private paramsByStrategy: Map<string, Record<string, unknown>> = new Map();
    private combineMode: 'and' | 'or' = 'or';
    private selectionListeners: Array<() => void> = [];
    private legendListeners: Array<(items: StrategyLegendItem[]) => void> = [];
    private catalogListeners: Array<(defs: StrategyDefinition[]) => void> = [];
    private statusListeners: Array<(message: string, isError: boolean) => void> = [];
    private legendItems: StrategyLegendItem[] = [];
    private definitions: StrategyDefinition[] = [...FALLBACK_STRATEGIES];

    async init(): Promise<void> {
        const defs = await this.service.fetchCatalog();
        if (defs.length > 0) {
            this.definitions = defs.map((def) => ({
                ...def,
                id: normalizeStrategyId(def.id),
            }));
            this.emitCatalogChange();
        }
    }

    hasActiveStrategies(): boolean {
        return this.activeStrategies.size > 0;
    }

    getDefinitions(): StrategyDefinition[] {
        return [...this.definitions];
    }

    getCombineMode(): 'and' | 'or' {
        return this.combineMode;
    }

    async setCombineMode(mode: 'and' | 'or'): Promise<void> {
        if (this.combineMode === mode) return;
        this.combineMode = mode;
        if (this.activeStrategies.size > 0) {
            await this.refresh();
        }
    }

    getParams(name: string): Record<string, unknown> {
        const normalized = normalizeStrategyId(name);
        return { ...(this.paramsByStrategy.get(normalized) || {}) };
    }

    isActive(name: string): boolean {
        return this.activeStrategies.has(normalizeStrategyId(name));
    }

    getFields(name: string): StrategyParamField[] {
        const normalized = normalizeStrategyId(name);
        const def = this.definitions.find((item) => item.id === normalized);
        if (!def) return [];
        return def.params.map((param) => ({
            key: param.key,
            label: param.label,
            defaultValue: param.defaultValue,
            min: param.min,
            max: param.max,
            step: param.step,
        }));
    }

    onSelectionChange(listener: () => void): void {
        this.selectionListeners.push(listener);
    }

    onLegendChange(listener: (items: StrategyLegendItem[]) => void): void {
        this.legendListeners.push(listener);
    }

    onCatalogChange(listener: (defs: StrategyDefinition[]) => void): void {
        this.catalogListeners.push(listener);
    }

    onStatusChange(listener: (message: string, isError: boolean) => void): void {
        this.statusListeners.push(listener);
    }

    private emitSelectionChange(): void {
        this.selectionListeners.forEach((listener) => listener());
    }

    private emitLegendChange(): void {
        const snapshot = this.getLegendItems();
        this.legendListeners.forEach((listener) => listener(snapshot));
    }

    private emitCatalogChange(): void {
        const defs = this.getDefinitions();
        this.catalogListeners.forEach((listener) => listener(defs));
    }

    private emitStatus(message: string, isError: boolean = false): void {
        this.statusListeners.forEach((listener) => listener(message, isError));
    }

    getLegendItems(): StrategyLegendItem[] {
        return [...this.legendItems];
    }

    async add(name: string, params: Record<string, unknown> = {}): Promise<void> {
        const normalized = normalizeStrategyId(name);
        if (!normalized) return;
        if (!this.definitions.some((def) => def.id === normalized)) return;

        this.activeStrategies.add(normalized);
        const existing = this.paramsByStrategy.get(normalized) || {};
        this.paramsByStrategy.set(normalized, { ...existing, ...params });
        this.rebuildLegend();
        this.emitSelectionChange();
        await this.refresh();
    }

    async updateParams(name: string, params: Record<string, unknown>): Promise<void> {
        const normalized = normalizeStrategyId(name);
        if (!normalized) return;

        const existing = this.paramsByStrategy.get(normalized) || {};
        this.paramsByStrategy.set(normalized, { ...existing, ...params });
        if (this.activeStrategies.has(normalized)) {
            await this.refresh();
        }
    }

    remove(name: string): void {
        const normalized = normalizeStrategyId(name);
        if (!normalized) return;

        this.activeStrategies.delete(normalized);
        this.rebuildLegend();
        this.emitSelectionChange();

        if (this.activeStrategies.size === 0) {
            markerManager.setSignals([]);
            this.emitStatus('No active strategy.', false);
            return;
        }

        void this.refresh();
    }

    async refresh(): Promise<void> {
        if (this.activeStrategies.size === 0) {
            markerManager.setSignals([]);
            this.emitStatus('No active strategy.', false);
            return;
        }

        const candles = dataLoader.getData();
        if (candles.length === 0) {
            markerManager.setSignals([]);
            this.emitStatus('No candle data in current range.', true);
            return;
        }

        const oldest = candles[0].t;
        const newest = candles[candles.length - 1].t;
        const strategies = [...this.activeStrategies].map((id) => ({
            id,
            params: this.paramsByStrategy.get(id) || {},
        }));

        try {
            const signals = await this.service.runSignals({
                symbol: dataLoader.getSymbol(),
                tf: dataLoader.getTimeframe(),
                range: { from: oldest, to: newest },
                strategies,
                combine: this.combineMode,
            });
            markerManager.setSignals(signals);

            if (signals.length === 0) {
                this.emitStatus(`No BUY signals (${this.combineMode.toUpperCase()}).`, false);
            } else {
                this.emitStatus(`Signals: ${signals.length} (${this.combineMode.toUpperCase()})`, false);
            }
        } catch (err) {
            markerManager.setSignals([]);
            this.emitStatus(`Signal request failed: ${(err as Error).message}`, true);
        }
    }

    private rebuildLegend(): void {
        const defs = new Map(this.definitions.map((def) => [def.id, def]));
        this.legendItems = [...this.activeStrategies].map((id, index) => {
            const def = defs.get(id);
            return {
                key: `strategy:${id}`,
                strategyId: id,
                name: def?.label || id.toUpperCase(),
                color: STRATEGY_COLORS[index % STRATEGY_COLORS.length],
            };
        });
        this.emitLegendChange();
    }
}

const indicatorManager = new IndicatorManager();
const strategyManager = new StrategyManager();

function applySignalPreviewIfRelevant(symbol: string, tf: TimeFrame): void {
    if (!signalPreview) return;
    if (signalPreview.symbol === symbol && signalPreview.tf === tf) {
        markerManager.setSignals(signalPreview.signals);
        return;
    }
    if (!strategyManager.hasActiveStrategies()) {
        markerManager.setSignals([]);
    }
}

dataLoader.onHistoricalDataLoaded = () => {
    if (indicatorManager.hasActiveIndicators()) {
        void indicatorManager.refresh();
    }
    if (strategyManager.hasActiveStrategies()) {
        void strategyManager.refresh();
    } else {
        applySignalPreviewIfRelevant(dataLoader.getSymbol(), dataLoader.getTimeframe());
    }
};

async function loadChartContext(
    symbol: string,
    tf: TimeFrame,
    message: string = `Loading ${symbol} ${tf} price data...`
): Promise<void> {
    setChartLoadStatus(message);
    try {
        await dataLoader.load(symbol, tf);
        await drawingStore.load(symbol, tf);
        await indicatorManager.refresh();
        await strategyManager.refresh();
        applySignalPreviewIfRelevant(symbol, tf);
        syncRealtimeSubscription(symbol, tf);
        syncPriceAxisMask();
    } finally {
        setChartLoadStatus(null);
    }
}

function getIndicatorParamFields(indicatorId: string): IndicatorParamField[] {
    const fields = INDICATOR_PARAM_FIELDS[indicatorId];
    return fields ? [...fields] : [];
}

function hideIndicatorParamPanel(): void {
    if (!indicatorParamPanel) return;
    indicatorParamPanel.classList.add('hidden');
    indicatorParamTarget = null;
}

function ensureIndicatorParamPanel(): void {
    if (indicatorParamPanel) return;

    const panel = document.createElement('div');
    panel.id = 'indicator-param-panel';
    panel.className = 'panel indicator-param-panel hidden';

    const title = document.createElement('div');
    title.className = 'indicator-param-title';
    panel.appendChild(title);

    const form = document.createElement('form');
    form.className = 'indicator-param-form';
    panel.appendChild(form);

    const actions = document.createElement('div');
    actions.className = 'indicator-param-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'indicator-param-btn secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => hideIndicatorParamPanel());
    actions.appendChild(cancelBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'indicator-param-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        if (!indicatorParamTarget) return;
        indicatorManager.remove(indicatorParamTarget);
        hideIndicatorParamPanel();
    });
    actions.appendChild(removeBtn);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'indicator-param-btn primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
        form.requestSubmit();
    });
    actions.appendChild(applyBtn);

    panel.appendChild(actions);
    chartContainer.appendChild(panel);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!indicatorParamTarget || !indicatorParamForm) return;

        const params: Record<string, unknown> = {};
        const fields = getIndicatorParamFields(indicatorParamTarget);
        fields.forEach((field) => {
            const input = indicatorParamForm?.querySelector<HTMLInputElement>(`input[name="${field.key}"]`);
            if (!input) return;
            const parsed = Number(input.value);
            if (Number.isFinite(parsed)) {
                params[field.key] = parsed;
            }
        });

        if (indicatorManager.isActive(indicatorParamTarget)) {
            await indicatorManager.updateParams(indicatorParamTarget, params);
        } else {
            await indicatorManager.add(indicatorParamTarget, params);
        }
        hideIndicatorParamPanel();
    });

    indicatorParamPanel = panel;
    indicatorParamForm = form;
    indicatorParamTitle = title;
    indicatorParamApplyBtn = applyBtn;
    indicatorParamRemoveBtn = removeBtn;
}

function openIndicatorParamPanel(indicatorId: string): void {
    ensureIndicatorParamPanel();
    if (!indicatorParamPanel || !indicatorParamForm || !indicatorParamTitle || !indicatorParamApplyBtn || !indicatorParamRemoveBtn) {
        return;
    }

    const normalized = normalizeIndicatorId(indicatorId);
    if (!normalized) return;

    indicatorParamTarget = normalized;
    const label = INDICATOR_LABEL_BY_ID.get(normalized) || normalized.toUpperCase();
    const active = indicatorManager.isActive(normalized);
    const existing = indicatorManager.getParams(normalized);
    const fields = getIndicatorParamFields(normalized);
    const form = indicatorParamForm;

    indicatorParamTitle.textContent = `${label} Parameters`;
    indicatorParamApplyBtn.textContent = active ? 'Update' : 'Apply';
    indicatorParamRemoveBtn.style.display = active ? 'inline-flex' : 'none';

    form.innerHTML = '';
    if (fields.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'indicator-param-empty';
        empty.textContent = 'This indicator has no configurable parameters.';
        form.appendChild(empty);
    } else {
        fields.forEach((field) => {
            const row = document.createElement('label');
            row.className = 'indicator-param-row';

            const labelEl = document.createElement('span');
            labelEl.className = 'indicator-param-label';
            labelEl.textContent = field.label;

            const input = document.createElement('input');
            input.className = 'indicator-param-input';
            input.type = 'number';
            input.name = field.key;
            input.step = String(field.step ?? 1);
            if (field.min !== undefined) input.min = String(field.min);
            if (field.max !== undefined) input.max = String(field.max);
            const existingVal = existing[field.key];
            input.value = Number.isFinite(Number(existingVal))
                ? String(existingVal)
                : String(field.defaultValue);

            row.appendChild(labelEl);
            row.appendChild(input);
            form.appendChild(row);
        });
    }

    indicatorParamPanel.classList.remove('hidden');
}

function hideStrategyParamPanel(): void {
    if (!strategyParamPanel) return;
    strategyParamPanel.classList.add('hidden');
    strategyParamTarget = null;
}

function ensureStrategyParamPanel(): void {
    if (strategyParamPanel) return;

    const panel = document.createElement('div');
    panel.id = 'strategy-param-panel';
    panel.className = 'panel indicator-param-panel hidden';

    const title = document.createElement('div');
    title.className = 'indicator-param-title';
    panel.appendChild(title);

    const form = document.createElement('form');
    form.className = 'indicator-param-form';
    panel.appendChild(form);

    const actions = document.createElement('div');
    actions.className = 'indicator-param-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'indicator-param-btn secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => hideStrategyParamPanel());
    actions.appendChild(cancelBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'indicator-param-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        if (!strategyParamTarget) return;
        strategyManager.remove(strategyParamTarget);
        hideStrategyParamPanel();
    });
    actions.appendChild(removeBtn);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'indicator-param-btn primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
        form.requestSubmit();
    });
    actions.appendChild(applyBtn);

    panel.appendChild(actions);
    chartContainer.appendChild(panel);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!strategyParamTarget || !strategyParamForm) return;

        const fields = strategyManager.getFields(strategyParamTarget);
        const params: Record<string, unknown> = {};
        fields.forEach((field) => {
            const input = strategyParamForm?.querySelector<HTMLInputElement>(`input[name="${field.key}"]`);
            if (!input) return;
            const parsed = Number(input.value);
            if (Number.isFinite(parsed)) {
                params[field.key] = parsed;
            }
        });

        if (strategyManager.isActive(strategyParamTarget)) {
            await strategyManager.updateParams(strategyParamTarget, params);
        } else {
            await strategyManager.add(strategyParamTarget, params);
        }
        hideStrategyParamPanel();
    });

    strategyParamPanel = panel;
    strategyParamForm = form;
    strategyParamTitle = title;
    strategyParamApplyBtn = applyBtn;
    strategyParamRemoveBtn = removeBtn;
}

function openStrategyParamPanel(strategyId: string): void {
    ensureStrategyParamPanel();
    if (!strategyParamPanel || !strategyParamForm || !strategyParamTitle || !strategyParamApplyBtn || !strategyParamRemoveBtn) {
        return;
    }

    const normalized = normalizeStrategyId(strategyId);
    const defs = strategyManager.getDefinitions();
    const def = defs.find((item) => item.id === normalized);
    if (!def) return;

    strategyParamTarget = normalized;
    const active = strategyManager.isActive(normalized);
    const existing = strategyManager.getParams(normalized);
    const fields = strategyManager.getFields(normalized);
    const form = strategyParamForm;

    strategyParamTitle.textContent = `${def.label} Parameters`;
    strategyParamApplyBtn.textContent = active ? 'Update' : 'Apply';
    strategyParamRemoveBtn.style.display = active ? 'inline-flex' : 'none';

    form.innerHTML = '';
    if (fields.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'indicator-param-empty';
        empty.textContent = 'This strategy has no configurable parameters.';
        form.appendChild(empty);
    } else {
        fields.forEach((field) => {
            const row = document.createElement('label');
            row.className = 'indicator-param-row';

            const labelEl = document.createElement('span');
            labelEl.className = 'indicator-param-label';
            labelEl.textContent = field.label;

            const input = document.createElement('input');
            input.className = 'indicator-param-input';
            input.type = 'number';
            input.name = field.key;
            input.step = String(field.step ?? 1);
            if (field.min !== undefined) input.min = String(field.min);
            if (field.max !== undefined) input.max = String(field.max);
            const existingVal = existing[field.key];
            input.value = Number.isFinite(Number(existingVal))
                ? String(existingVal)
                : String(field.defaultValue);

            row.appendChild(labelEl);
            row.appendChild(input);
            form.appendChild(row);
        });
    }

    strategyParamPanel.classList.remove('hidden');
}

void openStrategyParamPanel;


function buildToolbar(): void {
    ensureIndicatorParamPanel();
    const launchConfig = resolveInitialChartConfig();

    // Timeframe Selector
    const timeframes: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
    const tfSelect = document.createElement('select');
    tfSelect.className = 'toolbar-select';
    timeframes.forEach(tf => {
        const opt = document.createElement('option');
        opt.value = tf;
        opt.textContent = tf;
        if (tf === launchConfig.tf) opt.selected = true;
        tfSelect.appendChild(opt);
    });
    tfSelect.addEventListener('change', async () => {
        const tf = tfSelect.value as TimeFrame;
        await loadChartContext(dataLoader.getSymbol(), tf, `Loading ${dataLoader.getSymbol()} ${tf} price data...`);
    });
    toolbar.appendChild(tfSelect);

    // Chart Type Selector
    const typeSelect = document.createElement('select');
    typeSelect.className = 'toolbar-select';
    ['Candle', 'Line', 'Area'].forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
        chartManager.setSeriesType(typeSelect.value as any);
        markerManager.setSeries(chartManager.getCandleSeries());
        syncPriceAxisMask();
    });
    toolbar.appendChild(typeSelect);

    // Separator
    const sep1 = document.createElement('div');
    sep1.className = 'toolbar-separator';
    toolbar.appendChild(sep1);

    // INDICATORS Selector (New)
    const indSelect = document.createElement('select');
    indSelect.className = 'toolbar-select';
    const defaultInd = document.createElement('option');
    defaultInd.value = '';
    defaultInd.textContent = 'Indicators';
    indSelect.appendChild(defaultInd);

    const indicatorOptionMap = new Map<string, HTMLOptionElement>();
    INDICATOR_OPTIONS.forEach((opt) => {
        const el = document.createElement('option');
        el.value = opt.id;
        el.textContent = opt.label;
        indSelect.appendChild(el);
        indicatorOptionMap.set(opt.id, el);
    });

    const updateIndicatorOptions = (): void => {
        INDICATOR_OPTIONS.forEach((opt) => {
            const option = indicatorOptionMap.get(opt.id);
            if (!option) return;
            option.textContent = `${indicatorManager.isActive(opt.id) ? '✓ ' : ''}${opt.label}`;
        });
    };

    const legend = document.createElement('div');
    legend.className = 'indicator-legend';
    chartContainer.appendChild(legend);

    const renderIndicatorLegend = (items: IndicatorLegendItem[]): void => {
        legend.innerHTML = '';
        if (items.length === 0) {
            legend.style.display = 'none';
            return;
        }

        legend.style.display = 'flex';
        items.forEach((item) => {
            const chip = document.createElement('button');
            chip.className = 'indicator-chip';
            chip.type = 'button';
            chip.title = `${item.strategyId} (click to edit params)`;
            chip.addEventListener('click', () => openIndicatorParamPanel(item.strategyId));

            const dot = document.createElement('span');
            dot.className = 'indicator-dot';
            dot.style.backgroundColor = item.color;

            const label = document.createElement('span');
            label.textContent = item.name;

            chip.appendChild(dot);
            chip.appendChild(label);
            legend.appendChild(chip);
        });
    };

    indicatorManager.onSelectionChange(updateIndicatorOptions);
    indicatorManager.onLegendChange(renderIndicatorLegend);
    updateIndicatorOptions();
    renderIndicatorLegend(indicatorManager.getLegendItems());

    // Seçim toggle: seçince göster, tekrar seçince kaldır.
    indSelect.addEventListener('change', async () => {
        const val = indSelect.value;
        if (val) {
            openIndicatorParamPanel(val);
            indSelect.value = '';
        }
    });

    toolbar.appendChild(indSelect);

    // Separator
    const sep2 = document.createElement('div');
    sep2.className = 'toolbar-separator';
    toolbar.appendChild(sep2);

    // Tool Selector (Dropdown)
    const tools: Array<{ id: DrawTool; icon: string; title: string }> = [
        { id: 'trendline', icon: '╱', title: 'Trendline' },
        { id: 'horizontal_line', icon: '—', title: 'Horizontal Line' },
        { id: 'vertical_line', icon: '│', title: 'Vertical Line' },
        { id: 'parallel_channel', icon: '∥', title: 'Parallel Channel' },
        { id: 'fibonacci', icon: '≡', title: 'Fibonacci' },
        { id: 'rectangle', icon: '▭', title: 'Rectangle' },
        { id: 'measure', icon: '📏', title: 'Date/Price Range' },
        { id: 'long_position', icon: '📈', title: 'Long Position' },
        { id: 'short_position', icon: '📉', title: 'Short Position' },
        { id: 'brush', icon: '🖌', title: 'Brush' },
        { id: 'text', icon: 'T', title: 'Text Note' },
    ];

    const toolSelect = document.createElement('select');
    toolSelect.className = 'toolbar-select tool-dropdown';

    // Default "Select Tool" option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '🖌️ Drawing Tools';
    toolSelect.appendChild(defaultOpt);

    tools.forEach(tool => {
        const opt = document.createElement('option');
        opt.value = tool.id;
        opt.textContent = `${tool.icon}  ${tool.title}`;
        toolSelect.appendChild(opt);
    });

    toolSelect.addEventListener('change', () => {
        const val = toolSelect.value;
        if (val) {
            modeFSM.selectTool(val as DrawTool);
            // Keep focus on canvas so keyboard shortcuts work
            overlayCanvas.focus();
        } else {
            modeFSM.deselect();
        }
        // Reset select to default? Or keep selected? 
        // If we keep selected, we need to update it when deselect happens externally (Esc).
    });
    toolbar.appendChild(toolSelect);

    const clearDrawingsBtn = document.createElement('button');
    clearDrawingsBtn.className = 'toolbar-btn toolbar-btn-clear';
    clearDrawingsBtn.id = 'tool-clear-drawings';
    clearDrawingsBtn.title = 'Clear all drawings';
    clearDrawingsBtn.textContent = 'CLR';
    clearDrawingsBtn.addEventListener('click', async () => {
        const count = drawingStore.getAll().length;
        if (count === 0) return;

        const ok = window.confirm(`Delete all ${count} drawings on this symbol/timeframe?`);
        if (!ok) return;

        await drawingStore.clearAll();
        setSelectedDrawing(null);
        modeFSM.deselect();
        overlay.invalidate();
    });
    toolbar.appendChild(clearDrawingsBtn);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'toolbar-separator';
    toolbar.appendChild(sep);

    // Magnet toggle
    const magnetBtn = document.createElement('button');
    magnetBtn.className = 'toolbar-btn';
    magnetBtn.id = 'tool-magnet';
    magnetBtn.title = 'Magnet (Snap to OHLC)';
    magnetBtn.textContent = '🧲';
    magnetBtn.addEventListener('click', () => {
        magnetOn = !magnetOn;
        magnetBtn.classList.toggle('active', magnetOn);
        if (activeTool) activeTool.setMagnet(magnetOn);
    });
    toolbar.appendChild(magnetBtn);

    // Scale toggle
    const scaleBtn = document.createElement('button');
    scaleBtn.className = 'toolbar-btn';
    scaleBtn.id = 'tool-scale';
    scaleBtn.title = 'Toggle Log/Linear';
    scaleBtn.textContent = 'L';
    scaleBtn.addEventListener('click', () => {
        const current = chartManager.getScaleMode();
        const next = current === 'linear' ? 'logarithmic' : 'linear';
        chartManager.setScaleMode(next);
        scaleBtn.textContent = next === 'logarithmic' ? 'Log' : 'L';
        scaleBtn.classList.toggle('active', next === 'logarithmic');
        syncPriceAxisMask();
    });
    toolbar.appendChild(scaleBtn);

    // Mode indicator
    const indicator = document.createElement('span');
    indicator.className = 'mode-indicator';
    indicator.setAttribute('data-mode', 'explore');
    indicator.textContent = 'EXPLORE';
    toolbar.appendChild(indicator);
}

function updateToolbarState(_mode: string, activeTool: string | null): void {
    // Clear all active states
    toolbar.querySelectorAll('.toolbar-btn').forEach((btn) => {
        if (btn.id.startsWith('tool-') && btn.id !== 'tool-magnet' && btn.id !== 'tool-scale') {
            btn.classList.remove('active');
        }
    });

    // Update Dropdown
    const dropdown = toolbar.querySelector('.tool-dropdown') as HTMLSelectElement;
    if (dropdown) {
        if (activeTool) {
            dropdown.value = activeTool;
        } else {
            dropdown.value = '';
        }
    }

    // Set active tool (legacy for magnet/scale)
    if (activeTool) {
        const activeBtn = document.getElementById(`tool-${activeTool}`);
        activeBtn?.classList.add('active');
    }
}

// ─── Bridge Command Handlers ───────────────────────────────────
bridge.onCommand<SetSymbolPayload>('setSymbol', async (payload) => {
    await loadChartContext(
        payload.symbol,
        dataLoader.getTimeframe(),
        `Loading ${payload.symbol} ${dataLoader.getTimeframe()} price data...`
    );
});

bridge.onCommand<SetTimeframePayload>('setTimeframe', async (payload) => {
    const tf = payload.tf as TimeFrame;
    await loadChartContext(dataLoader.getSymbol(), tf, `Loading ${dataLoader.getSymbol()} ${tf} price data...`);
});

bridge.onCommand<ToggleLayerPayload>('toggleLayer', (payload) => {
    if (payload.layer === 'drawings') {
        // Toggle overlay visibility
        overlayCanvas.style.display = payload.visible ? 'block' : 'none';
    } else {
        markerManager.setLayerVisibility(payload.layer, payload.visible);
    }
});

bridge.onCommand<LoadBacktestPayload>('loadBacktest', async (payload) => {
    try {
        const res = await fetch(`${API_BASE}/backtests/${payload.runId}/events`);
        if (res.ok) {
            const data: BacktestEventsResponse = await res.json();
            markerManager.setBacktestEvents(data.events);
        }
    } catch (err) {
        console.error('[Bridge] loadBacktest error:', err);
    }
});

bridge.onCommand<SetStrategyPayload>('setStrategy', async (payload) => {
    try {
        await indicatorManager.applyStrategy(payload.strategyId, payload.params || {});
        await strategyManager.add(payload.strategyId, payload.params || {});
    } catch (err) {
        console.error('[Bridge] setStrategy error:', err);
    }
});

bridge.onCommand<SetThemePayload>('setTheme', (payload) => {
    chartManager.setTheme(payload.theme);
});

// ─── Initialize ────────────────────────────────────────────────
async function init(): Promise<void> {
    await strategyManager.init();
    buildToolbar();
    overlayCanvas.tabIndex = 0;
    syncPriceAxisMask();

    // Initial load:
    // 1) query param (?symbol=THYAO&tf=1h)
    // 2) optional native bootstrap (window.__GRAPH_INIT__)
    // 3) fallback default
    const initial = resolveInitialChartConfig();
    const defaultSymbol = initial.symbol;
    const defaultTf: TimeFrame = initial.tf;

    await loadChartContext(defaultSymbol, defaultTf);

    // Signal to native that chart is ready
    bridge.emitReady(APP_VERSION, LWC_VERSION);

    console.log('[Chart] initialized');
}

init().catch(console.error);
