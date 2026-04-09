import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class TrendlineTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 2; }
    get drawingType(): DrawingType { return 'trendline'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#3b82f6',
            width: 2,
            dash: [],
            opacity: 1.0,
            extend: 'none',
        };
    }
}
