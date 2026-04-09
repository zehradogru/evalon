import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class VLineTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 1; }
    get drawingType(): DrawingType { return 'vertical_line'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#f59e0b',
            width: 1,
            dash: [4, 4],
            opacity: 0.8,
        };
    }
}
