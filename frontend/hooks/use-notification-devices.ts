'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
    notificationDevicesService,
    type SyncNotificationDevicePayload,
} from '@/services/notification-devices.service'
import { useAuthStore } from '@/store/use-auth-store'

const NOTIFICATION_DEVICES_QUERY_KEY = 'notification-devices'

export function useNotificationDevices() {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: [NOTIFICATION_DEVICES_QUERY_KEY, userId],
        queryFn: () => notificationDevicesService.getRegisteredDevices(),
        enabled: isAuthenticated && Boolean(userId),
        staleTime: 1000 * 30,
        refetchInterval: 1000 * 60,
    })
}

export function useSyncNotificationDevice() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useMutation({
        mutationFn: (payload: SyncNotificationDevicePayload) =>
            notificationDevicesService.syncBrowserDevice(payload),
        onSuccess: () => {
            if (!userId) return
            queryClient.invalidateQueries({
                queryKey: [NOTIFICATION_DEVICES_QUERY_KEY, userId],
            })
        },
    })
}

export function useSendTestNotification() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useMutation({
        mutationFn: () => notificationDevicesService.sendTestNotification(),
        onSuccess: () => {
            if (!userId) return
            queryClient.invalidateQueries({
                queryKey: ['notifications', userId],
            })
            queryClient.invalidateQueries({
                queryKey: ['notifications-unread-count', userId],
            })
        },
    })
}
