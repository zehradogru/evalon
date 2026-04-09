import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class MeasureTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 2; }
    get drawingType(): DrawingType { return 'measure'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#2962FF',
            width: 1,
            fillColor: '#2962FF',
            fillOpacity: 0.1,
            extend: 'none',
        };
    }
}
