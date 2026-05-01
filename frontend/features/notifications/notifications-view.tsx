'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    Bell,
    BellRing,
    CheckCheck,
    ExternalLink,
    Inbox,
    Loader2,
    RefreshCw,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    useMarkAllNotificationsAsRead,
    useMarkNotificationAsRead,
    useNotifications,
    useUnreadNotificationsCount,
} from '@/hooks/use-notifications'
import {
    useNotificationDevices,
    useSendTestNotification,
    useSyncNotificationDevice,
} from '@/hooks/use-notification-devices'
import { useProfile } from '@/hooks/use-profile'
import { useToast } from '@/hooks/use-toast'
import {
    getBrowserDescriptor,
    getBrowserDeviceKey,
    getBrowserNotificationPermission,
    getBrowserPushToken,
    requestBrowserNotificationPermission,
} from '@/lib/firebase-messaging'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/use-auth-store'
import type {
    NotificationDevicePermission,
    NotificationKindFilter,
    NotificationKind,
    UserNotification,
} from '@/types'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export interface NotificationsViewProps {
    isWidget?: boolean
}

function formatDateTime(value: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return parsed.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getKindBadge(kind: NotificationKind) {
    switch (kind) {
        case 'price':
            return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
        case 'indicator':
            return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        case 'news':
            return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        case 'system':
        default:
            return 'border-muted bg-muted text-muted-foreground'
    }
}

function getPermissionLabel(permission: NotificationDevicePermission) {
    switch (permission) {
        case 'granted':
            return 'Granted'
        case 'denied':
            return 'Denied'
        case 'unsupported':
            return 'Unsupported'
        case 'default':
        default:
            return 'Not requested'
    }
}

function getNotificationLink(notification: UserNotification): string | null {
    if (notification.kind === 'news') {
        const tickers = notification.payload?.tickers
        if (Array.isArray(tickers) && tickers.length > 0) {
            const params = new URLSearchParams({
                symbols: tickers.join(','),
            })
            return `/news?${params.toString()}`
        }

        return '/news'
    }

    if (notification.ticker) {
        return `/markets/${notification.ticker}`
    }

    if (notification.ruleId) {
        return `/alerts#rule-${notification.ruleId}`
    }

    return null
}

function getNotificationLinkLabel(notification: UserNotification): string {
    return notification.kind === 'news' ? 'News' : notification.ticker ?? 'Rule'
}

function NotificationList({
    items,
    onMarkAsRead,
    isMarkingRead,
}: {
    items: UserNotification[]
    onMarkAsRead: (notificationId: string) => void
    isMarkingRead: boolean
}) {
    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No notifications found.
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {items.map((notification) => (
                <div
                    key={notification.id}
                    className={cn(
                        'rounded-2xl border border-border bg-card p-4 transition-colors',
                        !notification.isRead && 'border-primary/30 bg-primary/5'
                    )}
                >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">
                                    {notification.title}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={cn('text-[10px]', getKindBadge(notification.kind))}
                                >
                                    {notification.kind}
                                </Badge>
                                {!notification.isRead ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                        Unread
                                    </Badge>
                                ) : null}
                            </div>

                            <p className="mt-2 text-sm text-muted-foreground">
                                {notification.body}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>{formatDateTime(notification.createdAt)}</span>
                                {getNotificationLink(notification) ? (
                                    <Link
                                        href={getNotificationLink(notification) as string}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                        {getNotificationLinkLabel(notification)}
                                        <ExternalLink size={12} />
                                    </Link>
                                ) : null}
                                {notification.kind !== 'news' && notification.ruleId ? (
                                    <Link
                                        href={`/alerts#rule-${notification.ruleId}`}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                        Rule
                                        <ExternalLink size={12} />
                                    </Link>
                                ) : null}
                                {notification.timeframe ? (
                                    <span>{notification.timeframe}</span>
                                ) : null}
                                {notification.kind === 'news' &&
                                Array.isArray(notification.payload?.tickers) ? (
                                    <span>
                                        {(notification.payload.tickers as string[]).join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {!notification.isRead ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isMarkingRead}
                                onClick={() => onMarkAsRead(notification.id)}
                            >
                                Mark read
                            </Button>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    )
}

function NotificationsPreview() {
    const unreadCountQuery = useUnreadNotificationsCount()
    const unreadQuery = useNotifications('unread', 'all', 5)
    const items = unreadQuery.data?.pages.flatMap((page) => page.items) ?? []

    return (
        <div className="flex h-full flex-col bg-background">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-2 pt-4">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <Inbox size={16} />
                        Notifications
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {unreadCountQuery.data ?? 0} unread
                    </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                    <Link href="/notifications">
                        Open page
                        <ExternalLink size={12} />
                    </Link>
                </Button>
            </div>

            <div className="flex-1 overflow-auto px-2 py-2">
                {unreadQuery.isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No unread notifications.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((notification) => (
                            <div
                                key={notification.id}
                                className="rounded-xl border border-border bg-card p-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">
                                            {notification.title}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                            {notification.body}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatDateTime(notification.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function NotificationsView({ isWidget = false }: NotificationsViewProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const { data: profile } = useProfile()
    const { toast } = useToast()
    const [tab, setTab] = useState<'unread' | 'all'>('unread')
    const [kindFilter, setKindFilter] = useState<NotificationKindFilter>('all')
    const [permission, setPermission] = useState<NotificationDevicePermission>('default')

    const notificationsQuery = useNotifications(tab, kindFilter, 25)
    const unreadCountQuery = useUnreadNotificationsCount()
    const markAsReadMutation = useMarkNotificationAsRead()
    const markAllAsReadMutation = useMarkAllNotificationsAsRead()
    const devicesQuery = useNotificationDevices()
    const syncDeviceMutation = useSyncNotificationDevice()
    const sendTestMutation = useSendTestNotification()

    const notifications = useMemo(
        () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
        [notificationsQuery.data]
    )

    const currentDevice = useMemo(() => {
        if (typeof window === 'undefined') {
            return null
        }

        const deviceKey = getBrowserDeviceKey()
        return (
            devicesQuery.data?.find((device) => device.id === deviceKey) ?? null
        )
    }, [devicesQuery.data])

    useEffect(() => {
        void getBrowserNotificationPermission().then(setPermission)
    }, [])

    const handleRequestPermission = async () => {
        const nextPermission = await requestBrowserNotificationPermission()
        setPermission(nextPermission)

        if (nextPermission !== 'granted') {
            return
        }

        try {
            const token = await getBrowserPushToken(VAPID_KEY)
            const { browser, platform } = getBrowserDescriptor()

            await syncDeviceMutation.mutateAsync({
                deviceKey: getBrowserDeviceKey(),
                token,
                permission: nextPermission,
                browser,
                platform,
                active:
                    Boolean(token) &&
                    Boolean(profile?.preferences.notifications.pushEnabled),
            })
        } catch (error) {
            toast({
                title: 'Push setup failed',
                description:
                    error instanceof Error
                        ? error.message
                        : 'Browser notifications could not be enabled.',
                variant: 'destructive',
            })
        }
    }

    const handleSendTestNotification = async () => {
        try {
            const result = await sendTestMutation.mutateAsync()
            toast({
                title: 'Test notification sent',
                description: `Delivered to ${result.delivered} registered device(s).`,
            })
        } catch (error) {
            toast({
                title: 'Test notification failed',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The test notification could not be sent.',
                variant: 'destructive',
            })
        }
    }

    if (!isAuthenticated) {
        return (
            <div className={cn('flex h-full items-center justify-center', !isWidget && 'p-6')}>
                <Card className="max-w-md border-border bg-card p-6 text-center">
                    <h1 className="text-lg font-semibold">Sign in required</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Notifications are available after sign-in.
                    </p>
                </Card>
            </div>
        )
    }

    if (isWidget) {
        return <NotificationsPreview />
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    Notifications
                </h1>
                <p className="text-muted-foreground">
                    Review triggered rules, manage unread items, and verify browser push delivery.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                <Card className="border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="flex items-center gap-2 text-lg font-semibold">
                                <BellRing size={18} />
                                Delivery Status
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Browser permission, token registration, and push test controls.
                            </p>
                        </div>
                        <Badge variant="outline">
                            {unreadCountQuery.data ?? 0} unread
                        </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-border bg-background/50 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Browser permission
                            </p>
                            <p className="mt-2 text-sm font-semibold">
                                {getPermissionLabel(permission)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-background/50 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Registered devices
                            </p>
                            <p className="mt-2 text-sm font-semibold">
                                {devicesQuery.data?.length ?? 0}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-background/50 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Current browser
                            </p>
                            <p className="mt-2 text-sm font-semibold">
                                {currentDevice?.active ? 'Active' : 'Not active'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRequestPermission}
                            disabled={
                                syncDeviceMutation.isPending ||
                                permission === 'granted' ||
                                permission === 'unsupported'
                            }
                        >
                            {syncDeviceMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Bell className="h-4 w-4" />
                            )}
                            Allow browser notifications
                        </Button>
                        <Button
                            onClick={handleSendTestNotification}
                            disabled={
                                sendTestMutation.isPending ||
                                !currentDevice?.active
                            }
                        >
                            {sendTestMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Send test notification
                        </Button>
                    </div>
                </Card>

                <Card className="border-border bg-card p-5">
                    <h2 className="text-lg font-semibold">Push Requirements</h2>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <p>
                            Push delivery switch:{' '}
                            <span className="font-medium text-foreground">
                                {profile?.preferences.notifications.pushEnabled
                                    ? 'Enabled'
                                    : 'Disabled'}
                            </span>
                        </p>
                        <p>
                            Price alerts:{' '}
                            <span className="font-medium text-foreground">
                                {profile?.preferences.notifications.priceAlerts
                                    ? 'Enabled'
                                    : 'Disabled'}
                            </span>
                        </p>
                        <p>
                            Indicator alerts:{' '}
                            <span className="font-medium text-foreground">
                                {profile?.preferences.notifications.indicatorAlerts
                                    ? 'Enabled'
                                    : 'Disabled'}
                            </span>
                        </p>
                        <p>
                            News alerts:{' '}
                            <span className="font-medium text-foreground">
                                {profile?.preferences.notifications.newsAlerts
                                    ? 'Enabled'
                                    : 'Disabled'}
                            </span>
                        </p>
                        {permission === 'denied' ? (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                                Browser permission is denied. Re-enable notifications from browser site settings.
                            </div>
                        ) : null}
                        {permission === 'unsupported' ? (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                                Browser push is not supported in this environment.
                            </div>
                        ) : null}
                        {!profile?.preferences.notifications.pushEnabled ? (
                            <div className="rounded-xl border border-border bg-background/50 p-3">
                                Turn on push notifications from Settings to allow device activation.
                            </div>
                        ) : null}
                    </div>
                </Card>
            </div>

            <Card className="border-border bg-card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <Tabs
                        defaultValue="unread"
                        onValueChange={(value) => setTab(value as 'unread' | 'all')}
                    >
                        <TabsList>
                            <TabsTrigger value="unread">Unread</TabsTrigger>
                            <TabsTrigger value="all">All</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => notificationsQuery.refetch()}
                            disabled={notificationsQuery.isFetching}
                        >
                            {notificationsQuery.isFetching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => markAllAsReadMutation.mutate()}
                            disabled={
                                markAllAsReadMutation.isPending ||
                                (unreadCountQuery.data ?? 0) === 0
                            }
                        >
                            {markAllAsReadMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCheck className="h-4 w-4" />
                            )}
                            Mark all read
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {(
                        [
                            ['all', 'All'],
                            ['price', 'Price'],
                            ['indicator', 'Indicator'],
                            ['news', 'News'],
                            ['system', 'System'],
                        ] as Array<[NotificationKindFilter, string]>
                    ).map(([value, label]) => (
                        <Button
                            key={value}
                            type="button"
                            variant={kindFilter === value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setKindFilter(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                <div className="mt-5">
                    {notificationsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : notificationsQuery.isError ? (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            Notifications could not be loaded.
                        </div>
                    ) : (
                        <>
                            <NotificationList
                                items={notifications}
                                onMarkAsRead={(notificationId) =>
                                    markAsReadMutation.mutate(notificationId)
                                }
                                isMarkingRead={markAsReadMutation.isPending}
                            />

                            {notificationsQuery.hasNextPage ? (
                                <div className="mt-4 flex justify-center">
                                    <Button
                                        variant="outline"
                                        onClick={() => notificationsQuery.fetchNextPage()}
                                        disabled={notificationsQuery.isFetchingNextPage}
                                    >
                                        {notificationsQuery.isFetchingNextPage ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Load more'
                                        )}
                                    </Button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </Card>
        </div>
    )
}
