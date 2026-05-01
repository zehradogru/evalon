'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Search,
  Bell,
  CheckCircle2,
  Menu,
  ChevronDown,
  Monitor,
  GitBranch,
  Globe,
  List,
  Activity,
  Users,
  Newspaper,
  Sparkles,
  Wallet,
  Trophy,
  TrendingUp,
  Calculator,
  GraduationCap,
  Network,
  Info,
  X,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/store/use-auth-store'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationsCount,
} from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { resolveAvatarUrl } from '@/lib/avatar'
import type { NotificationKind, UserNotification } from '@/types'

// Menu Structure
const menuItems = [
  {
    label: 'Products',
    items: [
      { href: '/', label: 'Dashboard', icon: Monitor },
      { href: '/backtest', label: 'Backtest', icon: Activity },
      { href: '/strategy', label: 'Strategy', icon: GitBranch },
      { href: '/paper-trade', label: 'Paper Trade', icon: Wallet },
      { href: '/paper-trade/leaderboard', label: 'Leaderboard', icon: Trophy },
      { href: '/tools/profit-loss', label: 'P&L Calculator', icon: Calculator },
    ],
  },
  {
    label: 'Markets',
    items: [
      { href: '/markets', label: 'Overview', icon: Globe },
      { href: '/watchlist', label: 'Watchlist', icon: List },
      { href: '/correlation', label: 'Correlation', icon: Activity },
      { href: '/markets/co-movement', label: 'Co-Movement', icon: Network },
      { href: '/screener', label: 'Screeners', icon: Search },
      { href: '/markets/movers', label: 'Top Movers', icon: TrendingUp },
    ],
  },
  {
    label: 'Community',
    href: '/community',
  },
  {
    label: 'Evalon AI',
    href: '/ai',
    highlight: true,
  },
  {
    label: 'More',
    items: [
      { href: '/brokers', label: 'Brokers', icon: Users },
      { href: '/news', label: 'News', icon: Newspaper },
      { href: '/academy', label: 'Academy', icon: GraduationCap },
    ],
  },
]

// Pre-build search index
const SEARCH_INDEX = BIST_AVAILABLE.map((ticker) => ({
  ticker,
  name: TICKER_NAMES[ticker] || ticker,
  searchStr: `${ticker.toLowerCase()} ${(TICKER_NAMES[ticker] || '').toLowerCase()}`,
}))

function TickerSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return SEARCH_INDEX.filter((item) => item.searchStr.includes(q)).slice(0, 8)
  }, [query])
  const selectedResult = results[selectedIndex] || null

  const handleSelect = useCallback(
    (ticker: string) => {
      router.push(`/markets/${ticker}`)
      setQuery('')
      setIsOpen(false)
      inputRef.current?.blur()
    },
    [router]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && selectedResult) {
      e.preventDefault()
      handleSelect(selectedResult.ticker)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative hidden max-w-[260px] flex-1 md:block"
    >
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelectedIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search ticker or company..."
        className="bg-secondary hover:bg-secondary/80 focus:bg-secondary/80 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground h-9 w-full rounded-full px-3 pr-12 pl-10 text-sm transition-colors focus:ring-1 focus:outline-none"
      />
      <kbd className="text-muted-foreground/60 bg-background/50 border-border/50 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px]">
        ⌘K
      </kbd>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="bg-card border-border animate-in fade-in slide-in-from-top-1 absolute top-[calc(100%+4px)] left-0 z-50 w-full rounded-xl border py-1 shadow-2xl duration-150">
          {results.map((item, i) => (
            <div
              key={item.ticker}
              onClick={() => handleSelect(item.ticker)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between px-3 py-2 transition-colors',
                i === selectedIndex ? 'bg-muted/50' : 'hover:bg-muted/30'
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-foreground w-14 flex-shrink-0 text-xs font-bold">
                  {item.ticker}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {item.name}
                </span>
              </div>
              <span className="text-muted-foreground/60 flex-shrink-0 text-[10px]">
                BIST
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="bg-card border-border animate-in fade-in absolute top-[calc(100%+4px)] left-0 z-50 w-full rounded-xl border py-3 shadow-2xl">
          <p className="text-muted-foreground text-center text-xs">
            No results found
          </p>
        </div>
      )}
    </div>
  )
}

function formatRelativeNotificationTime(value: string) {
  const parsed = new Date(value).getTime()
  if (Number.isNaN(parsed)) return ''

  const diffMs = Date.now() - parsed
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Şimdi'
  if (diffMinutes < 60) return `${diffMinutes} dk önce`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} sa önce`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} gün önce`

  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function isErrorNotification(notification: UserNotification) {
  const text = `${notification.title} ${notification.body}`.toLowerCase()
  return (
    notification.kind === 'system' &&
    (text.includes('error') || text.includes('failed') || text.includes('hata'))
  )
}

function getNotificationTrayMeta(notification: UserNotification) {
  if (isErrorNotification(notification)) {
    return {
      Icon: XCircle,
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    }
  }

  const kindMeta: Record<
    NotificationKind,
    {
      Icon: typeof CheckCircle2
      className: string
    }
  > = {
    price: {
      Icon: CheckCircle2,
      className: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
    },
    indicator: {
      Icon: AlertTriangle,
      className: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
    },
    news: {
      Icon: Info,
      className: 'border-primary/30 bg-primary/10 text-primary',
    },
    system: {
      Icon: Info,
      className: 'border-muted bg-muted text-muted-foreground',
    },
  }

  return kindMeta[notification.kind]
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthStore()
  const unreadNotificationsQuery = useUnreadNotificationsCount()
  const recentNotificationsQuery = useNotifications('unread', 'all', 15)
  const markNotificationAsReadMutation = useMarkNotificationAsRead()
  const markAllNotificationsAsReadMutation = useMarkAllNotificationsAsRead()
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clearingNotificationIds, setClearingNotificationIds] = useState<
    string[]
  >([])
  const unreadNotifications = unreadNotificationsQuery.data ?? 0
  const notificationPanelRef = useRef<HTMLDivElement>(null)
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const recentNotifications =
    recentNotificationsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const avatarUrl = resolveAvatarUrl({
    photoURL: user?.photoURL,
    name: user?.name,
    email: user?.email,
  })

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false)
    setActiveDropdown(null)
  }, [pathname])

  useEffect(() => {
    if (activeDropdown !== 'notifications') return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        notificationPanelRef.current?.contains(target) ||
        notificationButtonRef.current?.contains(target)
      ) {
        return
      }

      setActiveDropdown(null)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [activeDropdown])

  const handleLogout = async () => {
    await authService.logout()
    router.push('/login')
  }

  const clearNotification = (notificationId: string) => {
    setClearingNotificationIds((current) =>
      current.includes(notificationId) ? current : [...current, notificationId]
    )

    window.setTimeout(() => {
      markNotificationAsReadMutation.mutate(notificationId)
      setClearingNotificationIds((current) =>
        current.filter((id) => id !== notificationId)
      )
    }, 180)
  }

  const clearAllNotifications = () => {
    const notificationIds = recentNotifications.map(
      (notification) => notification.id
    )
    setClearingNotificationIds(notificationIds)

    window.setTimeout(() => {
      markAllNotificationsAsReadMutation.mutate()
      setClearingNotificationIds([])
    }, 180)
  }

  return (
    <nav
      className="border-border bg-background sticky top-0 z-50 border-b shadow-sm"
      onMouseLeave={() => setActiveDropdown(null)}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4">
        {/* Left Section: Logo + Search + Nav */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Logo */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link
              href="/"
              className="text-foreground hover:text-primary flex min-h-11 items-center text-xl font-bold tracking-tight transition-colors"
              aria-label="Evalon dashboard"
            >
              <span>EVALON</span>
            </Link>
          </div>

          {/* Ticker Search */}
          <TickerSearch />

          {/* Navigation Links - Desktop */}
          <div className="hidden h-16 items-center gap-1 lg:flex">
            {menuItems.map((item) => {
              const isActive = item.items
                ? item.items.some((sub) => pathname === sub.href)
                : pathname === item.href
              const hasDropdown = Boolean(item.items)

              return (
                <div
                  key={item.label}
                  className="relative flex h-full items-center"
                  onMouseEnter={() => {
                    if (hasDropdown) {
                      setActiveDropdown(item.label)
                    } else {
                      // Close any open dropdown when hovering a non-dropdown item
                      setActiveDropdown(null)
                    }
                  }}
                  onClick={() => {
                    if (!hasDropdown && item.href) router.push(item.href)
                  }}
                >
                  <button
                    className={cn(
                      'flex h-10 items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      item.highlight
                        ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:from-blue-300 hover:to-purple-300'
                        : 'hover:bg-secondary/50',
                      !item.highlight &&
                        (isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground')
                    )}
                  >
                    {item.highlight && (
                      <Sparkles
                        size={13}
                        className="flex-shrink-0 text-blue-400"
                      />
                    )}
                    {item.label}
                    {hasDropdown && (
                      <ChevronDown size={14} className="mt-0.5 opacity-50" />
                    )}
                  </button>

                  {/* Dropdown */}
                  {hasDropdown && activeDropdown === item.label && (
                    <div className="bg-card border-border animate-in fade-in slide-in-from-top-2 absolute top-[calc(100%-10px)] left-0 z-50 w-64 rounded-xl border p-2 shadow-2xl">
                      <div className="grid gap-1">
                        {item.items!.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                              'hover:bg-secondary group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                              pathname === subItem.href
                                ? 'bg-secondary/50 text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setActiveDropdown(null)}
                          >
                            <div
                              className={cn(
                                'bg-secondary/30 group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                                pathname === subItem.href
                                  ? 'bg-primary/10 text-primary'
                                  : ''
                              )}
                            >
                              {subItem.icon && <subItem.icon size={16} />}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {subItem.label}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Section: Upgrade + Actions + Profile */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-2 sm:gap-4">
          {/* Upgrade Button (CTA) */}
          <Link href="/pricing" className="hidden md:flex">
            <Button className="h-9 rounded-full border-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl">
              Upgrade Plan
            </Button>
          </Link>

          {/* Divider */}
          <div className="bg-border hidden h-6 w-[1px] md:block"></div>

          {/* Notifications */}
          <div className="relative">
            <Button
              ref={notificationButtonRef}
              variant="ghost"
              size="icon"
              className={cn(
                'text-muted-foreground hover:text-foreground relative h-11 w-11 rounded-full md:h-9 md:w-9',
                activeDropdown === 'notifications' &&
                  'bg-secondary/60 text-foreground'
              )}
              onClick={() => {
                setActiveDropdown((current) =>
                  current === 'notifications' ? null : 'notifications'
                )
                setMobileOpen(false)
              }}
              aria-label={
                unreadNotifications > 0
                  ? `${unreadNotifications} unread notifications`
                  : 'Open notifications'
              }
              aria-expanded={activeDropdown === 'notifications'}
              aria-haspopup="dialog"
              title={
                unreadNotifications > 0
                  ? `${unreadNotifications} unread notifications`
                  : 'Open notifications'
              }
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadNotifications > 0 ? (
                <span className="border-background bg-chart-2 text-background absolute top-1.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[10px] leading-none font-semibold">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              ) : null}
            </Button>

            {activeDropdown === 'notifications' && (
              <div
                ref={notificationPanelRef}
                role="dialog"
                aria-label="Bildirimler"
                className="bg-card border-border animate-in fade-in slide-in-from-top-2 absolute top-[calc(100%+10px)] right-0 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-2xl"
              >
                <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Bildirimler</p>
                    <p className="text-muted-foreground text-xs">
                      Son okunmamış bildirimler
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                    disabled={
                      recentNotifications.length === 0 ||
                      markAllNotificationsAsReadMutation.isPending
                    }
                    onClick={clearAllNotifications}
                  >
                    Tümünü Temizle
                  </Button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-2">
                  {recentNotificationsQuery.isLoading ? (
                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                      Bildirimler yükleniyor
                    </div>
                  ) : recentNotifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <CheckCircle2
                        className="text-chart-2 mx-auto h-8 w-8"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-sm font-medium">
                        Tüm bildirimler temizlendi
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentNotifications.map((notification) => {
                        const meta = getNotificationTrayMeta(notification)
                        const Icon = meta.Icon
                        const isClearing = clearingNotificationIds.includes(
                          notification.id
                        )

                        return (
                          <div
                            key={notification.id}
                            data-state={isClearing ? 'closed' : 'open'}
                            className={cn(
                              'group flex items-start gap-3 rounded-xl border px-3 py-3 transition-all duration-200 ease-out',
                              'data-[state=closed]:-translate-x-3 data-[state=closed]:opacity-0',
                              notification.isRead
                                ? 'border-transparent'
                                : 'border-primary/15 bg-primary/5'
                            )}
                          >
                            <div
                              className={cn(
                                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
                                meta.className
                              )}
                            >
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm leading-5">
                                {notification.title || notification.body}
                              </p>
                              {notification.title && notification.body ? (
                                <p className="text-muted-foreground line-clamp-1 text-xs">
                                  {notification.body}
                                </p>
                              ) : null}
                              <p className="text-muted-foreground mt-1 text-[11px]">
                                {formatRelativeNotificationTime(
                                  notification.createdAt
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 flex-shrink-0 rounded-full opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                              onClick={() => clearNotification(notification.id)}
                              disabled={
                                markNotificationAsReadMutation.isPending ||
                                isClearing
                              }
                              aria-label="Bildirimi temizle"
                              title="Bildirimi temizle"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="border-border bg-background/40 border-t p-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground w-full"
                    onClick={() => setActiveDropdown(null)}
                  >
                    <Link href="/notifications">Bildirim merkezini aç</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="bg-secondary/50 hover:bg-secondary text-foreground flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-0 md:h-9 md:w-9"
              onClick={() =>
                setActiveDropdown(
                  activeDropdown === 'profile' ? null : 'profile'
                )
              }
              aria-label="Open profile menu"
              aria-expanded={activeDropdown === 'profile'}
              aria-haspopup="menu"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="User"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="from-primary to-chart-5 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
            </Button>

            {/* Profile Dropdown Menu */}
            {activeDropdown === 'profile' && (
              <div className="bg-card border-border animate-in fade-in slide-in-from-top-2 absolute top-[calc(100%+10px)] right-0 z-50 w-72 rounded-xl border p-2 shadow-2xl">
                {/* User Info Header */}
                <div className="border-border/50 mb-1 border-b px-3 py-3">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="User"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="from-primary to-chart-5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white">
                        {user?.name?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {user?.name || 'User'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-1 py-1">
                  <button
                    onClick={() => {
                      router.push('/profile')
                      setActiveDropdown(null)
                    }}
                    className="text-foreground hover:bg-secondary w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setActiveDropdown(null)
                    }}
                    className="text-foreground hover:bg-secondary w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  >
                    Settings and billing
                  </button>
                  <button className="text-foreground hover:bg-secondary flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors">
                    <span>Refer a friend</span>
                    <span className="text-muted-foreground text-xs">$0</span>
                  </button>
                </div>

                <div className="border-border/50 my-1 border-t" />

                <div className="grid gap-1 py-1">
                  <button className="text-foreground hover:bg-secondary w-full rounded-lg px-3 py-2 text-left text-sm transition-colors">
                    Support Center
                  </button>
                  <button className="text-foreground hover:bg-secondary flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors">
                    <span>What&apos;s new?</span>
                    <span className="bg-destructive rounded-full px-1.5 py-0.5 text-[10px] text-white">
                      11
                    </span>
                  </button>
                </div>

                <div className="border-border/50 my-1 border-t" />

                <div className="grid gap-1 py-1">
                  <div className="text-foreground group hover:bg-secondary flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors">
                    <span>Dark theme</span>
                    {/* Just a visual toggle for now since we are forced dark */}
                    <div className="bg-primary relative h-5 w-9 rounded-full">
                      <div className="absolute top-1 right-1 h-3 w-3 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>
                  <button className="text-foreground hover:bg-secondary flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors">
                    <span>Language</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      English <ChevronDown size={12} />
                    </span>
                  </button>
                </div>

                <div className="border-border/50 my-1 border-t" />

                <div className="grid gap-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile / Tablet menu ──────────────────────────────── */}
      {mobileOpen && (
        <div className="border-border bg-background/95 animate-in slide-in-from-top-2 space-y-1 border-t px-4 py-3 shadow-xl backdrop-blur-sm lg:hidden">
          {menuItems.map((item) => {
            const hasDropdown = Boolean(item.items)
            const isGroupOpen = activeDropdown === item.label

            if (!hasDropdown) {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.label}
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    item.highlight
                      ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                      : isActive
                        ? 'bg-secondary/60 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.highlight && (
                    <Sparkles
                      size={13}
                      className="flex-shrink-0 text-blue-400"
                    />
                  )}
                  {item.label}
                </Link>
              )
            }

            return (
              <div key={item.label}>
                <button
                  className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                  onClick={() =>
                    setActiveDropdown(isGroupOpen ? null : item.label)
                  }
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    className={cn(
                      'transition-transform duration-200',
                      isGroupOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isGroupOpen && (
                  <div className="border-border/50 mt-1 ml-3 space-y-1 border-l-2 pl-3">
                    {item.items!.map((subItem) => {
                      const Icon = subItem.icon
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                            pathname === subItem.href
                              ? 'bg-secondary/60 text-foreground'
                              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                          )}
                          onClick={() => setMobileOpen(false)}
                        >
                          {Icon && <Icon size={15} className="flex-shrink-0" />}
                          {subItem.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
