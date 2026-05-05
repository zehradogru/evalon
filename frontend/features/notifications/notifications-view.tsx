'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CheckCheck,
  ExternalLink,
  Inbox,
  Laptop,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react'

import { AlertRulesPanel } from '@/features/notifications/alerts-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNotificationDevices, useSendTestNotification, useSyncNotificationDevice } from '@/hooks/use-notification-devices'
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationsCount,
} from '@/hooks/use-notifications'
import { useSetDefaultNewsAlertRuleStatus } from '@/hooks/use-news-alert-rules'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import {
  ensureFirebaseMessagingServiceWorker,
  getBrowserDescriptor,
  getBrowserDeviceKey,
  getBrowserNotificationPermission,
  getBrowserPushToken,
  requestBrowserNotificationPermission,
} from '@/lib/firebase-messaging'
import {
  ACTIVE_NOTIFICATION_KIND_FILTERS,
  getNotificationActionLabel,
  getNotificationCategory,
  getNotificationCount,
  getNotificationTarget,
  getNotificationTickers,
} from '@/lib/notification-categories'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/use-auth-store'
import type {
  NotificationDevicePermission,
  NotificationKind,
  NotificationKindFilter,
  UserNotification,
} from '@/types'

export interface NotificationsViewProps {
  isWidget?: boolean
}

type WorkspaceTab = 'inbox' | 'rules' | 'preferences' | 'devices'
type ReadFilter = 'unread' | 'all'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

const WORKSPACE_TABS: Array<{
  value: WorkspaceTab
  label: string
  Icon: typeof Inbox
}> = [
  { value: 'inbox', label: 'Inbox', Icon: Inbox },
  { value: 'rules', label: 'Rules', Icon: SlidersHorizontal },
  { value: 'preferences', label: 'Preferences', Icon: Settings2 },
  { value: 'devices', label: 'Devices', Icon: Laptop },
]

function normalizeWorkspaceTab(value: string | null): WorkspaceTab {
  if (
    value === 'rules' ||
    value === 'preferences' ||
    value === 'devices' ||
    value === 'inbox'
  ) {
    return value
  }

  return 'inbox'
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

function formatDeviceDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateGroup(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Earlier'

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const key = parsed.toDateString()
  if (key === today.toDateString()) return 'Today'
  if (key === yesterday.toDateString()) return 'Yesterday'

  return parsed.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function matchesNotificationSearch(
  notification: UserNotification,
  search: string
): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true

  const tickers = getNotificationTickers(notification).join(' ')
  const text = [
    notification.title,
    notification.body,
    notification.ticker ?? '',
    tickers,
  ]
    .join(' ')
    .toLowerCase()

  return text.includes(query)
}

function groupNotificationsByDate(notifications: UserNotification[]) {
  const groups: Array<{ label: string; items: UserNotification[] }> = []
  const groupMap = new Map<string, UserNotification[]>()

  notifications.forEach((notification) => {
    const label = formatDateGroup(notification.createdAt)
    const currentItems = groupMap.get(label)

    if (currentItems) {
      currentItems.push(notification)
      return
    }

    groupMap.set(label, [notification])
    groups.push({ label, items: groupMap.get(label) ?? [] })
  })

  return groups
}

function getPermissionStatusMeta(permission: NotificationDevicePermission | null) {
  switch (permission) {
    case 'granted':
      return {
        label: 'Allowed',
        className: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
      }
    case 'denied':
      return {
        label: 'Blocked',
        className: 'border-destructive/30 bg-destructive/10 text-destructive',
      }
    case 'unsupported':
      return {
        label: 'Unsupported',
        className: 'border-muted bg-muted text-muted-foreground',
      }
    case 'default':
    default:
      return {
        label: 'Not requested',
        className: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
      }
  }
}

function NotificationCard({
  notification,
  isMarkingRead,
  onMarkAsRead,
}: {
  notification: UserNotification
  isMarkingRead: boolean
  onMarkAsRead: (notificationId: string) => void
}) {
  const meta = getNotificationCategory(notification.kind)
  const Icon = meta.Icon
  const target = getNotificationTarget(notification)
  const tickers = getNotificationTickers(notification)
  const count = getNotificationCount(notification)
  const isNews = notification.kind === 'news'

  const handleNavigate = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div
      role="listitem"
      className={cn(
        'border-border bg-card rounded-lg border p-4 transition-colors',
        !notification.isRead && 'border-primary/30 bg-primary/5'
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <Link
          href={target}
          onClick={handleNavigate}
          className="focus-visible:ring-primary flex min-w-0 flex-1 gap-3 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
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
              <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
                {meta.label}
              </Badge>
              {count && isNews ? (
                <Badge variant="secondary" className="text-[10px]">
                  {count} items
                </Badge>
              ) : null}
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

            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span>{formatDateTime(notification.createdAt)}</span>
              {notification.timeframe ? <span>{notification.timeframe}</span> : null}
              {tickers.map((ticker) => (
                <span
                  key={ticker}
                  className="border-border bg-background rounded-full border px-2 py-0.5 font-mono text-[10px]"
                >
                  {ticker}
                </span>
              ))}
              {isNews ? (
                <span className="text-primary inline-flex items-center gap-1">
                  {getNotificationActionLabel(notification)}
                  <ExternalLink size={12} aria-hidden="true" />
                </span>
              ) : null}
            </div>
          </div>
        </Link>

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
}

function NotificationsInboxPanel() {
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread')
  const [kindFilter, setKindFilter] = useState<NotificationKindFilter>('all')
  const [search, setSearch] = useState('')

  const notificationsQuery = useNotifications(readFilter, kindFilter, 25)
  const unreadCountQuery = useUnreadNotificationsCount()
  const markAsReadMutation = useMarkNotificationAsRead()
  const markAllAsReadMutation = useMarkAllNotificationsAsRead()

  const notifications = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data]
  )
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) =>
        matchesNotificationSearch(notification, search)
      ),
    [notifications, search]
  )
  const groups = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications]
  )

  return (
    <Card className="border-border bg-card p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs
              value={readFilter}
              onValueChange={(value) => setReadFilter(value as ReadFilter)}
            >
              <TabsList>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Badge variant="outline" className="h-8 w-fit px-3">
              {unreadCountQuery.data ?? 0} unread
            </Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <Search
                className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications"
                className="pl-9"
              />
            </div>
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

        <div className="flex flex-wrap gap-2">
          {ACTIVE_NOTIFICATION_KIND_FILTERS.map(({ value, label }) => {
            const isActive = kindFilter === value
            const filterMeta =
              value === 'all'
                ? {
                    Icon: Inbox,
                    iconClassName: 'text-muted-foreground',
                  }
                : getNotificationCategory(value as NotificationKind)
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
            Notifications could not be loaded. Try refresh in a moment.
          </div>
        ) : filteredNotifications.length === 0 ? (
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
              No notifications found
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Rule matches and system updates will appear here.
            </p>
          </div>
        ) : (
          <div role="list" aria-live="polite" className="space-y-6">
            {groups.map((group) => (
              <section key={group.label} className="space-y-3">
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.items.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={(notificationId) =>
                        markAsReadMutation.mutate(notificationId)
                      }
                      isMarkingRead={markAsReadMutation.isPending}
                    />
                  ))}
                </div>
              </section>
            ))}

            {notificationsQuery.hasNextPage ? (
              <div className="flex justify-center">
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
          </div>
        )}
      </div>
    </Card>
  )
}

function PreferenceSwitchRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  )
}

function PreferencesPanel() {
  const { data: profile, isLoading } = useProfile()
  const updatePreferencesMutation = useUpdatePreferences()
  const setDefaultNewsRuleStatusMutation = useSetDefaultNewsAlertRuleStatus()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const preferences = profile?.preferences.notifications
  const isBusy =
    isLoading ||
    updatePreferencesMutation.isPending ||
    setDefaultNewsRuleStatusMutation.isPending

  const saveNotificationPreference = async (
    updates: Partial<NonNullable<typeof preferences>>
  ) => {
    setFeedback(null)
    await updatePreferencesMutation.mutateAsync({ notifications: updates })
    setFeedback({ type: 'success', message: 'Preferences saved.' })
  }

  const handleNewsAlertsChange = async (enabled: boolean) => {
    setFeedback(null)

    try {
      if (enabled) {
        await setDefaultNewsRuleStatusMutation.mutateAsync(true)
        await saveNotificationPreference({ newsAlerts: true })
        return
      }

      await saveNotificationPreference({ newsAlerts: false })
      await setDefaultNewsRuleStatusMutation.mutateAsync(false)
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notification preference could not be saved.',
      })
    }
  }

  const handleSimplePreferenceChange = async (
    key: 'priceAlerts' | 'indicatorAlerts',
    enabled: boolean
  ) => {
    try {
      await saveNotificationPreference({ [key]: enabled })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notification preference could not be saved.',
      })
    }
  }

  return (
    <Card className="border-border bg-card p-5">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Notification Preferences</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            These switches map directly to the notification preferences read by
            the scheduled rules.
          </p>
        </div>

        {isLoading && !preferences ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : preferences ? (
          <div className="space-y-3">
            <PreferenceSwitchRow
              title="Market rule notifications"
              description="Allow price rule matches to create notification records."
              checked={preferences.priceAlerts}
              disabled={isBusy}
              onChange={(checked) =>
                handleSimplePreferenceChange('priceAlerts', checked)
              }
            />
            <PreferenceSwitchRow
              title="Indicator rule notifications"
              description="Allow indicator and crossover rule matches to notify you."
              checked={preferences.indicatorAlerts}
              disabled={isBusy}
              onChange={(checked) =>
                handleSimplePreferenceChange('indicatorAlerts', checked)
              }
            />
            <PreferenceSwitchRow
              title="Watchlist news notifications"
              description="Create or pause the watchlist news rule and store the news alert preference."
              checked={preferences.newsAlerts}
              disabled={isBusy}
              onChange={handleNewsAlertsChange}
            />
          </div>
        ) : (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
          >
            Notification preferences could not be loaded.
          </div>
        )}

        {feedback ? (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'rounded-lg border p-3 text-sm',
              feedback.type === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-chart-2/30 bg-chart-2/10 text-chart-2'
            )}
          >
            {feedback.message}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function DevicesPanel() {
  const { data: profile } = useProfile()
  const devicesQuery = useNotificationDevices()
  const updatePreferencesMutation = useUpdatePreferences()
  const syncDeviceMutation = useSyncNotificationDevice()
  const sendTestMutation = useSendTestNotification()
  const [currentDeviceKey] = useState(() => getBrowserDeviceKey())
  const [permissionOverride, setPermissionOverride] =
    useState<NotificationDevicePermission | null>(null)
  const [showPrePrompt, setShowPrePrompt] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const browserPermissionQuery = useQuery({
    queryKey: ['browser-notification-permission', currentDeviceKey],
    queryFn: getBrowserNotificationPermission,
    staleTime: 1000 * 10,
  })

  const devices = devicesQuery.data ?? []
  const currentDevice = devices.find((device) => device.id === currentDeviceKey)
  const pushEnabled = profile?.preferences.notifications.pushEnabled ?? false
  const permission = permissionOverride ?? browserPermissionQuery.data ?? null
  const hasActiveToken = Boolean(
    pushEnabled && currentDevice?.active && currentDevice.token
  )
  const permissionMeta = getPermissionStatusMeta(permission)
  const isBusy =
    updatePreferencesMutation.isPending || syncDeviceMutation.isPending

  const refreshPermission = async () => {
    const nextPermission = await getBrowserNotificationPermission()
    setPermissionOverride(nextPermission)
    return nextPermission
  }

  const syncCurrentBrowserDevice = async ({
    active,
    token,
    nextPermission,
  }: {
    active: boolean
    token: string | null
    nextPermission: NotificationDevicePermission
  }) => {
    const { browser, platform } = getBrowserDescriptor()
    await syncDeviceMutation.mutateAsync({
      deviceKey: getBrowserDeviceKey(),
      token,
      permission: nextPermission,
      browser,
      platform,
      active,
    })
  }

  const handleConfirmEnable = async () => {
    setFeedback(null)

    try {
      const requestedPermission =
        permission === 'granted'
          ? permission
          : await requestBrowserNotificationPermission()
      setPermissionOverride(requestedPermission)

      if (requestedPermission === 'unsupported') {
        await updatePreferencesMutation.mutateAsync({
          notifications: { pushEnabled: false },
        })
        setFeedback({
          type: 'error',
          message: 'This browser does not support web push notifications.',
        })
        return
      }

      if (requestedPermission !== 'granted') {
        await updatePreferencesMutation.mutateAsync({
          notifications: { pushEnabled: false },
        })
        await syncCurrentBrowserDevice({
          active: false,
          token: null,
          nextPermission: requestedPermission,
        })
        setFeedback({
          type: 'error',
          message:
            'Browser permission is required before push delivery can be enabled.',
        })
        return
      }

      await ensureFirebaseMessagingServiceWorker()
      const token = await getBrowserPushToken(VAPID_KEY)

      if (!token) {
        throw new Error('FCM token could not be created for this browser.')
      }

      await syncCurrentBrowserDevice({
        active: true,
        token,
        nextPermission: requestedPermission,
      })
      await updatePreferencesMutation.mutateAsync({
        notifications: { pushEnabled: true },
      })
      setShowPrePrompt(false)
      setFeedback({
        type: 'success',
        message: 'Browser push delivery is enabled for this device.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Browser push could not be enabled.',
      })
    }
  }

  const handleDisablePush = async () => {
    setFeedback(null)

    try {
      const nextPermission = await refreshPermission()
      await updatePreferencesMutation.mutateAsync({
        notifications: { pushEnabled: false },
      })
      await syncCurrentBrowserDevice({
        active: false,
        token: null,
        nextPermission,
      })
      setShowPrePrompt(false)
      setFeedback({
        type: 'success',
        message: 'Browser push delivery is disabled for this device.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Browser push could not be disabled.',
      })
    }
  }

  const handleSendTest = async () => {
    setFeedback(null)
    try {
      const result = await sendTestMutation.mutateAsync()
      setFeedback({
        type: 'success',
        message: `Test notification sent to ${result.delivered} active device(s).`,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Test notification could not be sent.',
      })
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Browser Push Delivery</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Push is global for this browser. In-app notification records are
                still written even when push is off.
              </p>
            </div>
            <Badge variant="outline" className={cn('w-fit', permissionMeta.className)}>
              {permissionMeta.label}
            </Badge>
          </div>

          <div className="border-border bg-background/40 grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Preference</p>
              <p className="mt-1 font-semibold">
                {pushEnabled ? 'Push enabled' : 'Push disabled'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Current device</p>
              <p className="mt-1 font-semibold">
                {currentDevice?.active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Token</p>
              <p className="mt-1 font-semibold">
                {currentDevice?.token ? 'Registered' : 'Missing'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Last seen</p>
              <p className="mt-1 font-semibold">
                {currentDevice?.lastSeenAt
                  ? formatDeviceDateTime(currentDevice.lastSeenAt)
                  : 'Never'}
              </p>
            </div>
          </div>

          {permission === 'denied' ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
              Browser notifications are blocked for this site. Open the site
              controls in the address bar, allow Notifications, then reload this
              page.
            </div>
          ) : null}

          {permission === 'unsupported' ? (
            <div className="border-muted bg-muted text-muted-foreground rounded-lg border p-4 text-sm">
              This browser does not support Firebase web push notifications.
            </div>
          ) : null}

          {showPrePrompt && permission !== 'denied' ? (
            <div className="border-primary/30 bg-primary/10 rounded-lg border p-4">
              <p className="text-sm font-semibold">Enable browser push</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The next step asks the browser for permission. Allow it to send
                rule and watchlist news notifications to this device.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={handleConfirmEnable}
                  disabled={isBusy || permission === 'unsupported'}
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Continue'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowPrePrompt(false)}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {hasActiveToken ? (
              <Button
                variant="outline"
                onClick={handleDisablePush}
                disabled={isBusy}
                className="h-11 sm:h-9"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disable browser push'
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setShowPrePrompt(true)}
                disabled={
                  isBusy ||
                  permission === 'denied' ||
                  permission === 'unsupported'
                }
                className="h-11 sm:h-9"
              >
                Enable browser push
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={!hasActiveToken || sendTestMutation.isPending}
              className="h-11 sm:h-9"
            >
              {sendTestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Send test'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void refreshPermission()
                void devicesQuery.refetch()
              }}
              className="h-11 sm:h-9"
            >
              Check again
            </Button>
          </div>

          {feedback ? (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={cn(
                'rounded-lg border p-3 text-sm',
                feedback.type === 'error'
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : feedback.type === 'success'
                    ? 'border-chart-2/30 bg-chart-2/10 text-chart-2'
                    : 'border-primary/30 bg-primary/10 text-primary'
              )}
            >
              {feedback.message}
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Registered Devices</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Devices are read from Firestore and refreshed automatically.
            </p>
          </div>

          {devicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-primary h-5 w-5 animate-spin" />
            </div>
          ) : devicesQuery.isError ? (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
            >
              Registered devices could not be loaded.
            </div>
          ) : devices.length === 0 ? (
            <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              No registered notification devices yet.
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const devicePermissionMeta = getPermissionStatusMeta(
                  device.permission
                )

                return (
                  <div
                    key={device.id}
                    className="border-border bg-background/40 rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {device.browser} on {device.platform}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Last seen {formatDeviceDateTime(device.lastSeenAt)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', devicePermissionMeta.className)}
                      >
                        {devicePermissionMeta.label}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          device.active
                            ? 'border-chart-2/30 text-chart-2'
                            : 'border-muted text-muted-foreground'
                        )}
                      >
                        {device.active ? 'active' : 'inactive'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {device.token ? 'token registered' : 'no token'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function NotificationsPreview() {
  const unreadCountQuery = useUnreadNotificationsCount()
  const unreadQuery = useNotifications('unread', 'all', 5)
  const markAsReadMutation = useMarkNotificationAsRead()
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
              const meta = getNotificationCategory(notification.kind)
              const Icon = meta.Icon

              return (
                <Link
                  key={notification.id}
                  href={getNotificationTarget(notification)}
                  onClick={() => markAsReadMutation.mutate(notification.id)}
                  className="border-border bg-card hover:bg-muted/30 block rounded-lg border p-3 transition-colors"
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
                      <p className="line-clamp-2 text-sm font-semibold">
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
                </Link>
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const workspaceTab = normalizeWorkspaceTab(searchParams.get('tab'))

  const handleWorkspaceTabChange = (tab: WorkspaceTab) => {
    const params = new URLSearchParams(searchParams.toString())

    if (tab === 'inbox') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Manage notification history, rules, preferences, and browser push
            devices in one place.
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Notification workspace"
        className="border-border bg-card grid gap-1 rounded-lg border p-1 sm:grid-cols-4"
      >
        {WORKSPACE_TABS.map(({ value, label, Icon }) => {
          const isActive = workspaceTab === value

          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleWorkspaceTabChange(value)}
              className={cn(
                'focus-visible:ring-primary flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {workspaceTab === 'inbox' ? <NotificationsInboxPanel /> : null}
      {workspaceTab === 'rules' ? <AlertRulesPanel embedded /> : null}
      {workspaceTab === 'preferences' ? <PreferencesPanel /> : null}
      {workspaceTab === 'devices' ? <DevicesPanel /> : null}
    </div>
  )
}
