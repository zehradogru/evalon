import { User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { BIST_AVAILABLE } from '@/config/markets'
import type { UserAlert, UserAlertOperator, UserAlertStatus } from '@/types'

const USERS_COLLECTION = 'users'
const ALERTS_MAX_ITEMS = 50
const VALID_BIST_TICKERS = new Set(BIST_AVAILABLE as readonly string[])

export interface CreateAlertPayload {
    ticker: string
    operator: UserAlertOperator
    targetPrice: number
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

function normalizeTicker(ticker: string): string {
    return ticker.trim().toUpperCase()
}

function isValidTicker(ticker: string): boolean {
    return VALID_BIST_TICKERS.has(ticker)
}

function isAlertOperator(value: unknown): value is UserAlertOperator {
    return value === 'gt' || value === 'lt'
}

function isAlertStatus(value: unknown): value is UserAlertStatus {
    return value === 'active' || value === 'triggered'
}

function normalizeAlert(rawValue: unknown): UserAlert | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.id !== 'string') return null
    if (typeof rawValue.ticker !== 'string') return null
    if (!isAlertOperator(rawValue.operator)) return null
    if (typeof rawValue.targetPrice !== 'number' || !Number.isFinite(rawValue.targetPrice)) {
        return null
    }

    const ticker = normalizeTicker(rawValue.ticker)
    if (!isValidTicker(ticker)) return null

    const now = new Date().toISOString()

    return {
        id: rawValue.id,
        ticker,
        operator: rawValue.operator,
        targetPrice: rawValue.targetPrice,
        status: isAlertStatus(rawValue.status) ? rawValue.status : 'active',
        createdAt: typeof rawValue.createdAt === 'string' ? rawValue.createdAt : now,
        updatedAt: typeof rawValue.updatedAt === 'string' ? rawValue.updatedAt : now,
    }
}

function normalizeAlerts(rawValue: unknown): UserAlert[] {
    if (!Array.isArray(rawValue)) return []

    const alerts: UserAlert[] = []
    const seenIds = new Set<string>()

    for (const item of rawValue) {
        const normalized = normalizeAlert(item)
        if (!normalized) continue
        if (seenIds.has(normalized.id)) continue
        if (alerts.length >= ALERTS_MAX_ITEMS) break
        seenIds.add(normalized.id)
        alerts.push(normalized)
    }

    return alerts
}

function areAlertsEqual(left: UserAlert[], right: UserAlert[]): boolean {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i += 1) {
        const leftItem = left[i]
        const rightItem = right[i]
        if (
            leftItem.id !== rightItem.id ||
            leftItem.ticker !== rightItem.ticker ||
            leftItem.operator !== rightItem.operator ||
            leftItem.targetPrice !== rightItem.targetPrice ||
            leftItem.status !== rightItem.status ||
            leftItem.createdAt !== rightItem.createdAt ||
            leftItem.updatedAt !== rightItem.updatedAt
        ) {
            return false
        }
    }
    return true
}

function assertAlertPayload(payload: CreateAlertPayload): {
    ticker: string
    operator: UserAlertOperator
    targetPrice: number
} {
    const ticker = normalizeTicker(payload.ticker)
    if (!isValidTicker(ticker)) {
        throw new Error(`${payload.ticker} is not supported for alerts`)
    }

    if (!isAlertOperator(payload.operator)) {
        throw new Error('Alert operator must be gt or lt')
    }

    if (!Number.isFinite(payload.targetPrice) || payload.targetPrice <= 0) {
        throw new Error('Target price must be greater than zero')
    }

    return {
        ticker,
        operator: payload.operator,
        targetPrice: payload.targetPrice,
    }
}

async function saveAlerts(userId: string, alerts: UserAlert[]): Promise<UserAlert[]> {
    const userRef = doc(db, USERS_COLLECTION, userId)
    await setDoc(userRef, { alerts }, { merge: true })
    return alerts
}

export const alertsService = {
    async getOrCreateAlerts(): Promise<UserAlert[]> {
        const firebaseUser = ensureCurrentUser()
        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
            return saveAlerts(firebaseUser.uid, [])
        }

        const rawAlerts = snapshot.data().alerts
        const normalizedAlerts = normalizeAlerts(rawAlerts)

        if (!Array.isArray(rawAlerts) || !areAlertsEqual(normalizedAlerts, rawAlerts as UserAlert[])) {
            return saveAlerts(firebaseUser.uid, normalizedAlerts)
        }

        return normalizedAlerts
    },

    async addAlert(payload: CreateAlertPayload): Promise<UserAlert[]> {
        const firebaseUser = ensureCurrentUser()
        const { ticker, operator, targetPrice } = assertAlertPayload(payload)
        const currentAlerts = await this.getOrCreateAlerts()

        if (currentAlerts.length >= ALERTS_MAX_ITEMS) {
            throw new Error(`A maximum of ${ALERTS_MAX_ITEMS} alerts is allowed`)
        }

        const now = new Date().toISOString()
        const nextAlert: UserAlert = {
            id: crypto.randomUUID(),
            ticker,
            operator,
            targetPrice,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        }

        return saveAlerts(firebaseUser.uid, [...currentAlerts, nextAlert])
    },

    async removeAlert(alertId: string): Promise<UserAlert[]> {
        const firebaseUser = ensureCurrentUser()
        const currentAlerts = await this.getOrCreateAlerts()
        const nextAlerts = currentAlerts.filter((alert) => alert.id !== alertId)
        if (nextAlerts.length === currentAlerts.length) {
            return currentAlerts
        }

        return saveAlerts(firebaseUser.uid, nextAlerts)
    },
}
