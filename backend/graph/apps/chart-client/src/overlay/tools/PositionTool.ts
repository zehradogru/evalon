import type { DrawingType, DrawingStyle } from '@graph/shared-types';
import { BaseTool, type ToolEventCallback } from './BaseTool';

export class PositionTool extends BaseTool {
    private _type: 'long_position' | 'short_position';

    constructor(callback: ToolEventCallback, type: 'long_position' | 'short_position') {
        super(callback);
        this._type = type;
    }

    get requiredAnchors(): number { return 3; } // Entry, Stop, Target
    get drawingType(): DrawingType { return this._type; }
    get defaultStyle(): Partial<DrawingStyle> {
        return {
            color: '#787B86',
            width: 1,
            opacity: 1,
            // Custom properties could be stored in meta if needed, 
            // but we use standard style for lines/fill
        };
    }
}
