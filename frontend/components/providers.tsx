'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { NotificationPushBootstrap } from '@/components/notifications/notification-push-bootstrap'
import { useAuthStore } from '@/store'

const USER_SCOPED_QUERY_KEYS = new Set([
    'user-profile',
    'user-watchlist',
    'dashboard-watchlist',
    'user-alerts',
    'alert-rules',
    'notifications',
    'notifications-unread-count',
    'notification-devices',
    'user-screener-presets',
    'ai-assets',
    'ai-session',
    'community-feed',
    'community-post',
    'community-related-posts',
])

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        retry: 1,
                    },
                },
            })
    )

    const initializeAuth = useAuthStore((state) => state.initializeAuth)
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const previousUserIdRef = useRef<string | null>(null)

    useEffect(() => {
        initializeAuth()
    }, [initializeAuth])

    useEffect(() => {
        const previousUserId = previousUserIdRef.current

        if (previousUserId && previousUserId !== userId) {
            queryClient.removeQueries({
                predicate: (query) =>
                    USER_SCOPED_QUERY_KEYS.has(String(query.queryKey[0])),
            })
        }

        previousUserIdRef.current = userId
    }, [queryClient, userId])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <NotificationPushBootstrap />
            <Toaster />
        </QueryClientProvider>
    )
}
