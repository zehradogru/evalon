import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class HLineTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 1; }
    get drawingType(): DrawingType { return 'horizontal_line'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#10b981',
            width: 1,
            dash: [6, 4],
            opacity: 1.0,
        };
    }
}
