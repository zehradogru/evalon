import type { CandleData } from '@graph/shared-types';

/**
 * Snap-to-OHLC (magnet) logic.
 * When magnet mode is ON, anchor points snap to the nearest O/H/L/C value
 * of the closest bar if within a pixel threshold.
 */

export interface SnapResult {
    snapped: boolean;
    time: number;
    price: number;
    snapTarget?: 'open' | 'high' | 'low' | 'close';
}

/**
 * Find the nearest OHLC value to snag onto.
 *
 * @param targetTime - The raw time coordinate (seconds)
 * @param targetPrice - The raw price coordinate
 * @param bars - Array of candle data (must be sorted by time)
 * @param priceToY - Function to convert price to Y pixel
 * @param thresholdPx - Snap threshold in pixels (default 8)
 * @returns SnapResult with snapped coordinates if within threshold
 */
export function snapToOHLC(
    targetTime: number,
    targetPrice: number,
    bars: CandleData[],
    priceToY: (price: number) => number | null,
    thresholdPx: number = 8
): SnapResult {
    if (bars.length === 0) {
        return { snapped: false, time: targetTime, price: targetPrice };
    }

    // Binary search for nearest bar by time
    const barIndex = findNearestBarIndex(bars, targetTime);
    const bar = bars[barIndex];

    if (!bar) {
        return { snapped: false, time: targetTime, price: targetPrice };
    }

    const targetY = priceToY(targetPrice);
    if (targetY === null) {
        return { snapped: false, time: targetTime, price: targetPrice };
    }

    // Check each OHLC value
    const ohlcValues: Array<{ price: number; label: 'open' | 'high' | 'low' | 'close' }> = [
        { price: bar.o, label: 'open' },
        { price: bar.h, label: 'high' },
        { price: bar.l, label: 'low' },
        { price: bar.c, label: 'close' },
    ];

    let minDist = Infinity;
    let bestSnap: SnapResult = { snapped: false, time: targetTime, price: targetPrice };

    for (const { price, label } of ohlcValues) {
        const y = priceToY(price);
        if (y === null) continue;

        const dist = Math.abs(y - targetY);
        if (dist < thresholdPx && dist < minDist) {
            minDist = dist;
            bestSnap = {
                snapped: true,
                time: bar.t,
                price: price,
                snapTarget: label,
            };
        }
    }

    return bestSnap;
}

/**
 * Binary search for the bar closest to the given timestamp.
 */
function findNearestBarIndex(bars: CandleData[], time: number): number {
    let lo = 0;
    let hi = bars.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (bars[mid].t < time) {
            lo = mid + 1;
        } else if (bars[mid].t > time) {
            hi = mid - 1;
        } else {
            return mid;
        }
    }

    // Return the closer of lo and hi
    if (lo >= bars.length) return bars.length - 1;
    if (hi < 0) return 0;
    return Math.abs(bars[lo].t - time) < Math.abs(bars[hi].t - time) ? lo : hi;
}
