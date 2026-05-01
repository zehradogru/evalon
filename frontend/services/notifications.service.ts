import {
    getCountFromServer,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where,
    writeBatch,
    type DocumentData,
    type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { User as FirebaseUser } from 'firebase/auth'

import { auth } from '@/lib/firebase'
import {
    userNotificationDoc,
    userNotificationsCollection,
} from '@/lib/notification-firestore'
import type {
    NotificationCursor,
    NotificationKind,
    NotificationPage,
    UserNotification,
} from '@/types'

export type NotificationListFilter = 'all' | 'unread'

export interface GetNotificationsPageOptions {
    filter: NotificationListFilter
    cursor?: NotificationCursor | null
    limit?: number
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

function normalizeNotificationKind(value: unknown): NotificationKind {
    switch (value) {
        case 'price':
        case 'indicator':
        case 'system':
        case 'news':
            return value
        default:
            return 'system'
    }
}

function normalizeNotification(
    notificationId: string,
    rawValue: unknown
): UserNotification | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.title !== 'string' || typeof rawValue.body !== 'string') {
        return null
    }

    const payload =
        isRecord(rawValue.payload) || rawValue.payload === null
            ? (rawValue.payload as UserNotification['payload'])
            : null

    return {
        id: notificationId,
        kind: normalizeNotificationKind(rawValue.kind),
        title: rawValue.title,
        body: rawValue.body,
        ticker: typeof rawValue.ticker === 'string' ? rawValue.ticker : null,
        timeframe:
            typeof rawValue.timeframe === 'string'
                ? (rawValue.timeframe as UserNotification['timeframe'])
                : null,
        ruleId: typeof rawValue.ruleId === 'string' ? rawValue.ruleId : null,
        isRead: rawValue.isRead === true,
        createdAt:
            typeof rawValue.createdAt === 'string'
                ? rawValue.createdAt
                : new Date().toISOString(),
        readAt: typeof rawValue.readAt === 'string' ? rawValue.readAt : null,
        payload,
    }
}

export const notificationsService = {
    async getPage({
        filter,
        cursor = null,
        limit: pageSize = 25,
    }: GetNotificationsPageOptions): Promise<NotificationPage> {
        const firebaseUser = ensureCurrentUser()
        const baseConstraints = [
            ...(filter === 'unread' ? [where('isRead', '==', false)] : []),
            orderBy('createdAt', 'desc'),
            limit(pageSize + 1),
        ] as const

        const notificationsQuery = cursor
            ? query(
                  userNotificationsCollection(firebaseUser.uid),
                  ...baseConstraints,
                  startAfter(cursor)
              )
            : query(userNotificationsCollection(firebaseUser.uid), ...baseConstraints)

        const snapshot = await getDocs(notificationsQuery)
        const docs = snapshot.docs
        const hasMore = docs.length > pageSize
        const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs

        return {
            items: visibleDocs
                .map((docSnapshot) =>
                    normalizeNotification(docSnapshot.id, docSnapshot.data())
                )
                .filter(
                    (notification): notification is UserNotification =>
                        notification !== null
                ),
            nextCursor: hasMore
                ? (visibleDocs[visibleDocs.length - 1] as QueryDocumentSnapshot<DocumentData>)
                : null,
            hasMore,
        }
    },

    async getUnreadCount(): Promise<number> {
        const firebaseUser = ensureCurrentUser()
        const unreadQuery = query(
            userNotificationsCollection(firebaseUser.uid),
            where('isRead', '==', false)
        )
        const aggregate = await getCountFromServer(unreadQuery)
        return aggregate.data().count
    },

    async markAsRead(notificationId: string): Promise<void> {
        const firebaseUser = ensureCurrentUser()
        await updateDoc(userNotificationDoc(firebaseUser.uid, notificationId), {
            isRead: true,
            readAt: new Date().toISOString(),
        })
    },

    async markAllAsRead(): Promise<number> {
        const firebaseUser = ensureCurrentUser()
        const unreadQuery = query(
            userNotificationsCollection(firebaseUser.uid),
            where('isRead', '==', false)
        )
        const unreadSnapshot = await getDocs(unreadQuery)

        if (unreadSnapshot.empty) {
            return 0
        }

        const batch = writeBatch(
            userNotificationDoc(firebaseUser.uid, unreadSnapshot.docs[0].id).firestore
        )
        const readAt = new Date().toISOString()

        unreadSnapshot.docs.forEach((notificationSnapshot) => {
            batch.update(notificationSnapshot.ref, {
                isRead: true,
                readAt,
            })
        })

        await batch.commit()
        return unreadSnapshot.docs.length
    },
}
