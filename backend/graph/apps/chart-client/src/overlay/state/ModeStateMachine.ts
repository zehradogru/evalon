import type { InteractionMode } from '@graph/shared-types';

/**
 * ModeStateMachine — manages Explore / Draw / Edit interaction modes.
 * Determines how mouse/touch gestures are interpreted.
 */
export type DrawTool =
    | 'trendline'
    | 'horizontal_line'
    | 'vertical_line'
    | 'rectangle'
    | 'fibonacci'
    | 'parallel_channel'
    | 'measure'
    | 'brush'
    | 'long_position'
    | 'short_position'
    | 'text';

export interface ModeState {
    mode: InteractionMode;
    activeTool: DrawTool | null;
}

export type ModeChangeCallback = (state: ModeState) => void;

export class ModeStateMachine {
    private state: ModeState = { mode: 'explore', activeTool: null };
    private listeners: ModeChangeCallback[] = [];

    getState(): ModeState {
        return { ...this.state };
    }

    /** User selects a drawing tool → enter Draw mode */
    selectTool(tool: DrawTool): void {
        this.setState({ mode: 'draw', activeTool: tool });
    }

    /** Drawing completed → return to Explore so chart scrolling stays available */
    drawingCompleted(): void {
        this.setState({ mode: 'explore', activeTool: null });
    }

    /** User clicks existing drawing → enter Edit mode */
    selectDrawing(): void {
        this.setState({ mode: 'edit', activeTool: null });
    }

    /** User presses Escape or clicks empty area → back to Explore */
    deselect(): void {
        this.setState({ mode: 'explore', activeTool: null });
    }

    /** User selects new tool while in Edit mode → switch to Draw */
    switchTool(tool: DrawTool): void {
        this.setState({ mode: 'draw', activeTool: tool });
    }

    /** Check if in a particular mode */
    isExplore(): boolean { return this.state.mode === 'explore'; }
    isDraw(): boolean { return this.state.mode === 'draw'; }
    isEdit(): boolean { return this.state.mode === 'edit'; }

    onChange(cb: ModeChangeCallback): void {
        this.listeners.push(cb);
    }

    private setState(newState: ModeState): void {
        const prev = this.state;
        this.state = newState;

        if (prev.mode !== newState.mode || prev.activeTool !== newState.activeTool) {
            for (const cb of this.listeners) {
                cb(this.getState());
            }
        }
    }
}
