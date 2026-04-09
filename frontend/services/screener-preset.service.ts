import { User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
    ListSortDirection,
    MarketListSortField,
    UserScreenerPreset,
} from '@/types'

const USERS_COLLECTION = 'users'
const PRESETS_MAX_ITEMS = 20

const VALID_SORT_FIELDS: MarketListSortField[] = [
    'ticker',
    'price',
    'changePct',
    'changeVal',
    'high',
    'low',
    'vol',
    'rating',
    'marketCap',
    'pe',
    'eps',
    'sector',
]

export interface SaveScreenerPresetPayload {
    name: string
    search: string
    sortBy: MarketListSortField
    sortDir: ListSortDirection
}

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

function isSortField(value: unknown): value is MarketListSortField {
    return typeof value === 'string' && VALID_SORT_FIELDS.includes(value as MarketListSortField)
}

function isSortDirection(value: unknown): value is ListSortDirection {
    return value === 'asc' || value === 'desc'
}

function normalizePreset(rawValue: unknown): UserScreenerPreset | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.id !== 'string') return null
    if (typeof rawValue.name !== 'string') return null
    if (typeof rawValue.search !== 'string') return null
    if (!isSortField(rawValue.sortBy)) return null
    if (!isSortDirection(rawValue.sortDir)) return null

    const trimmedName = rawValue.name.trim()
    if (!trimmedName) return null

    const now = new Date().toISOString()
    return {
        id: rawValue.id,
        name: trimmedName,
        search: rawValue.search.trim(),
        sortBy: rawValue.sortBy,
        sortDir: rawValue.sortDir,
        createdAt: typeof rawValue.createdAt === 'string' ? rawValue.createdAt : now,
        updatedAt: typeof rawValue.updatedAt === 'string' ? rawValue.updatedAt : now,
    }
}

function normalizePresets(rawValue: unknown): UserScreenerPreset[] {
    if (!Array.isArray(rawValue)) return []

    const presets: UserScreenerPreset[] = []
    const seenIds = new Set<string>()

    for (const item of rawValue) {
        const preset = normalizePreset(item)
        if (!preset) continue
        if (seenIds.has(preset.id)) continue
        if (presets.length >= PRESETS_MAX_ITEMS) break
        seenIds.add(preset.id)
        presets.push(preset)
    }

    return presets
}

function arePresetsEqual(left: UserScreenerPreset[], right: UserScreenerPreset[]): boolean {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i += 1) {
        const leftItem = left[i]
        const rightItem = right[i]
        if (
            leftItem.id !== rightItem.id ||
            leftItem.name !== rightItem.name ||
            leftItem.search !== rightItem.search ||
            leftItem.sortBy !== rightItem.sortBy ||
            leftItem.sortDir !== rightItem.sortDir ||
            leftItem.createdAt !== rightItem.createdAt ||
            leftItem.updatedAt !== rightItem.updatedAt
        ) {
            return false
        }
    }
    return true
}

function validatePayload(
    payload: SaveScreenerPresetPayload
): SaveScreenerPresetPayload {
    const name = payload.name.trim()
    if (!name) {
        throw new Error('Preset name is required')
    }
    if (name.length > 40) {
        throw new Error('Preset name can be at most 40 characters')
    }
    if (!isSortField(payload.sortBy)) {
        throw new Error('Preset sort field is invalid')
    }
    if (!isSortDirection(payload.sortDir)) {
        throw new Error('Preset sort direction is invalid')
    }

    return {
        name,
        search: payload.search.trim(),
        sortBy: payload.sortBy,
        sortDir: payload.sortDir,
    }
}

async function savePresets(
    userId: string,
    screenerPresets: UserScreenerPreset[]
): Promise<UserScreenerPreset[]> {
    const userRef = doc(db, USERS_COLLECTION, userId)
    await setDoc(userRef, { screenerPresets }, { merge: true })
    return screenerPresets
}

export const screenerPresetService = {
    async getOrCreatePresets(): Promise<UserScreenerPreset[]> {
        const firebaseUser = ensureCurrentUser()
        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
            return savePresets(firebaseUser.uid, [])
        }

        const rawPresets = snapshot.data().screenerPresets
        const normalized = normalizePresets(rawPresets)

        if (!Array.isArray(rawPresets) || !arePresetsEqual(normalized, rawPresets as UserScreenerPreset[])) {
            return savePresets(firebaseUser.uid, normalized)
        }

        return normalized
    },

    async savePreset(payload: SaveScreenerPresetPayload): Promise<UserScreenerPreset[]> {
        const firebaseUser = ensureCurrentUser()
        const validated = validatePayload(payload)
        const currentPresets = await this.getOrCreatePresets()
        const now = new Date().toISOString()

        const existingIndex = currentPresets.findIndex(
            (preset) =>
                preset.name.toLocaleLowerCase('tr-TR') ===
                validated.name.toLocaleLowerCase('tr-TR')
        )

        if (existingIndex >= 0) {
            const updatedPresets = [...currentPresets]
            updatedPresets[existingIndex] = {
                ...updatedPresets[existingIndex],
                search: validated.search,
                sortBy: validated.sortBy,
                sortDir: validated.sortDir,
                updatedAt: now,
            }
            return savePresets(firebaseUser.uid, updatedPresets)
        }

        if (currentPresets.length >= PRESETS_MAX_ITEMS) {
            throw new Error(`A maximum of ${PRESETS_MAX_ITEMS} presets is allowed`)
        }

        const nextPreset: UserScreenerPreset = {
            id: crypto.randomUUID(),
            name: validated.name,
            search: validated.search,
            sortBy: validated.sortBy,
            sortDir: validated.sortDir,
            createdAt: now,
            updatedAt: now,
        }

        return savePresets(firebaseUser.uid, [...currentPresets, nextPreset])
    },

    async deletePreset(presetId: string): Promise<UserScreenerPreset[]> {
        const firebaseUser = ensureCurrentUser()
        const currentPresets = await this.getOrCreatePresets()
        const nextPresets = currentPresets.filter((preset) => preset.id !== presetId)
        if (nextPresets.length === currentPresets.length) {
            return currentPresets
        }
        return savePresets(firebaseUser.uid, nextPresets)
    },
}
