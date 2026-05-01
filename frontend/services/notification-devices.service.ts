import { httpsCallable } from 'firebase/functions'
import { User as FirebaseUser } from 'firebase/auth'
import { getDocs, orderBy, query } from 'firebase/firestore'

import { auth, functions } from '@/lib/firebase'
import { userNotificationDevicesCollection } from '@/lib/notification-firestore'
import type {
    NotificationDevice,
    NotificationDevicePermission,
} from '@/types'

export interface SyncNotificationDevicePayload {
    deviceKey: string
    token: string | null
    permission: NotificationDevicePermission
    browser: string
    platform: string
    active: boolean
}

interface SyncNotificationDeviceResult {
    deviceId: string
    active: boolean
}

interface SendTestNotificationResult {
    success: boolean
    delivered: number
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

function normalizePermission(
    value: unknown
): NotificationDevicePermission {
    switch (value) {
        case 'default':
        case 'denied':
        case 'granted':
        case 'unsupported':
            return value
        default:
            return 'default'
    }
}

function normalizeDevice(
    deviceId: string,
    rawValue: unknown
): NotificationDevice | null {
    if (!isRecord(rawValue)) return null
    if (typeof rawValue.browser !== 'string' || typeof rawValue.platform !== 'string') {
        return null
    }

    return {
        id: deviceId,
        token: typeof rawValue.token === 'string' ? rawValue.token : null,
        permission: normalizePermission(rawValue.permission),
        browser: rawValue.browser,
        platform: rawValue.platform,
        active: rawValue.active === true,
        lastSeenAt:
            typeof rawValue.lastSeenAt === 'string'
                ? rawValue.lastSeenAt
                : new Date().toISOString(),
    }
}

export const notificationDevicesService = {
    async getRegisteredDevices(): Promise<NotificationDevice[]> {
        const firebaseUser = ensureCurrentUser()
        const devicesQuery = query(
            userNotificationDevicesCollection(firebaseUser.uid),
            orderBy('lastSeenAt', 'desc')
        )
        const snapshot = await getDocs(devicesQuery)

        return snapshot.docs
            .map((docSnapshot) =>
                normalizeDevice(docSnapshot.id, docSnapshot.data())
            )
            .filter((device): device is NotificationDevice => device !== null)
    },

    async syncBrowserDevice(
        payload: SyncNotificationDevicePayload
    ): Promise<SyncNotificationDeviceResult> {
        ensureCurrentUser()
        const callable = httpsCallable<
            SyncNotificationDevicePayload,
            SyncNotificationDeviceResult
        >(functions, 'registerDevice')
        const result = await callable(payload)
        return result.data
    },

    async sendTestNotification(): Promise<SendTestNotificationResult> {
        ensureCurrentUser()
        const callable = httpsCallable<Record<string, never>, SendTestNotificationResult>(
            functions,
            'sendTestNotification'
        )
        const result = await callable({})
        return result.data
    },
}
