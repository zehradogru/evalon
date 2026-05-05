import {
  Activity,
  BellPlus,
  CalendarDays,
  MessageCircle,
  Newspaper,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import type { NotificationKind, NotificationKindFilter, UserNotification } from '@/types'

export type NotificationCategoryId =
  | NotificationKind
  | 'community'
  | 'earnings'

export interface NotificationCategoryConfig {
  id: NotificationCategoryId
  label: string
  shortLabel: string
  Icon: LucideIcon
  className: string
  iconClassName: string
  status: 'active' | 'reserved'
}

export const NOTIFICATION_CATEGORY_CONFIG: Record<
  NotificationCategoryId,
  NotificationCategoryConfig
> = {
  news: {
    id: 'news',
    label: 'News',
    shortLabel: 'News',
    Icon: Newspaper,
    className: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
    iconClassName: 'text-chart-4',
    status: 'active',
  },
  price: {
    id: 'price',
    label: 'Price',
    shortLabel: 'Price',
    Icon: BellPlus,
    className: 'border-primary/30 bg-primary/10 text-primary',
    iconClassName: 'text-primary',
    status: 'active',
  },
  indicator: {
    id: 'indicator',
    label: 'Indicator',
    shortLabel: 'Indicator',
    Icon: Activity,
    className: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
    iconClassName: 'text-chart-2',
    status: 'active',
  },
  system: {
    id: 'system',
    label: 'System',
    shortLabel: 'System',
    Icon: ShieldCheck,
    className: 'border-muted bg-muted text-muted-foreground',
    iconClassName: 'text-muted-foreground',
    status: 'active',
  },
  community: {
    id: 'community',
    label: 'Community',
    shortLabel: 'Community',
    Icon: MessageCircle,
    className: 'border-muted bg-muted text-muted-foreground',
    iconClassName: 'text-muted-foreground',
    status: 'reserved',
  },
  earnings: {
    id: 'earnings',
    label: 'Earnings',
    shortLabel: 'Earnings',
    Icon: CalendarDays,
    className: 'border-muted bg-muted text-muted-foreground',
    iconClassName: 'text-muted-foreground',
    status: 'reserved',
  },
}

export const ACTIVE_NOTIFICATION_KIND_FILTERS: Array<{
  value: NotificationKindFilter
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'news', label: 'News' },
  { value: 'price', label: 'Price' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'system', label: 'System' },
]

export function getNotificationCategory(kind: NotificationKind) {
  return NOTIFICATION_CATEGORY_CONFIG[kind]
}

export function getNotificationTickers(notification: UserNotification): string[] {
  const payloadTickers = notification.payload?.tickers

  if (Array.isArray(payloadTickers)) {
    return payloadTickers
      .filter((ticker): ticker is string => typeof ticker === 'string')
      .map((ticker) => ticker.toUpperCase())
  }

  return notification.ticker ? [notification.ticker.toUpperCase()] : []
}

export function getNotificationCount(notification: UserNotification): number | null {
  const count = notification.payload?.count
  return typeof count === 'number' && Number.isFinite(count) ? count : null
}

export function getNotificationTarget(notification: UserNotification): string {
  if (notification.kind === 'news') {
    const tickers = getNotificationTickers(notification)
    if (tickers.length > 0) {
      const params = new URLSearchParams({ symbols: tickers.join(',') })
      return `/news?${params.toString()}`
    }

    return '/news'
  }

  if (notification.ruleId) {
    return `/alerts#rule-${notification.ruleId}`
  }

  if (notification.ticker) {
    return `/markets/${notification.ticker}`
  }

  return '/notifications'
}

export function getNotificationActionLabel(notification: UserNotification): string {
  if (notification.kind === 'news') return 'Open news'
  if (notification.ruleId) return 'Open rule'
  if (notification.ticker) return notification.ticker
  return 'Open notifications'
}
