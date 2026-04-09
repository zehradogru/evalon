import type { Anchor, DrawingType } from '@graph/shared-types';
import type { PixelPoint } from './coordinate';

/**
 * Hit-testing utilities for overlay drawings.
 * Determines whether a mouse/touch position intersects with a drawing.
 */

export interface HitResult {
    drawingId: string;
    hitType: 'anchor' | 'body';
    anchorIndex?: number;
}

/** Convert anchors to pixel coords for hit-testing */
export type AnchorToPixel = (anchor: Anchor) => PixelPoint | null;

const ANCHOR_RADIUS = 6;   // pixels
const LINE_THRESHOLD = 5;  // pixels

/**
 * Test if a point hits any drawing in the list (top-to-bottom layer order).
 * Returns the first hit, or null if nothing was clicked.
 */
export function hitTestAll(
    mouseX: number,
    mouseY: number,
    drawings: DrawingHitTestData[],
): HitResult | null {
    // Iterate top-to-bottom (last drawn = top layer)
    for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        if (d.hidden || d.locked) continue;

        const result = hitTestSingle(mouseX, mouseY, d);
        if (result) return result;
    }
    return null;
}

export interface DrawingHitTestData {
    id: string;
    type: DrawingType;
    pixelAnchors: PixelPoint[];
    hidden: boolean;
    locked: boolean;
    /** For text drawings, bounding box */
    boundingBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Hit-test a single drawing.
 */
export function hitTestSingle(
    mx: number,
    my: number,
    d: DrawingHitTestData
): HitResult | null {
    // 1. Check anchors first (higher priority)
    for (let i = 0; i < d.pixelAnchors.length; i++) {
        const a = d.pixelAnchors[i];
        const dist = Math.hypot(mx - a.x, my - a.y);
        if (dist <= ANCHOR_RADIUS) {
            return { drawingId: d.id, hitType: 'anchor', anchorIndex: i };
        }
    }

    // 2. Check body based on type
    switch (d.type) {
        case 'trendline':
        case 'ray':
            return hitTestLine(mx, my, d);

        case 'brush':
            return hitTestBrush(mx, my, d);

        case 'horizontal_line':
            return hitTestHorizontalLine(mx, my, d);

        case 'vertical_line':
            return hitTestVerticalLine(mx, my, d);

        case 'rectangle':
            return hitTestRectangle(mx, my, d);

        case 'text':
            return hitTestBoundingBox(mx, my, d);

        case 'fibonacci':
            return hitTestFibonacci(mx, my, d);

        case 'parallel_channel':
            return hitTestParallelChannel(mx, my, d);

        case 'measure':
            return hitTestRectangle(mx, my, d); // Reuse rectangle hit test

        case 'long_position':
        case 'short_position':
            return hitTestPosition(mx, my, d);

        default:
            return null;
    }
}

/** Point-to-segment distance check for line drawings */
function hitTestLine(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    const [p1, p2] = d.pixelAnchors;
    const dist = pointToSegmentDistance(mx, my, p1.x, p1.y, p2.x, p2.y);
    return dist <= LINE_THRESHOLD ? { drawingId: d.id, hitType: 'body' } : null;
}

function hitTestBrush(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    for (let i = 1; i < d.pixelAnchors.length; i++) {
        const p1 = d.pixelAnchors[i - 1];
        const p2 = d.pixelAnchors[i];
        const dist = pointToSegmentDistance(mx, my, p1.x, p1.y, p2.x, p2.y);
        if (dist <= LINE_THRESHOLD) {
            return { drawingId: d.id, hitType: 'body' };
        }
    }
    return null;
}

function hitTestHorizontalLine(_mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 1) return null;
    const y = d.pixelAnchors[0].y;
    return Math.abs(my - y) <= LINE_THRESHOLD ? { drawingId: d.id, hitType: 'body' } : null;
}

function hitTestVerticalLine(mx: number, _my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 1) return null;
    const x = d.pixelAnchors[0].x;
    return Math.abs(mx - x) <= LINE_THRESHOLD ? { drawingId: d.id, hitType: 'body' } : null;
}

function hitTestRectangle(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    const [p1, p2] = d.pixelAnchors;
    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);

    if (mx >= left && mx <= right && my >= top && my <= bottom) {
        return { drawingId: d.id, hitType: 'body' };
    }
    return null;
}

function hitTestFibonacci(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    // For now, hit test the diagonal line
    const [p1, p2] = d.pixelAnchors;
    const dist = pointToSegmentDistance(mx, my, p1.x, p1.y, p2.x, p2.y);
    if (dist <= LINE_THRESHOLD) {
        return { drawingId: d.id, hitType: 'body' };
    }
    // Also hit test the bounding box of levels? 
    // Usually Fib tools are selected by clicking the diagonal line.
    return null;
}

function hitTestParallelChannel(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    const [p1, p2, p3] = d.pixelAnchors;

    // 1. Central line
    let dist = pointToSegmentDistance(mx, my, p1.x, p1.y, p2.x, p2.y);
    if (dist <= LINE_THRESHOLD) return { drawingId: d.id, hitType: 'body' };

    if (!p3) return null;

    // 2. Parallel line
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    dist = pointToSegmentDistance(mx, my, p3.x, p3.y, p3.x + dx, p3.y + dy);
    if (dist <= LINE_THRESHOLD) return { drawingId: d.id, hitType: 'body' };

    // 3. Fill (if clicked inside) - Optional, for now just lines

    return null;
}

function hitTestPosition(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (d.pixelAnchors.length < 2) return null;
    const [p1, p2, p3] = d.pixelAnchors;
    // p1 = Entry, p2 = Stop, p3 = Target

    // Bounds
    const x1 = p1.x;
    const x2 = p2.x;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    const y1 = p1.y; // Entry Y
    const y2 = p2.y; // Stop Y
    let y3 = y1 - (y2 - y1); // Default Target Y
    if (p3) y3 = p3.y;

    // Full vertical range
    const top = Math.min(y2, y3);
    const bottom = Math.max(y2, y3);

    if (mx >= left && mx <= right && my >= top && my <= bottom) {
        return { drawingId: d.id, hitType: 'body' };
    }
    return null;
}

function hitTestBoundingBox(mx: number, my: number, d: DrawingHitTestData): HitResult | null {
    if (!d.boundingBox) return null;
    const { x, y, width, height } = d.boundingBox;
    if (mx >= x && mx <= x + width && my >= y && my <= y + height) {
        return { drawingId: d.id, hitType: 'body' };
    }
    return null;
}

/**
 * Compute minimum distance from point (px,py) to line segment (x1,y1)-(x2,y2).
 */
function pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        return Math.hypot(px - x1, py - y1);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.hypot(px - projX, py - projY);
}
