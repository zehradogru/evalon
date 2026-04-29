import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { BacktestBlueprint } from '@/types'
import { normalizeBlueprintCandidate } from '@/lib/backtest-blueprint'

const ACTIVE_BLUEPRINT_KEY = 'evalon-active-blueprint'
const USERS_COLLECTION = 'users'

// ─── localStorage cache (sync, instant reads) ────────────────────────────────

export function readActiveBlueprint(): BacktestBlueprint | null {
    if (typeof window === 'undefined') return null

    const raw = window.localStorage.getItem(ACTIVE_BLUEPRINT_KEY)
    if (!raw) return null

    try {
        return normalizeBlueprintCandidate(JSON.parse(raw))
    } catch {
        return null
    }
}

/**
 * Writes to localStorage immediately (for instant in-page reads) and also
 * persists to Firestore under users/{uid}.activeBlueprint (cross-device sync).
 */
export function saveActiveBlueprint(blueprint: BacktestBlueprint): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACTIVE_BLUEPRINT_KEY, JSON.stringify(blueprint))

    // Fire-and-forget Firestore write — does not block the caller
    const uid = auth.currentUser?.uid
    if (uid) {
        const userRef = doc(db, USERS_COLLECTION, uid)
        void setDoc(userRef, { activeBlueprint: blueprint }, { merge: true })
    }
}

/**
 * Clears the active blueprint from both localStorage and Firestore.
 * Used when starting a fresh AI chat session so previously selected
 * rules don't carry over.
 */
export function clearActiveBlueprint(): void {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(ACTIVE_BLUEPRINT_KEY)

    const uid = auth.currentUser?.uid
    if (uid) {
        const userRef = doc(db, USERS_COLLECTION, uid)
        void setDoc(userRef, { activeBlueprint: null }, { merge: true })
    }
}

// ─── Firestore hydration (async) ──────────────────────────────────────────────

/**
 * Reads the active blueprint from Firestore and updates the local cache.
 * Call this on mount/login to hydrate across devices.
 * Returns the blueprint if found, null otherwise.
 */
export async function loadBlueprintFromFirestore(userId: string): Promise<BacktestBlueprint | null> {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId)
        const snapshot = await getDoc(userRef)
        if (!snapshot.exists()) return null

        const raw = snapshot.data()?.activeBlueprint
        if (!raw) return null

        const blueprint = normalizeBlueprintCandidate(raw)
        if (!blueprint) return null

        // Hydrate local cache
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ACTIVE_BLUEPRINT_KEY, JSON.stringify(blueprint))
        }
        return blueprint
    } catch {
        return null
    }
}
