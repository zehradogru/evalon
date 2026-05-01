import {
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    writeBatch,
} from 'firebase/firestore'
import { User as FirebaseUser } from 'firebase/auth'

import { auth } from '@/lib/firebase'
import {
    ALERT_RULE_MAX_FILTERS,
    ALERT_RULE_MAX_ITEMS,
    getNextEvaluationAt,
    isSupportedAlertTicker,
    normalizeAlertLogic,
    normalizeAlertRuleFilters,
    normalizeAlertTicker,
    normalizeAlertTimeframe,
} from '@/lib/notification-rules'
import {
    userAlertRuleDoc,
    userAlertRulesCollection,
    userDoc,
} from '@/lib/notification-firestore'
import type {
    AlertRule,
    AlertRuleStatus,
    UserAlert,
    UserAlertOperator,
} from '@/types'
import type {
    FilterLogic,
    PriceFilter,
    ScreenerFilter,
    ScreenerTimeframe,
} from '@/types/screener'

const ALERTS_MIGRATION_FIELD = 'alertsMigrationAt'

export interface SaveAlertRulePayload {
    ticker: string
    timeframe: ScreenerTimeframe
    logic: FilterLogic
    filters: ScreenerFilter[]
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

function normalizeLegacyOperator(value: unknown): UserAlertOperator | null {
    return value === 'gt' || value === 'lt' ? value : null
}

function normalizeLegacyAlert(rawValue: unknown): UserAlert | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.id !== 'string' || typeof rawValue.ticker !== 'string') {
        return null
    }

    const operator = normalizeLegacyOperator(rawValue.operator)
    const targetPrice =
        typeof rawValue.targetPrice === 'number' &&
        Number.isFinite(rawValue.targetPrice) &&
        rawValue.targetPrice > 0
            ? rawValue.targetPrice
            : null

    if (!operator || targetPrice === null) {
        return null
    }

    return {
        id: rawValue.id,
        ticker: normalizeAlertTicker(rawValue.ticker),
        operator,
        targetPrice,
        status: rawValue.status === 'triggered' ? 'triggered' : 'active',
        createdAt:
            typeof rawValue.createdAt === 'string'
                ? rawValue.createdAt
                : new Date().toISOString(),
        updatedAt:
            typeof rawValue.updatedAt === 'string'
                ? rawValue.updatedAt
                : new Date().toISOString(),
    }
}

function legacyAlertToPriceFilter(alert: UserAlert): PriceFilter {
    return {
        type: 'price',
        op: alert.operator,
        value: alert.targetPrice,
    }
}

function legacyAlertToRule(alert: UserAlert): AlertRule | null {
    if (!isSupportedAlertTicker(alert.ticker)) {
        return null
    }

    return {
        id: alert.id,
        ticker: alert.ticker,
        timeframe: '1d',
        logic: 'AND',
        filters: [legacyAlertToPriceFilter(alert)],
        status: alert.status === 'triggered' ? 'paused' : 'active',
        lastMatchState: alert.status === 'triggered',
        lastTriggeredAt: alert.status === 'triggered' ? alert.updatedAt : null,
        lastEvaluatedAt: null,
        nextEvaluationAt: getNextEvaluationAt([legacyAlertToPriceFilter(alert)], '1d'),
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
    }
}

function normalizeAlertRuleStatus(value: unknown): AlertRuleStatus {
    return value === 'paused' ? 'paused' : 'active'
}

function normalizeAlertRule(
    ruleId: string,
    rawValue: unknown
): AlertRule | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.ticker !== 'string') return null

    const ticker = normalizeAlertTicker(rawValue.ticker)
    if (!isSupportedAlertTicker(ticker)) return null

    const filters = normalizeAlertRuleFilters(rawValue.filters)
    if (filters.length === 0) return null

    const timeframe = normalizeAlertTimeframe(rawValue.timeframe)
    const logic = normalizeAlertLogic(rawValue.logic)
    const now = new Date().toISOString()

    return {
        id: ruleId,
        ticker,
        timeframe,
        logic,
        filters,
        status: normalizeAlertRuleStatus(rawValue.status),
        lastMatchState:
            typeof rawValue.lastMatchState === 'boolean'
                ? rawValue.lastMatchState
                : null,
        lastTriggeredAt:
            typeof rawValue.lastTriggeredAt === 'string'
                ? rawValue.lastTriggeredAt
                : null,
        lastEvaluatedAt:
            typeof rawValue.lastEvaluatedAt === 'string'
                ? rawValue.lastEvaluatedAt
                : null,
        nextEvaluationAt:
            typeof rawValue.nextEvaluationAt === 'string'
                ? rawValue.nextEvaluationAt
                : getNextEvaluationAt(filters, timeframe),
        createdAt:
            typeof rawValue.createdAt === 'string' ? rawValue.createdAt : now,
        updatedAt:
            typeof rawValue.updatedAt === 'string' ? rawValue.updatedAt : now,
    }
}

function sortRules(rules: AlertRule[]): AlertRule[] {
    return [...rules].sort(
        (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
    )
}

function assertRulePayload(payload: SaveAlertRulePayload): SaveAlertRulePayload {
    const ticker = normalizeAlertTicker(payload.ticker)
    if (!isSupportedAlertTicker(ticker)) {
        throw new Error(`${payload.ticker} is not supported for alerts`)
    }

    const timeframe = normalizeAlertTimeframe(payload.timeframe)
    const logic = normalizeAlertLogic(payload.logic)
    const filters = normalizeAlertRuleFilters(payload.filters)

    if (filters.length === 0) {
        throw new Error('Add at least one condition')
    }

    if (filters.length > ALERT_RULE_MAX_FILTERS) {
        throw new Error(
            `A maximum of ${ALERT_RULE_MAX_FILTERS} conditions is allowed`
        )
    }

    return {
        ticker,
        timeframe,
        logic,
        filters,
    }
}

async function migrateLegacyAlertsIfNeeded(userId: string) {
    const userRef = userDoc(userId)
    const snapshot = await getDoc(userRef)
    if (!snapshot.exists()) {
        return
    }

    const data = snapshot.data()
    if (
        data &&
        typeof data === 'object' &&
        ALERTS_MIGRATION_FIELD in data &&
        typeof data[ALERTS_MIGRATION_FIELD] === 'string'
    ) {
        return
    }

    const rulesSnapshot = await getDocs(query(userAlertRulesCollection(userId)))
    const legacyAlerts: unknown[] = Array.isArray(snapshot.data().alerts)
        ? snapshot.data().alerts
        : []

    const batch = writeBatch(userRef.firestore)
    const now = new Date().toISOString()

    if (rulesSnapshot.empty) {
        legacyAlerts
            .map((alert: unknown) => normalizeLegacyAlert(alert))
            .filter((alert): alert is UserAlert => alert !== null)
            .slice(0, ALERT_RULE_MAX_ITEMS)
            .forEach((alert) => {
                const rule = legacyAlertToRule(alert)
                if (!rule) return

                batch.set(userAlertRuleDoc(userId, rule.id), {
                    ticker: rule.ticker,
                    timeframe: rule.timeframe,
                    logic: rule.logic,
                    filters: rule.filters,
                    status: rule.status,
                    lastMatchState: rule.lastMatchState,
                    lastTriggeredAt: rule.lastTriggeredAt,
                    lastEvaluatedAt: rule.lastEvaluatedAt,
                    nextEvaluationAt: rule.nextEvaluationAt,
                    createdAt: rule.createdAt,
                    updatedAt: rule.updatedAt,
                })
            })
    }

    batch.set(userRef, { [ALERTS_MIGRATION_FIELD]: now }, { merge: true })
    await batch.commit()
}

function stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => stripUndefinedDeep(item)) as T
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).flatMap(([key, currentValue]) =>
                currentValue === undefined
                    ? []
                    : [[key, stripUndefinedDeep(currentValue)]]
            )
        ) as T
    }

    return value
}

function toStoredRule(rule: AlertRule): Omit<AlertRule, 'id'> {
    return {
        ticker: rule.ticker,
        timeframe: rule.timeframe,
        logic: rule.logic,
        filters: stripUndefinedDeep(rule.filters),
        status: rule.status,
        lastMatchState: rule.lastMatchState,
        lastTriggeredAt: rule.lastTriggeredAt,
        lastEvaluatedAt: rule.lastEvaluatedAt,
        nextEvaluationAt: rule.nextEvaluationAt,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
    }
}

export const alertRulesService = {
    async getOrCreateRules(): Promise<AlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        await migrateLegacyAlertsIfNeeded(firebaseUser.uid)

        const snapshot = await getDocs(query(userAlertRulesCollection(firebaseUser.uid)))
        const rules = snapshot.docs
            .map((ruleSnapshot) =>
                normalizeAlertRule(ruleSnapshot.id, ruleSnapshot.data())
            )
            .filter((rule): rule is AlertRule => rule !== null)

        return sortRules(rules)
    },

    async createRule(payload: SaveAlertRulePayload): Promise<AlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const validated = assertRulePayload(payload)
        const currentRules = await this.getOrCreateRules()

        if (currentRules.length >= ALERT_RULE_MAX_ITEMS) {
            throw new Error(`A maximum of ${ALERT_RULE_MAX_ITEMS} rules is allowed`)
        }

        const now = new Date().toISOString()
        const ruleRef = doc(userAlertRulesCollection(firebaseUser.uid))
        const nextRule: AlertRule = {
            id: ruleRef.id,
            ticker: validated.ticker,
            timeframe: validated.timeframe,
            logic: validated.logic,
            filters: validated.filters,
            status: 'active',
            lastMatchState: null,
            lastTriggeredAt: null,
            lastEvaluatedAt: null,
            nextEvaluationAt: getNextEvaluationAt(
                validated.filters,
                validated.timeframe
            ),
            createdAt: now,
            updatedAt: now,
        }

        await setDoc(ruleRef, toStoredRule(nextRule))
        return sortRules([...currentRules, nextRule])
    },

    async updateRule(
        ruleId: string,
        payload: SaveAlertRulePayload
    ): Promise<AlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const validated = assertRulePayload(payload)
        const currentRules = await this.getOrCreateRules()
        const existingRule = currentRules.find((rule) => rule.id === ruleId)

        if (!existingRule) {
            throw new Error('Rule could not be found')
        }

        const nextRule: AlertRule = {
            ...existingRule,
            ticker: validated.ticker,
            timeframe: validated.timeframe,
            logic: validated.logic,
            filters: validated.filters,
            lastMatchState: null,
            lastEvaluatedAt: null,
            nextEvaluationAt: getNextEvaluationAt(
                validated.filters,
                validated.timeframe
            ),
            updatedAt: new Date().toISOString(),
        }

        await setDoc(
            userAlertRuleDoc(firebaseUser.uid, ruleId),
            toStoredRule(nextRule),
            { merge: true }
        )

        return sortRules(
            currentRules.map((rule) => (rule.id === ruleId ? nextRule : rule))
        )
    },

    async setRuleStatus(
        ruleId: string,
        status: AlertRuleStatus
    ): Promise<AlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const currentRules = await this.getOrCreateRules()
        const existingRule = currentRules.find((rule) => rule.id === ruleId)

        if (!existingRule) {
            throw new Error('Rule could not be found')
        }

        const nextRule: AlertRule = {
            ...existingRule,
            status,
            nextEvaluationAt:
                status === 'active'
                    ? getNextEvaluationAt(
                          existingRule.filters,
                          existingRule.timeframe
                      )
                    : existingRule.nextEvaluationAt,
            updatedAt: new Date().toISOString(),
        }

        await setDoc(
            userAlertRuleDoc(firebaseUser.uid, ruleId),
            toStoredRule(nextRule),
            { merge: true }
        )

        return sortRules(
            currentRules.map((rule) => (rule.id === ruleId ? nextRule : rule))
        )
    },

    async deleteRule(ruleId: string): Promise<AlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const currentRules = await this.getOrCreateRules()
        await deleteDoc(userAlertRuleDoc(firebaseUser.uid, ruleId))
        return sortRules(currentRules.filter((rule) => rule.id !== ruleId))
    },
}
