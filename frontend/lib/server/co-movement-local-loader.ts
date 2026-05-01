import type * as CoMovementFallback from './co-movement-fallback'

export async function loadCoMovementFallback(): Promise<
    typeof CoMovementFallback | null
> {
    return import('./co-movement-fallback')
}
