'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useProfile } from '@/hooks/use-profile'
import { useToast } from '@/hooks/use-toast'
import {
    ensureFirebaseMessagingServiceWorker,
    getBrowserDescriptor,
    getBrowserDeviceKey,
    getBrowserNotificationPermission,
    getBrowserPushToken,
    subscribeToForegroundMessages,
} from '@/lib/firebase-messaging'
import { notificationDevicesService } from '@/services/notification-devices.service'
import { useAuthStore } from '@/store/use-auth-store'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export function NotificationPushBootstrap() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const { data: profile } = useProfile()

    useEffect(() => {
        let unsubscribe: (() => void) | null = null

        void subscribeToForegroundMessages(({ title, body }) => {
            toast({
                title,
                description: body,
            })

            queryClient.invalidateQueries({
                queryKey: ['notifications', userId],
            })
            queryClient.invalidateQueries({
                queryKey: ['notifications-unread-count', userId],
            })
        }).then((cleanup) => {
            unsubscribe = cleanup
        })

        return () => {
            unsubscribe?.()
        }
    }, [queryClient, toast, userId])

    useEffect(() => {
        if (!isAuthenticated || !userId || !profile) {
            return
        }

        const notificationPreferences = profile.preferences.notifications
        let cancelled = false

        async function syncDeviceState() {
            const permission = await getBrowserNotificationPermission()
            const { browser, platform } = getBrowserDescriptor()
            const pushEnabled = notificationPreferences.pushEnabled

            if (permission === 'unsupported') {
                await notificationDevicesService.syncBrowserDevice({
                    deviceKey: getBrowserDeviceKey(),
                    token: null,
                    permission,
                    browser,
                    platform,
                    active: false,
                }).catch(() => undefined)
                return
            }

            if (!pushEnabled) {
                await notificationDevicesService.syncBrowserDevice({
                    deviceKey: getBrowserDeviceKey(),
                    token: null,
                    permission,
                    browser,
                    platform,
                    active: false,
                }).catch(() => undefined)
                return
            }

            await ensureFirebaseMessagingServiceWorker().catch(() => null)
            const token =
                permission === 'granted'
                    ? await getBrowserPushToken(VAPID_KEY)
                    : null

            if (cancelled) {
                return
            }

            await notificationDevicesService.syncBrowserDevice({
                deviceKey: getBrowserDeviceKey(),
                token,
                permission,
                browser,
                platform,
                active:
                    permission === 'granted' &&
                    Boolean(token) &&
                    notificationPreferences.pushEnabled,
            }).catch(() => undefined)

            queryClient.invalidateQueries({
                queryKey: ['notification-devices', userId],
            })
        }

        void syncDeviceState()

        return () => {
            cancelled = true
        }
    }, [isAuthenticated, profile, queryClient, userId])

    return null
}
