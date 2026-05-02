import {
    deleteDoc,
    doc,
    getDocs,
    query,
    setDoc,
} from 'firebase/firestore'
import { User as FirebaseUser } from 'firebase/auth'

import { auth } from '@/lib/firebase'
import {
    userNewsAlertRuleDoc,
    userNewsAlertRulesCollection,
} from '@/lib/notification-firestore'
import type {
    AlertRuleStatus,
    NewsAlertSentiment,
    WatchlistNewsAlertRule,
} from '@/types'

const WATCHLIST_NEWS_BURST_WINDOW_MINUTES = 10 as const
const WATCHLIST_NEWS_RULE_LIMIT = 1
const NEWS_ALERT_SENTIMENT_VALUES = new Set<NewsAlertSentiment>([
    'OLUMLU',
    'OLUMSUZ',
    'NOTR',
])

export interface SaveWatchlistNewsAlertRulePayload {
    sentiments: NewsAlertSentiment[]
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

function normalizeSentiment(value: unknown): NewsAlertSentiment | null {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim().toUpperCase()
    if (normalized === 'NÖTR') {
        return 'NOTR'
    }

    return NEWS_ALERT_SENTIMENT_VALUES.has(normalized as NewsAlertSentiment)
        ? (normalized as NewsAlertSentiment)
        : null
}

function normalizeSentiments(rawValue: unknown): NewsAlertSentiment[] {
    if (!Array.isArray(rawValue)) {
        return []
    }

    const deduped: NewsAlertSentiment[] = []
    const seen = new Set<NewsAlertSentiment>()

    rawValue.forEach((value) => {
        const sentiment = normalizeSentiment(value)
        if (!sentiment || seen.has(sentiment)) {
            return
        }

        seen.add(sentiment)
        deduped.push(sentiment)
    })

    return deduped
}

function normalizeRuleStatus(value: unknown): AlertRuleStatus {
    return value === 'paused' ? 'paused' : 'active'
}

function normalizeRule(
    ruleId: string,
    rawValue: unknown
): WatchlistNewsAlertRule | null {
    if (!isRecord(rawValue)) {
        return null
    }

    const sentiments = normalizeSentiments(rawValue.sentiments)
    if (sentiments.length === 0) {
        return null
    }

    const now = new Date().toISOString()

    return {
        id: ruleId,
        status: normalizeRuleStatus(rawValue.status),
        scopeType: 'watchlist',
        sentiments,
        burstWindowMinutes: WATCHLIST_NEWS_BURST_WINDOW_MINUTES,
        lastCheckedAt:
            typeof rawValue.lastCheckedAt === 'string'
                ? rawValue.lastCheckedAt
                : null,
        lastTriggeredAt:
            typeof rawValue.lastTriggeredAt === 'string'
                ? rawValue.lastTriggeredAt
                : null,
        lastEvaluatedAt:
            typeof rawValue.lastEvaluatedAt === 'string'
                ? rawValue.lastEvaluatedAt
                : null,
        createdAt:
            typeof rawValue.createdAt === 'string' ? rawValue.createdAt : now,
        updatedAt:
            typeof rawValue.updatedAt === 'string' ? rawValue.updatedAt : now,
    }
}

function sortRules(rules: WatchlistNewsAlertRule[]): WatchlistNewsAlertRule[] {
    return [...rules].sort(
        (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
    )
}

function assertPayload(
    payload: SaveWatchlistNewsAlertRulePayload
): SaveWatchlistNewsAlertRulePayload {
    const sentiments = normalizeSentiments(payload.sentiments)
    if (sentiments.length === 0) {
        throw new Error('Select at least one sentiment')
    }

    return { sentiments }
}

function toStoredRule(rule: WatchlistNewsAlertRule) {
    return {
        status: rule.status,
        scopeType: rule.scopeType,
        sentiments: rule.sentiments,
        burstWindowMinutes: rule.burstWindowMinutes,
        lastCheckedAt: rule.lastCheckedAt,
        lastTriggeredAt: rule.lastTriggeredAt,
        lastEvaluatedAt: rule.lastEvaluatedAt,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
    }
}

export const newsAlertRulesService = {
    async getRules(): Promise<WatchlistNewsAlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const snapshot = await getDocs(query(userNewsAlertRulesCollection(firebaseUser.uid)))

        return sortRules(
            snapshot.docs
                .map((ruleSnapshot) =>
                    normalizeRule(ruleSnapshot.id, ruleSnapshot.data())
                )
                .filter((rule): rule is WatchlistNewsAlertRule => rule !== null)
        )
    },

    async createRule(
        payload: SaveWatchlistNewsAlertRulePayload
    ): Promise<WatchlistNewsAlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const validated = assertPayload(payload)
        const currentRules = await this.getRules()

        if (currentRules.length >= WATCHLIST_NEWS_RULE_LIMIT) {
            throw new Error('Only one watchlist news rule is supported in this version')
        }

        const now = new Date().toISOString()
        const ruleRef = doc(userNewsAlertRulesCollection(firebaseUser.uid))
        const nextRule: WatchlistNewsAlertRule = {
            id: ruleRef.id,
            status: 'active',
            scopeType: 'watchlist',
            sentiments: validated.sentiments,
            burstWindowMinutes: WATCHLIST_NEWS_BURST_WINDOW_MINUTES,
            lastCheckedAt: null,
            lastTriggeredAt: null,
            lastEvaluatedAt: null,
            createdAt: now,
            updatedAt: now,
        }

        await setDoc(ruleRef, toStoredRule(nextRule))
        return [nextRule]
    },

    async updateRule(
        ruleId: string,
        payload: SaveWatchlistNewsAlertRulePayload
    ): Promise<WatchlistNewsAlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const validated = assertPayload(payload)
        const currentRules = await this.getRules()
        const existingRule = currentRules.find((rule) => rule.id === ruleId)

        if (!existingRule) {
            throw new Error('News rule could not be found')
        }

        const nextRule: WatchlistNewsAlertRule = {
            ...existingRule,
            sentiments: validated.sentiments,
            updatedAt: new Date().toISOString(),
        }

        await setDoc(
            userNewsAlertRuleDoc(firebaseUser.uid, ruleId),
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
    ): Promise<WatchlistNewsAlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const currentRules = await this.getRules()
        const existingRule = currentRules.find((rule) => rule.id === ruleId)

        if (!existingRule) {
            throw new Error('News rule could not be found')
        }

        const nextRule: WatchlistNewsAlertRule = {
            ...existingRule,
            status,
            updatedAt: new Date().toISOString(),
        }

        await setDoc(
            userNewsAlertRuleDoc(firebaseUser.uid, ruleId),
            toStoredRule(nextRule),
            { merge: true }
        )

        return sortRules(
            currentRules.map((rule) => (rule.id === ruleId ? nextRule : rule))
        )
    },

    async deleteRule(ruleId: string): Promise<WatchlistNewsAlertRule[]> {
        const firebaseUser = ensureCurrentUser()
        const currentRules = await this.getRules()
        await deleteDoc(userNewsAlertRuleDoc(firebaseUser.uid, ruleId))
        return currentRules.filter((rule) => rule.id !== ruleId)
    },
}
