import type { DrawingType, DrawingStyle, Anchor } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class TextTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 1; }
    get drawingType(): DrawingType { return 'text'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#e5e7eb',
            width: 0,
            dash: [],
            opacity: 1.0,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
            text: 'Note',
        };
    }

    /** Override: after placing anchor, prompt for text input */
    onAnchorPlaced(anchor: Anchor): void {
        const text = prompt('Enter note text:', 'Note');
        if (!text) {
            this.cancel();
            return;
        }

        this.anchors.push(anchor);
        this.callback({
            type: 'complete',
            anchors: [...this.anchors],
            style: { text },
        });
        this.reset();
    }
}
