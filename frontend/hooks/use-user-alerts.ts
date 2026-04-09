'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/use-auth-store'
import {
    alertsService,
    CreateAlertPayload,
} from '@/services/alerts.service'
import type { UserAlert } from '@/types'

const USER_ALERTS_QUERY_KEY = 'user-alerts'

export function useUserAlerts() {
    const { user, isAuthenticated } = useAuthStore()

    return useQuery({
        queryKey: [USER_ALERTS_QUERY_KEY, user?.id],
        queryFn: () => alertsService.getOrCreateAlerts(),
        enabled: isAuthenticated && Boolean(user?.id),
        staleTime: 1000 * 60 * 5,
    })
}

function useAlertsCacheSync() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id)

    const syncAlerts = (alerts: UserAlert[]) => {
        if (!userId) return
        queryClient.setQueryData([USER_ALERTS_QUERY_KEY, userId], alerts)
    }

    return { syncAlerts }
}

export function useAddUserAlert() {
    const { syncAlerts } = useAlertsCacheSync()

    return useMutation({
        mutationFn: (payload: CreateAlertPayload) => alertsService.addAlert(payload),
        onSuccess: (alerts) => {
            syncAlerts(alerts)
        },
    })
}

export function useRemoveUserAlert() {
    const { syncAlerts } = useAlertsCacheSync()

    return useMutation({
        mutationFn: (alertId: string) => alertsService.removeAlert(alertId),
        onSuccess: (alerts) => {
            syncAlerts(alerts)
        },
    })
}
