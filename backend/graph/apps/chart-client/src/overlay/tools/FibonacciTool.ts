import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class FibonacciTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 2; }
    get drawingType(): DrawingType { return 'fibonacci'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#2962FF',
            width: 1,
            dash: [4, 4],
            opacity: 0.8,
            extend: 'none',
        };
    }
}
