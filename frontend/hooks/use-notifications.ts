'use client'

import {
    type InfiniteData,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'

import {
    notificationsService,
    type NotificationListFilter,
} from '@/services/notifications.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { NotificationKindFilter, NotificationPage } from '@/types'

const NOTIFICATIONS_QUERY_KEY = 'notifications'
const NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY = 'notifications-unread-count'

type NotificationInfiniteData = InfiniteData<
    NotificationPage,
    NotificationPage['nextCursor']
>

export function useNotifications(
    filter: NotificationListFilter,
    kind: NotificationKindFilter,
    pageSize = 25
) {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    return useInfiniteQuery({
        queryKey: [NOTIFICATIONS_QUERY_KEY, userId, filter, kind, pageSize],
        initialPageParam: null as NotificationPage['nextCursor'],
        queryFn: ({ pageParam }) =>
            notificationsService.getPage({
                filter,
                kind,
                cursor: pageParam,
                limit: pageSize,
            }),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: isAuthenticated && Boolean(userId),
        staleTime: 1000 * 30,
        refetchInterval: 1000 * 30,
    })
}

export function useUnreadNotificationsCount() {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, userId],
        queryFn: () => notificationsService.getUnreadCount(),
        enabled: isAuthenticated && Boolean(userId),
        staleTime: 1000 * 15,
        refetchInterval: 1000 * 30,
    })
}

function patchNotificationReadState(
    data: NotificationInfiniteData | undefined,
    notificationId?: string,
    removeReadItems = false
) {
    if (!data) return data

    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            items: page.items
                .map((item) => {
                    if (notificationId && item.id !== notificationId) {
                        return item
                    }

                    return {
                        ...item,
                        isRead: true,
                        readAt: item.readAt ?? new Date().toISOString(),
                    }
                })
                .filter((item) => !(removeReadItems && item.isRead)),
        })),
    }
}

function isNotificationsQueryForUser(queryKey: readonly unknown[], userId: string) {
    return queryKey[0] === NOTIFICATIONS_QUERY_KEY && queryKey[1] === userId
}

function isUnreadNotificationsQuery(queryKey: readonly unknown[], userId: string) {
    return isNotificationsQueryForUser(queryKey, userId) && queryKey[2] === 'unread'
}

function isAllNotificationsQuery(queryKey: readonly unknown[], userId: string) {
    return isNotificationsQueryForUser(queryKey, userId) && queryKey[2] !== 'unread'
}

export function useMarkNotificationAsRead() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useMutation({
        mutationFn: (notificationId: string) =>
            notificationsService.markAsRead(notificationId),
        onSuccess: (_, notificationId) => {
            if (!userId) return

            queryClient.setQueriesData(
                {
                    predicate: (query) =>
                        isUnreadNotificationsQuery(query.queryKey, userId),
                },
                (data: NotificationInfiniteData | undefined) =>
                    patchNotificationReadState(data, notificationId, true)
            )
            queryClient.setQueriesData(
                {
                    predicate: (query) =>
                        isAllNotificationsQuery(query.queryKey, userId),
                },
                (data: NotificationInfiniteData | undefined) =>
                    patchNotificationReadState(data, notificationId)
            )
            queryClient.invalidateQueries({
                queryKey: [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, userId],
            })
        },
    })
}

export function useMarkAllNotificationsAsRead() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useMutation({
        mutationFn: () => notificationsService.markAllAsRead(),
        onSuccess: () => {
            if (!userId) return

            queryClient.setQueriesData(
                {
                    predicate: (query) =>
                        isUnreadNotificationsQuery(query.queryKey, userId),
                },
                (data: NotificationInfiniteData | undefined) =>
                    patchNotificationReadState(data, undefined, true)
            )
            queryClient.setQueriesData(
                {
                    predicate: (query) =>
                        isAllNotificationsQuery(query.queryKey, userId),
                },
                (data: NotificationInfiniteData | undefined) =>
                    patchNotificationReadState(data)
            )
            queryClient.setQueryData(
                [NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, userId],
                0
            )
        },
    })
}
