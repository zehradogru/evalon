import type { DrawingModel } from '@graph/shared-types';

/**
 * UndoRedoManager — command-pattern undo/redo stack.
 * Supports create, delete, update (anchors, style, meta), and move actions.
 */

export type ActionType = 'create' | 'delete' | 'update' | 'move';

type UndoSnapshot = Omit<Partial<DrawingModel>, 'style'> & {
    style?: Partial<DrawingModel['style']>;
};

export interface UndoAction {
    type: ActionType;
    drawingId: string;
    /** State before the action (for undo) */
    before: UndoSnapshot | null;
    /** State after the action (for redo) */
    after: UndoSnapshot | null;
}

const MAX_STACK = 30;

export class UndoRedoManager {
    private undoStack: UndoAction[] = [];
    private redoStack: UndoAction[] = [];

    /** Push a new action onto the undo stack and clear redo stack */
    push(action: UndoAction): void {
        this.undoStack.push(action);
        if (this.undoStack.length > MAX_STACK) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /** Can undo? */
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /** Can redo? */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Pop from undo stack → returns the action to reverse */
    undo(): UndoAction | null {
        const action = this.undoStack.pop();
        if (!action) return null;
        this.redoStack.push(action);
        return action;
    }

    /** Pop from redo stack → returns the action to re-apply */
    redo(): UndoAction | null {
        const action = this.redoStack.pop();
        if (!action) return null;
        this.undoStack.push(action);
        return action;
    }

    /** Clear all history */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
