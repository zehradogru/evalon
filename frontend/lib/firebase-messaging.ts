import { getToken, isSupported, onMessage, getMessaging } from 'firebase/messaging'

import app from '@/lib/firebase'
import type { NotificationDevicePermission } from '@/types'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'
const DEVICE_KEY_STORAGE_KEY = 'evalon-notification-device-key'

export interface BrowserDescriptor {
    browser: string
    platform: string
}

function canUseNotificationsApi(): boolean {
    return (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'navigator' in window &&
        'serviceWorker' in navigator
    )
}

export async function isMessagingSupportedInBrowser(): Promise<boolean> {
    if (!canUseNotificationsApi()) {
        return false
    }

    return isSupported().catch(() => false)
}

export function getBrowserDescriptor(): BrowserDescriptor {
    if (typeof navigator === 'undefined') {
        return { browser: 'Unknown', platform: 'Unknown' }
    }

    const userAgent = navigator.userAgent
    const userAgentData = (
        navigator as Navigator & {
            userAgentData?: {
                platform?: string
            }
        }
    ).userAgentData
    const platform =
        userAgentData?.platform ||
        navigator.platform ||
        'Unknown'

    let browser = 'Unknown'
    if (/Edg\//.test(userAgent)) {
        browser = 'Edge'
    } else if (/Chrome\//.test(userAgent)) {
        browser = 'Chrome'
    } else if (/Firefox\//.test(userAgent)) {
        browser = 'Firefox'
    } else if (/Safari\//.test(userAgent)) {
        browser = 'Safari'
    }

    return {
        browser,
        platform,
    }
}

export function getBrowserDeviceKey(): string {
    if (typeof window === 'undefined') {
        return 'server'
    }

    const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)
    if (existing) {
        return existing
    }

    const nextKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, nextKey)
    return nextKey
}

function buildServiceWorkerUrl(): string {
    const firebaseOptions = app.options
    const url = new URL(FIREBASE_MESSAGING_SW_PATH, window.location.origin)

    const configEntries = {
        apiKey: firebaseOptions.apiKey,
        authDomain: firebaseOptions.authDomain,
        projectId: firebaseOptions.projectId,
        storageBucket: firebaseOptions.storageBucket,
        messagingSenderId: firebaseOptions.messagingSenderId,
        appId: firebaseOptions.appId,
        measurementId: firebaseOptions.measurementId,
    }

    Object.entries(configEntries).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, String(value))
        }
    })

    return url.toString()
}

export async function ensureFirebaseMessagingServiceWorker() {
    if (!(await isMessagingSupportedInBrowser())) {
        return null
    }

    return navigator.serviceWorker.register(buildServiceWorkerUrl(), {
        scope: '/',
    })
}

export async function getBrowserNotificationPermission(): Promise<NotificationDevicePermission> {
    if (!(await isMessagingSupportedInBrowser())) {
        return 'unsupported'
    }

    return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<NotificationDevicePermission> {
    if (!(await isMessagingSupportedInBrowser())) {
        return 'unsupported'
    }

    return Notification.requestPermission()
}

export async function getBrowserPushToken(
    vapidKey?: string
): Promise<string | null> {
    if (!(await isMessagingSupportedInBrowser())) {
        return null
    }

    if (Notification.permission !== 'granted') {
        return null
    }

    const registration = await ensureFirebaseMessagingServiceWorker()
    if (!registration) {
        return null
    }

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
    }).catch(() => null)

    return token || null
}

export async function subscribeToForegroundMessages(
    onPayload: (payload: { title: string; body: string; url: string | null }) => void
): Promise<(() => void) | null> {
    if (!(await isMessagingSupportedInBrowser())) {
        return null
    }

    const messaging = getMessaging(app)

    return onMessage(messaging, (payload) => {
        const title =
            payload.notification?.title ||
            payload.data?.title ||
            'Notification'
        const body =
            payload.notification?.body ||
            payload.data?.body ||
            'You have a new update.'
        const url = payload.data?.url ?? null

        onPayload({ title, body, url })
    })
}
