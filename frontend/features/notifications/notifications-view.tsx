'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  BellRing,
  CheckCircle2,
  CheckCheck,
  ExternalLink,
  Inbox,
  LineChart,
  Loader2,
  Newspaper,
  RefreshCw,
  ShieldCheck,
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

function getKindMeta(kind: NotificationKind) {
  switch (kind) {
    case 'price':
      return {
        label: 'Price',
        Icon: LineChart,
        className: 'border-primary/30 bg-primary/10 text-primary',
        iconClassName: 'text-primary',
      }
    case 'indicator':
      return {
        label: 'Indicator',
        Icon: Activity,
        className: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
        iconClassName: 'text-chart-2',
      }
    case 'news':
      return {
        label: 'News',
        Icon: Newspaper,
        className: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
        iconClassName: 'text-chart-4',
      }
    case 'system':
    default:
      return {
        label: 'System',
        Icon: ShieldCheck,
        className: 'border-muted bg-muted text-muted-foreground',
        iconClassName: 'text-muted-foreground',
      }
  }
}

const KIND_FILTERS: Array<{ value: NotificationKindFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'price', label: 'Price' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'news', label: 'News' },
  { value: 'system', label: 'System' },
]

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
  return notification.kind === 'news' ? 'News' : (notification.ticker ?? 'Rule')
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
      <div
        role="status"
        aria-live="polite"
        className="border-border rounded-lg border border-dashed p-8 text-center"
      >
        <Inbox
          className="text-muted-foreground mx-auto h-8 w-8"
          aria-hidden="true"
        />
        <p className="text-foreground mt-3 text-sm font-medium">
          No notifications
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          New rule matches will appear here.
        </p>
      </div>
    )
  }

  return (
    <div role="list" aria-live="polite" className="space-y-3">
      {items.map((notification) => {
        const meta = getKindMeta(notification.kind)
        const Icon = meta.Icon
        const primaryLink = getNotificationLink(notification)

        return (
          <div
            key={notification.id}
            role="listitem"
            className={cn(
              'border-border bg-card rounded-lg border p-4 transition-colors',
              !notification.isRead && 'border-primary/30 bg-primary/5'
            )}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border',
                    meta.className
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-5 font-semibold">
                      {notification.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', meta.className)}
                    >
                      {meta.label}
                    </Badge>
                    {!notification.isRead ? (
                      <Badge
                        variant="secondary"
                        className="border-primary/20 bg-primary/10 text-primary text-[10px]"
                      >
                        Unread
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-muted-foreground mt-2 text-sm leading-5">
                    {notification.body}
                  </p>

                  <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span>{formatDateTime(notification.createdAt)}</span>
                    {primaryLink ? (
                      <Link
                        href={primaryLink}
                        className="text-primary focus-visible:ring-primary inline-flex min-h-8 items-center gap-1 rounded-md hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {getNotificationLinkLabel(notification)}
                        <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                    ) : null}
                    {notification.kind !== 'news' && notification.ruleId ? (
                      <Link
                        href={`/alerts#rule-${notification.ruleId}`}
                        className="text-primary focus-visible:ring-primary inline-flex min-h-8 items-center gap-1 rounded-md hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        Rule
                        <ExternalLink size={12} aria-hidden="true" />
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
              </div>

              {!notification.isRead ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 self-start sm:h-8"
                  disabled={isMarkingRead}
                  onClick={() => onMarkAsRead(notification.id)}
                  aria-label={`Mark ${notification.title} as read`}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Mark read
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NotificationsPreview() {
  const unreadCountQuery = useUnreadNotificationsCount()
  const unreadQuery = useNotifications('unread', 'all', 5)
  const items = unreadQuery.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border bg-background sticky top-0 z-10 flex items-center justify-between border-b px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Inbox size={16} aria-hidden="true" />
            Notifications
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link href="/notifications">
            {unreadCountQuery.data ?? 0} unread
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {unreadQuery.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
            No unread notifications
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((notification) => {
              const meta = getKindMeta(notification.kind)
              const Icon = meta.Icon

              return (
                <div
                  key={notification.id}
                  className="border-border bg-card rounded-lg border p-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border',
                        meta.className
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {notification.title}
                      </p>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {notification.body}
                      </p>
                      <p className="text-muted-foreground mt-2 text-[10px]">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function NotificationsView({
  isWidget = false,
}: NotificationsViewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { data: profile } = useProfile()
  const { toast } = useToast()
  const [tab, setTab] = useState<'unread' | 'all'>('unread')
  const [kindFilter, setKindFilter] = useState<NotificationKindFilter>('all')
  const [permission, setPermission] =
    useState<NotificationDevicePermission>('default')

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
    return devicesQuery.data?.find((device) => device.id === deviceKey) ?? null
  }, [devicesQuery.data])

  useEffect(() => {
    void getBrowserNotificationPermission().then(setPermission)
  }, [])

  const handleRequestPermission = async () => {
    const nextPermission = await requestBrowserNotificationPermission()
    setPermission(nextPermission)

    if (nextPermission !== 'granted') {
      toast({
        title: 'Browser notifications not enabled',
        description:
          nextPermission === 'denied'
            ? 'Permission is blocked in browser site settings.'
            : 'Permission was not granted.',
        variant: nextPermission === 'denied' ? 'warning' : 'info',
      })
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
      toast({
        title: 'Browser notifications enabled',
        description: 'This browser is registered for push delivery.',
        variant: 'success',
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
        variant: 'success',
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
      <div
        className={cn(
          'flex h-full items-center justify-center',
          !isWidget && 'p-6'
        )}
      >
        <Card className="border-border bg-card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Notifications are available after sign-in.
          </p>
        </Card>
      </div>
    )
  }

  if (isWidget) {
    return <NotificationsPreview />
  }

  const notificationPreferences = profile?.preferences.notifications
  const preferenceRows = [
    {
      label: 'Push',
      enabled: Boolean(notificationPreferences?.pushEnabled),
    },
    {
      label: 'Price',
      enabled: Boolean(notificationPreferences?.priceAlerts),
    },
    {
      label: 'Indicator',
      enabled: Boolean(notificationPreferences?.indicatorAlerts),
    },
    {
      label: 'News',
      enabled: Boolean(notificationPreferences?.newsAlerts),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="h-8 px-3">
            {unreadCountQuery.data ?? 0} unread
          </Badge>
          <Badge variant="secondary" className="h-8 px-3">
            {devicesQuery.data?.length ?? 0} devices
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BellRing size={18} aria-hidden="true" />
                Delivery
              </h2>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                currentDevice?.active
                  ? 'border-chart-2/30 text-chart-2'
                  : 'border-border text-muted-foreground'
              )}
            >
              {currentDevice?.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="border-border bg-background/50 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Permission
              </p>
              <p
                className={cn(
                  'mt-2 text-sm font-semibold',
                  permission === 'granted' && 'text-chart-2',
                  permission === 'denied' && 'text-destructive',
                  permission === 'unsupported' && 'text-destructive'
                )}
              >
                {getPermissionLabel(permission)}
              </p>
            </div>
            <div className="border-border bg-background/50 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Devices
              </p>
              <p className="mt-2 text-sm font-semibold">
                {devicesQuery.data?.length ?? 0}
              </p>
            </div>
            <div className="border-border bg-background/50 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Browser
              </p>
              <p className="mt-2 text-sm font-semibold">
                {currentDevice?.active ? 'Active' : 'Not active'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={handleRequestPermission}
              disabled={
                syncDeviceMutation.isPending ||
                permission === 'granted' ||
                permission === 'unsupported'
              }
            >
              {syncDeviceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Bell className="h-4 w-4" aria-hidden="true" />
              )}
              Allow notifications
            </Button>
            <Button
              className="h-11 sm:h-9"
              onClick={handleSendTestNotification}
              disabled={sendTestMutation.isPending || !currentDevice?.active}
            >
              {sendTestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Send test
            </Button>
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Preferences</h2>
          <div className="mt-4 space-y-2">
            {preferenceRows.map((item) => (
              <div
                key={item.label}
                className="border-border bg-background/50 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="text-muted-foreground text-sm">
                  {item.label}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    item.enabled ? 'text-chart-2' : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      item.enabled ? 'bg-chart-2' : 'bg-muted'
                    )}
                    aria-hidden="true"
                  />
                  {item.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
            {permission === 'denied' ? (
              <div
                role="alert"
                aria-live="assertive"
                className="border-chart-4/30 bg-chart-4/10 text-chart-4 rounded-lg border p-3 text-sm"
              >
                Browser permission is blocked.
              </div>
            ) : null}
            {permission === 'unsupported' ? (
              <div
                role="alert"
                aria-live="assertive"
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
              >
                Browser push is unsupported.
              </div>
            ) : null}
            {!notificationPreferences?.pushEnabled ? (
              <div className="border-border bg-background/50 text-muted-foreground rounded-lg border p-3 text-sm">
                Push is disabled in settings.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Tabs
            value={tab}
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
              className="h-11 sm:h-9"
              onClick={() => notificationsQuery.refetch()}
              disabled={notificationsQuery.isFetching}
            >
              {notificationsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={
                markAllAsReadMutation.isPending ||
                (unreadCountQuery.data ?? 0) === 0
              }
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
              )}
              Mark all read
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {KIND_FILTERS.map(({ value, label }) => {
            const isActive = kindFilter === value
            const filterMeta =
              value === 'all'
                ? {
                    Icon: Inbox,
                    iconClassName: 'text-muted-foreground',
                  }
                : getKindMeta(value as NotificationKind)
            const FilterIcon = filterMeta.Icon

            return (
              <Button
                key={value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="h-11 sm:h-8"
                onClick={() => setKindFilter(value)}
                aria-pressed={isActive}
              >
                <FilterIcon
                  className={cn(
                    'h-4 w-4',
                    !isActive && filterMeta.iconClassName
                  )}
                  aria-hidden="true"
                />
                {label}
              </Button>
            )
          })}
        </div>

        <div className="mt-5">
          {notificationsQuery.isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center py-10"
            >
              <Loader2
                className="text-primary h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">Loading notifications</span>
            </div>
          ) : notificationsQuery.isError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
            >
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
                    className="h-11 sm:h-9"
                    onClick={() => notificationsQuery.fetchNextPage()}
                    disabled={notificationsQuery.isFetchingNextPage}
                  >
                    {notificationsQuery.isFetchingNextPage ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
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
