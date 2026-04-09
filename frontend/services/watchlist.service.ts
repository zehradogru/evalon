import { User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { BIST_AVAILABLE, BIST_POPULAR } from '@/config/markets'
import type { UserWatchlist } from '@/types'

const USERS_COLLECTION = 'users'
const WATCHLIST_MAX_ITEMS = 30
const DEFAULT_WATCHLIST_TICKERS = [...BIST_POPULAR.slice(0, 6)]
const VALID_BIST_TICKERS = new Set(BIST_AVAILABLE as readonly string[])

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function ensureCurrentUser(): FirebaseUser {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
        throw new Error('User is not authenticated')
    }
    return firebaseUser
}

function normalizeTicker(ticker: string): string {
    return ticker.trim().toUpperCase()
}

function isValidTicker(ticker: string): boolean {
    return VALID_BIST_TICKERS.has(ticker)
}

function normalizeTickers(rawValue: unknown, fallbackToDefault: boolean): string[] {
    if (!Array.isArray(rawValue)) {
        return fallbackToDefault ? [...DEFAULT_WATCHLIST_TICKERS] : []
    }

    const deduped: string[] = []
    const seen = new Set<string>()

    rawValue.forEach((value) => {
        if (typeof value !== 'string') return
        const normalized = normalizeTicker(value)
        if (!isValidTicker(normalized)) return
        if (seen.has(normalized)) return
        if (deduped.length >= WATCHLIST_MAX_ITEMS) return
        seen.add(normalized)
        deduped.push(normalized)
    })

    if (deduped.length === 0 && fallbackToDefault) {
        return [...DEFAULT_WATCHLIST_TICKERS]
    }

    return deduped
}

function normalizeWatchlist(rawValue: unknown): UserWatchlist {
    const now = new Date().toISOString()

    if (!isRecord(rawValue)) {
        return {
            tickers: [...DEFAULT_WATCHLIST_TICKERS],
            updatedAt: now,
        }
    }

    return {
        tickers: normalizeTickers(rawValue.tickers, false),
        updatedAt:
            typeof rawValue.updatedAt === 'string' ? rawValue.updatedAt : now,
    }
}

function isStoredWatchlistClean(rawValue: Record<string, unknown>): boolean {
    if (!Array.isArray(rawValue.tickers)) return false
    if (typeof rawValue.updatedAt !== 'string') return false
    if (rawValue.tickers.length > WATCHLIST_MAX_ITEMS) return false

    const seen = new Set<string>()

    for (const value of rawValue.tickers) {
        if (typeof value !== 'string') return false
        const normalized = normalizeTicker(value)
        if (value !== normalized) return false
        if (!isValidTicker(normalized)) return false
        if (seen.has(normalized)) return false
        seen.add(normalized)
    }

    return true
}

function areTickersEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return false
    }
    return true
}

function validateReplacePayload(tickers: string[]): string[] {
    const normalized: string[] = []
    const seen = new Set<string>()

    for (const ticker of tickers) {
        const nextTicker = normalizeTicker(ticker)
        if (!isValidTicker(nextTicker)) {
            throw new Error(`${ticker} is not supported in BIST watchlist`)
        }
        if (seen.has(nextTicker)) continue
        seen.add(nextTicker)
        normalized.push(nextTicker)
    }

    if (normalized.length > WATCHLIST_MAX_ITEMS) {
        throw new Error(`Watchlist can include at most ${WATCHLIST_MAX_ITEMS} tickers`)
    }

    return normalized
}

async function saveWatchlist(userId: string, tickers: string[]): Promise<UserWatchlist> {
    const watchlist: UserWatchlist = {
        tickers,
        updatedAt: new Date().toISOString(),
    }
    const userRef = doc(db, USERS_COLLECTION, userId)
    await setDoc(userRef, { watchlist }, { merge: true })
    return watchlist
}

export const watchlistService = {
    async getOrCreateWatchlist(): Promise<UserWatchlist> {
        const firebaseUser = ensureCurrentUser()
        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        const snapshot = await getDoc(userRef)

        const normalizedWatchlist = snapshot.exists()
            ? normalizeWatchlist(snapshot.data().watchlist)
            : normalizeWatchlist(undefined)

        if (!snapshot.exists()) {
            return saveWatchlist(firebaseUser.uid, normalizedWatchlist.tickers)
        }

        const rawWatchlist = snapshot.data().watchlist
        if (!isRecord(rawWatchlist)) {
            return saveWatchlist(firebaseUser.uid, [...DEFAULT_WATCHLIST_TICKERS])
        }

        if (!isStoredWatchlistClean(rawWatchlist)) {
            const cleanedTickers = normalizeTickers(rawWatchlist.tickers, true)
            return saveWatchlist(firebaseUser.uid, cleanedTickers)
        }

        if (!areTickersEqual(normalizedWatchlist.tickers, rawWatchlist.tickers as string[])) {
            return saveWatchlist(firebaseUser.uid, normalizedWatchlist.tickers)
        }

        return normalizedWatchlist
    },

    async replaceTickers(tickers: string[]): Promise<UserWatchlist> {
        const firebaseUser = ensureCurrentUser()
        const normalizedTickers = validateReplacePayload(tickers)
        return saveWatchlist(firebaseUser.uid, normalizedTickers)
    },

    async addTicker(ticker: string): Promise<UserWatchlist> {
        const firebaseUser = ensureCurrentUser()
        const nextTicker = normalizeTicker(ticker)
        if (!isValidTicker(nextTicker)) {
            throw new Error(`${ticker} is not supported in BIST watchlist`)
        }

        const current = await this.getOrCreateWatchlist()
        if (current.tickers.includes(nextTicker)) {
            return current
        }

        if (current.tickers.length >= WATCHLIST_MAX_ITEMS) {
            throw new Error(`Watchlist can include at most ${WATCHLIST_MAX_ITEMS} tickers`)
        }

        return saveWatchlist(firebaseUser.uid, [...current.tickers, nextTicker])
    },

    async removeTicker(ticker: string): Promise<UserWatchlist> {
        const firebaseUser = ensureCurrentUser()
        const target = normalizeTicker(ticker)
        const current = await this.getOrCreateWatchlist()
        if (!current.tickers.includes(target)) {
            return current
        }

        return saveWatchlist(
            firebaseUser.uid,
            current.tickers.filter((item) => item !== target)
        )
    },
}

export { WATCHLIST_MAX_ITEMS }
