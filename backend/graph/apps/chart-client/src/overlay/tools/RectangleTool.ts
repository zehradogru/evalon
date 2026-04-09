import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class RectangleTool extends BaseTool {
    constructor(callback: ToolEventCallback) {
        super(callback);
    }

    get requiredAnchors(): number { return 2; }
    get drawingType(): DrawingType { return 'rectangle'; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#8b5cf6',
            width: 1,
            dash: [],
            opacity: 1.0,
            fillColor: '#8b5cf6',
            fillOpacity: 0.1,
        };
    }
}
