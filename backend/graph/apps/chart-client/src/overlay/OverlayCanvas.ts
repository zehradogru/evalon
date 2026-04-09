import type { DrawingModel, DrawingStyle, DrawingType } from '@graph/shared-types';
import type { IChartApi } from 'lightweight-charts';
import { dataToPixel } from '@graph/chart-utils';
import { hitTestAll, type DrawingHitTestData, type HitResult } from '@graph/chart-utils';

/**
 * OverlayCanvas — manages the HTML Canvas element layered on top of LWC.
 * Handles the render loop, coordinate transforms, and drawing dispatch.
 */
export class OverlayCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private chart: IChartApi;
    private drawings: DrawingModel[] = [];
    private previewDrawing: DrawingModel | null = null;
    private selectedId: string | null = null;
    private animFrameId: number | null = null;
    private needsRedraw: boolean = true;
    private dpr: number;

    constructor(canvas: HTMLCanvasElement, chart: IChartApi) {
        this.canvas = canvas;
        this.chart = chart;
        this.ctx = canvas.getContext('2d')!;
        this.dpr = window.devicePixelRatio || 1;

        this.resize();
        this.startRenderLoop();

        // Redraw on LWC viewport changes
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            this.needsRedraw = true;
        });

        // Handle DPR changes (e.g., moving between screens)
        const resizeObserver = new ResizeObserver(() => this.resize());
        resizeObserver.observe(canvas.parentElement!);
    }

    /** Update the list of drawings to render */
    setDrawings(drawings: DrawingModel[]): void {
        this.drawings = drawings;
        this.needsRedraw = true;
    }

    /** Set which drawing is selected (shows anchor handles) */
    setSelected(drawingId: string | null): void {
        this.selectedId = drawingId;
        this.needsRedraw = true;
    }

    /** Set a temporary preview drawing (ghost shape) */
    setPreviewDrawing(drawing: DrawingModel | null): void {
        this.previewDrawing = drawing;
        this.needsRedraw = true;
    }

    /** Force a redraw on next frame */
    invalidate(): void {
        this.needsRedraw = true;
    }

    /** Handle canvas resize with DPR support */
    private resize(): void {
        const parent = this.canvas.parentElement!;
        const rect = parent.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.needsRedraw = true;
    }

    /** Main render loop (only renders when dirty) */
    private startRenderLoop(): void {
        const loop = () => {
            if (this.needsRedraw) {
                this.render();
                this.needsRedraw = false;
            }
            this.animFrameId = requestAnimationFrame(loop);
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    /** Clear and re-render all visible drawings */
    private render(): void {
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        this.ctx.clearRect(0, 0, width, height);
        const pane = this.getMainPaneBounds(width, height);

        for (const drawing of this.drawings) {
            if (drawing.meta.hidden) continue;
            this.renderDrawing(drawing, drawing.id === this.selectedId, pane);
        }

        if (this.previewDrawing) {
            this.renderDrawing(this.previewDrawing, true, pane);
        }
    }

    /** Dispatch rendering to the appropriate drawing type handler */
    private renderDrawing(
        d: DrawingModel,
        isSelected: boolean,
        pane: { top: number; bottom: number; width: number }
    ): void {
        const pixelAnchors = d.anchors
            .map((a) => dataToPixel(this.chart, a.time, a.price))
            .filter((p): p is { x: number; y: number } => p !== null);

        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, pane.top, pane.width, Math.max(0, pane.bottom - pane.top));
        ctx.clip();
        this.applyStyle(ctx, d.style);

        switch (d.type) {
            case 'trendline':
            case 'ray':
                this.renderLine(ctx, pixelAnchors, d.style);
                break;
            case 'brush':
                this.renderBrush(ctx, pixelAnchors);
                break;
            case 'horizontal_line':
                this.renderHorizontalLine(ctx, pixelAnchors, d.style);
                break;
            case 'vertical_line':
                this.renderVerticalLine(ctx, pixelAnchors, d.style);
                break;
            case 'rectangle':
                this.renderRectangle(ctx, pixelAnchors, d.style);
                break;
            case 'fibonacci':
                this.renderFibonacci(ctx, pixelAnchors, d.style);
                break;
            case 'parallel_channel':
                this.renderParallelChannel(ctx, pixelAnchors, d.style);
                break;
            case 'measure':
                this.renderMeasure(ctx, pixelAnchors, d, d.style);
                break;
            case 'long_position':
            case 'short_position':
                this.renderPosition(ctx, pixelAnchors, d.type, d.style);
                break;
            case 'text':
                this.renderText(ctx, pixelAnchors, d.style);
                break;
        }

        // Render anchor handles for selected drawing
        if (isSelected) {
            this.renderAnchors(ctx, pixelAnchors);
        }

        ctx.restore();
    }

    private applyStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle): void {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.globalAlpha = style.opacity;
        if (style.dash.length > 0) {
            ctx.setLineDash(style.dash);
        }
    }

    private renderLine(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        const [p1, p2] = anchors;

        ctx.beginPath();

        if (style.extend === 'right' || style.extend === 'both') {
            // Extend line to canvas edge
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const canvasWidth = this.canvas.width / this.dpr;
            if (dx !== 0) {
                const t = (canvasWidth - p1.x) / dx;
                const extY = p1.y + dy * t;
                ctx.moveTo(style.extend === 'both' ? 0 : p1.x, style.extend === 'both' ? p1.y - dy * (p1.x / dx) : p1.y);
                ctx.lineTo(canvasWidth, extY);
            } else {
                ctx.moveTo(p1.x, 0);
                ctx.lineTo(p1.x, this.canvas.height / this.dpr);
            }
        } else {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }

        ctx.stroke();
    }

    private renderBrush(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>
    ): void {
        if (anchors.length < 2) return;
        const [first, ...rest] = anchors;

        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.moveTo(first.x, first.y);
        for (const p of rest) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

    private renderHorizontalLine(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        _style: DrawingStyle
    ): void {
        if (anchors.length < 1) return;
        const y = anchors[0].y;
        const width = this.canvas.width / this.dpr;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    private renderVerticalLine(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        _style: DrawingStyle
    ): void {
        if (anchors.length < 1) return;
        const x = anchors[0].x;
        const height = this.canvas.height / this.dpr;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    private renderRectangle(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        const [p1, p2] = anchors;
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        // Fill
        if (style.fillColor) {
            ctx.fillStyle = style.fillColor;
            ctx.globalAlpha = style.fillOpacity ?? 0.15;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = style.opacity;
        }

        // Stroke
        ctx.strokeRect(x, y, w, h);
    }

    private renderFibonacci(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        const [p1, p2] = anchors;

        // Trendline (diagonal)
        ctx.beginPath();
        ctx.setLineDash([4, 4]); // Dashed trendline
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Levels
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236];
        const dy = p2.y - p1.y;

        const x1 = Math.min(p1.x, p2.x);
        const x2 = Math.max(p1.x, p2.x);

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        // Reset line style for levels
        ctx.setLineDash([]);

        for (const level of levels) {
            const y = p1.y + dy * level;

            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = style.color;
            ctx.fillText(`${level}`, x1 + 2, y - 2);
        }
    }

    private renderParallelChannel(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        const [p1, p2, p3] = anchors;

        // Central line (Main Trend)
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        if (!p3) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Parallel line passing through p3
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p3.x + dx, p3.y + dy);
        ctx.stroke();

        // Median line
        const midX = (p1.x + p3.x) / 2;
        const midY = (p1.y + p3.y) / 2;

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + dx, midY + dy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Fill
        if (style.fillOpacity && style.fillOpacity > 0) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x + dx, p3.y + dy);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fillStyle = style.fillColor || style.color;
            ctx.globalAlpha = style.fillOpacity;
            ctx.fill();
            ctx.globalAlpha = style.opacity; // Restore alpha
        }
    }

    private renderMeasure(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        drawing: DrawingModel,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        const [p1, p2] = anchors;
        const dataAnchors = drawing.anchors;

        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        // Fill background
        ctx.fillStyle = style.fillColor || style.color;
        ctx.globalAlpha = style.fillOpacity ?? 0.15;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = style.opacity;

        // Stroke
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, w, h);

        // Calculate Stats
        const t1 = dataAnchors[0].time;
        const t2 = dataAnchors[1].time;
        const price1 = dataAnchors[0].price;
        const price2 = dataAnchors[1].price;

        const priceDiff = price2 - price1;
        const percentDiff = (priceDiff / price1) * 100;
        const timeDiff = Math.abs(t2 - t1);

        const days = (timeDiff / (24 * 3600)).toFixed(2);

        const text = [
            `${priceDiff.toFixed(2)} (${percentDiff.toFixed(2)}%)`,
            `${days}d`
        ];

        // Draw Text Label centered
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cx = x + w / 2;
        const cy = y + h / 2;

        // Text Background
        const boxW = 140;
        const boxH = 40;
        ctx.fillStyle = '#1e293b';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ffffff';
        ctx.fillText(text[0], cx, cy - 8);
        ctx.fillText(text[1], cx, cy + 8);
    }

    private renderPosition(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        type: DrawingType,
        style: DrawingStyle
    ): void {
        if (anchors.length < 2) return;
        ctx.lineWidth = Math.max(1, style.width || 1);

        const p1 = anchors[0]; // Entry
        const p2 = anchors[1]; // Stop
        const p3 = anchors[2]; // Target

        // X range defined by P1 and P2 (Stop determines end time as well usually?)
        // Let's use P2's X for the right edge of both boxes.
        const startX = p1.x;
        const endX = p2.x;
        const width = endX - startX;

        // Y levels
        const entryY = p1.y;
        const stopY = p2.y;
        let targetY = entryY - (stopY - entryY); // Default 1:1 if p3 missing
        if (p3) {
            targetY = p3.y;
        }

        const isLong = type === 'long_position';

        // Colors
        const profitColor = 'rgba(16, 185, 129, 0.2)'; // Green
        const lossColor = 'rgba(239, 68, 68, 0.2)';   // Red
        const profitStroke = '#10b981';
        const lossStroke = '#ef4444';

        // Stop Loss Zone (Red)
        // For Long: Stop is below Entry. Box is from EntryY to StopY.
        ctx.fillStyle = lossColor;
        ctx.strokeStyle = lossStroke;
        ctx.beginPath();
        ctx.rect(startX, entryY, width, stopY - entryY);
        ctx.fill();
        ctx.stroke();

        // Target Zone (Green)
        // For Long: Target is above Entry. Box is from EntryY to TargetY.
        ctx.fillStyle = profitColor;
        ctx.strokeStyle = profitStroke;
        ctx.beginPath();
        ctx.rect(startX, entryY, width, targetY - entryY);
        ctx.fill();
        ctx.stroke();

        // Entry Line
        ctx.beginPath();
        ctx.moveTo(startX, entryY);
        ctx.lineTo(startX + width, entryY);
        ctx.strokeStyle = style.color || '#787B86';
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // R/R Text
        // Calculate Risk/Reward ratio in PIXELS (approximate for visually, but correct would be Price)
        // Since Y is inverted (0 is top), we need to be careful.
        // But height diff is absolute pixels.
        const risk = Math.abs(stopY - entryY);
        const reward = Math.abs(targetY - entryY);

        if (risk > 1) {
            const ratio = (reward / risk).toFixed(2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Risk/Reward: ${ratio}`, startX + 5, entryY + (isLong ? 15 : -15));
        }
    }

    private renderText(
        ctx: CanvasRenderingContext2D,
        anchors: Array<{ x: number; y: number }>,
        style: DrawingStyle
    ): void {
        if (anchors.length < 1 || !style.text) return;
        const { x, y } = anchors[0];

        const fontSize = style.fontSize || 14;
        const fontFamily = style.fontFamily || 'Inter, sans-serif';
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        // Background box
        const metrics = ctx.measureText(style.text);
        const padding = 6;
        const boxW = metrics.width + padding * 2;
        const boxH = fontSize + padding * 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - padding, y - padding, boxW, boxH);

        // Text
        ctx.fillStyle = style.color;
        ctx.fillText(style.text, x, y);
    }

    /** Render draggable anchor handles on selected drawing */
    private renderAnchors(ctx: CanvasRenderingContext2D, anchors: Array<{ x: number; y: number }>): void {
        const radius = 5;
        ctx.setLineDash([]);

        for (const { x, y } of anchors) {
            // Outer ring
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();

            // Inner dot
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
    }

    /** Enable/disable pointer events on the canvas */
    setInteractive(interactive: boolean): void {
        this.canvas.classList.toggle('interactive', interactive);
    }

    hasSelection(): boolean {
        return this.selectedId !== null;
    }

    hitTest(x: number, y: number): HitResult | null {
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        const pane = this.getMainPaneBounds(width, height);
        if (y < pane.top || y > pane.bottom) return null;

        const hitData: DrawingHitTestData[] = [];
        for (const drawing of this.drawings) {
            if (drawing.meta.hidden) continue;
            const pixelAnchors = drawing.anchors
                .map((a) => dataToPixel(this.chart, a.time, a.price))
                .filter((p): p is { x: number; y: number } => p !== null);
            if (pixelAnchors.length === 0) continue;

            let boundingBox: DrawingHitTestData['boundingBox'];
            if (drawing.type === 'text' && pixelAnchors[0]) {
                const fontSize = drawing.style.fontSize || 14;
                const fontFamily = drawing.style.fontFamily || 'Inter, sans-serif';
                const text = drawing.style.text || '';
                const padding = 6;
                this.ctx.save();
                this.ctx.font = `${fontSize}px ${fontFamily}`;
                const metrics = this.ctx.measureText(text);
                this.ctx.restore();
                boundingBox = {
                    x: pixelAnchors[0].x - padding,
                    y: pixelAnchors[0].y - padding,
                    width: metrics.width + padding * 2,
                    height: fontSize + padding * 2,
                };
            }

            hitData.push({
                id: drawing.id,
                type: drawing.type,
                pixelAnchors,
                hidden: drawing.meta.hidden,
                locked: drawing.meta.locked,
                boundingBox,
            });
        }

        return hitTestAll(x, y, hitData);
    }

    /** Get canvas element for event binding */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    destroy(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
        }
    }

    private getMainPaneBounds(width: number, height: number): { top: number; bottom: number; width: number } {
        const chartOptions = this.chart.options() as any;
        const margins = chartOptions?.rightPriceScale?.scaleMargins || { top: 0, bottom: 0 };
        const top = Math.max(0, Math.min(height, Math.floor((margins.top ?? 0) * height)));
        const bottom = Math.max(0, Math.min(height, Math.ceil((1 - (margins.bottom ?? 0)) * height)));
        return { top, bottom, width };
    }
}
