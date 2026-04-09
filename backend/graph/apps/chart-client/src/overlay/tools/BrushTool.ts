import type { Anchor, DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

/**
 * Brush interaction:
 * 1) First click starts a stroke
 * 2) Mouse move appends points to the stroke
 * 3) Second click completes the stroke
 */
export class BrushTool extends BaseTool {
    private isDrawing = false;

    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 2; }
    get drawingType(): DrawingType { return 'brush'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#2962FF',
            width: 2,
            opacity: 1,
            dash: [],
        };
    }

    override onAnchorPlaced(anchor: Anchor): void {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.anchors = [anchor];
            this.callback({ type: 'anchor_placed', anchors: [...this.anchors] });
            this.callback({ type: 'preview_update', anchors: [...this.anchors] });
            return;
        }

        this.appendAnchor(anchor);
        if (this.anchors.length < 2) {
            this.cancel();
            return;
        }

        this.callback({
            type: 'complete',
            anchors: [...this.anchors],
        });
        this.reset();
    }

    override onPreviewMove(anchor: Anchor): void {
        if (!this.isDrawing) return;
        this.appendAnchor(anchor);
        this.callback({
            type: 'preview_update',
            anchors: [...this.anchors],
        });
    }

    override cancel(): void {
        this.isDrawing = false;
        super.cancel();
    }

    protected override reset(): void {
        this.isDrawing = false;
        super.reset();
    }

    private appendAnchor(anchor: Anchor): void {
        const last = this.anchors[this.anchors.length - 1];
        if (!last || last.time !== anchor.time || last.price !== anchor.price) {
            this.anchors.push(anchor);
        }
    }
}
