'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Bell, Menu, ChevronDown, Monitor, BarChart2, GitBranch, Globe, List, Activity, Users, Newspaper, Sparkles, Wallet, Trophy, TrendingUp, Calculator, GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/store/use-auth-store'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { resolveAvatarUrl } from '@/lib/avatar'

// Menu Structure
const menuItems = [
  {
    label: 'Products',
    items: [
      { href: '/', label: 'Dashboard', icon: Monitor },
      { href: '/analysis', label: 'Analysis', icon: BarChart2 },
      { href: '/backtest', label: 'Backtest', icon: Activity },
      { href: '/strategy', label: 'Strategy', icon: GitBranch },
      { href: '/paper-trade', label: 'Paper Trade', icon: Wallet },
      { href: '/paper-trade/time-machine', label: 'Tarihsel Simülasyon', icon: Sparkles },
      { href: '/paper-trade/leaderboard', label: 'Liderlik Tablosu', icon: Trophy },
      { href: '/tools/profit-loss', label: 'Kar/Zarar Hesap.', icon: Calculator },
    ]
  },
  {
    label: 'Markets',
    items: [
      { href: '/markets', label: 'Overview', icon: Globe },
      { href: '/watchlist', label: 'Watchlist', icon: List },
      { href: '/correlation', label: 'Correlation', icon: Activity },
      { href: '/screener', label: 'Screeners', icon: Search },
      { href: '/markets/movers', label: 'Top Movers', icon: TrendingUp },
    ]
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
    ]
  }
]

// Pre-build search index
const SEARCH_INDEX = BIST_AVAILABLE.map(ticker => ({
  ticker,
  name: TICKER_NAMES[ticker] || ticker,
  searchStr: `${ticker} ${(TICKER_NAMES[ticker] || '').toLowerCase()}`,
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
    return SEARCH_INDEX
      .filter(item => item.searchStr.includes(q))
      .slice(0, 8)
  }, [query])
  const selectedResult = results[selectedIndex] || null

  const handleSelect = useCallback((ticker: string) => {
    router.push(`/markets/${ticker}`)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }, [router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    <div ref={containerRef} className="relative flex-1 max-w-[260px] hidden md:block">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
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
        className="w-full h-9 rounded-full bg-secondary hover:bg-secondary/80 focus:bg-secondary/80 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors px-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 bg-background/50 px-1.5 py-0.5 rounded border border-border/50 pointer-events-none">
        ⌘K
      </kbd>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-card border border-border shadow-2xl rounded-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {results.map((item, i) => (
            <div
              key={item.ticker}
              onClick={() => handleSelect(item.ticker)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                i === selectedIndex ? "bg-muted/50" : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold text-foreground w-14 flex-shrink-0">{item.ticker}</span>
                <span className="text-xs text-muted-foreground truncate">{item.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">BIST</span>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-card border border-border shadow-2xl rounded-xl py-3 z-50 animate-in fade-in">
          <p className="text-xs text-muted-foreground text-center">No results found</p>
        </div>
      )}
    </div>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthStore()
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const avatarUrl = resolveAvatarUrl({
    photoURL: user?.photoURL,
    name: user?.name,
    email: user?.email,
  })

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    setActiveDropdown(null)
  }, [pathname])

  const handleLogout = async () => {
    await authService.logout()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background shadow-sm" onMouseLeave={() => setActiveDropdown(null)}>
      <div className="w-full px-4 h-16 flex items-center justify-between gap-4">

        {/* Left Section: Logo + Search + Nav */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                E
              </div>
              <span className="hidden xl:inline-block">EVALON</span>
            </Link>
          </div>

          {/* Ticker Search */}
          <TickerSearch />

          {/* Navigation Links - Desktop */}
          <div className="hidden lg:flex items-center gap-1 h-16">
            {menuItems.map((item) => {
              const isActive = item.items
                ? item.items.some(sub => pathname === sub.href)
                : pathname === item.href;
              const hasDropdown = Boolean(item.items)

              return (
                <div
                  key={item.label}
                  className="relative h-full flex items-center"
                  onMouseEnter={() => {
                    if (hasDropdown) {
                      setActiveDropdown(item.label)
                    } else {
                      // Close any open dropdown when hovering a non-dropdown item
                      setActiveDropdown(null)
                    }
                  }}
                  onClick={() => {
                    if (!hasDropdown && item.href) router.push(item.href);
                  }}
                >
                  <button
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors rounded-md flex items-center gap-1.5 h-10",
                      item.highlight
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-300 hover:to-purple-300"
                        : "hover:bg-secondary/50",
                      !item.highlight && (isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")
                    )}
                  >
                    {item.highlight && <Sparkles size={13} className="text-blue-400 flex-shrink-0" />}
                    {item.label}
                    {hasDropdown && <ChevronDown size={14} className="mt-0.5 opacity-50" />}
                  </button>

                  {/* Dropdown */}
                  {hasDropdown && activeDropdown === item.label && (
                    <div className="absolute top-[calc(100%-10px)] left-0 w-64 bg-card border border-border shadow-2xl rounded-xl p-2 animate-in fade-in slide-in-from-top-2 z-50">
                      <div className="grid gap-1">
                        {item.items!.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-secondary group",
                              pathname === subItem.href ? "bg-secondary/50 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setActiveDropdown(null)}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-md flex items-center justify-center bg-secondary/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors",
                              pathname === subItem.href ? "bg-primary/10 text-primary" : ""
                            )}>
                              {subItem.icon && <subItem.icon size={16} />}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{subItem.label}</span>
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
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-auto">

          {/* Upgrade Button (CTA) */}
          <Button className="hidden md:flex bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 h-9 rounded-full px-6 font-semibold shadow-lg hover:shadow-xl transition-all">
            Upgrade Plan
          </Button>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-border hidden md:block"></div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background"></span>
          </Button>


          {/* User Profile Dropdown */}
          <div className="relative ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-secondary/50 hover:bg-secondary text-foreground h-9 w-9"
              onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="User" className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
            </Button>

            {/* Profile Dropdown Menu */}
            {activeDropdown === 'profile' && (
              <div className="absolute top-[calc(100%+10px)] right-0 w-72 bg-card border border-border shadow-2xl rounded-xl p-2 animate-in fade-in slide-in-from-top-2 z-50">

                {/* User Info Header */}
                <div className="px-3 py-3 border-b border-border/50 mb-1">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="User" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-sm font-bold text-white">
                        {user?.name?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{user?.name || 'User'}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-1 py-1">
                  <button
                    onClick={() => {
                      router.push('/profile')
                      setActiveDropdown(null)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setActiveDropdown(null)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    Settings and billing
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex justify-between items-center">
                    <span>Refer a friend</span>
                    <span className="text-muted-foreground text-xs">$0</span>
                  </button>
                </div>

                <div className="my-1 border-t border-border/50" />

                <div className="grid gap-1 py-1">
                  <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors">
                    Support Center
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex justify-between items-center">
                    <span>What&apos;s new?</span>
                    <span className="bg-destructive text-white text-[10px] px-1.5 py-0.5 rounded-full">11</span>
                  </button>
                </div>

                <div className="my-1 border-t border-border/50" />

                <div className="grid gap-1 py-1">
                  <div className="w-full px-3 py-2 text-sm text-foreground flex justify-between items-center group hover:bg-secondary rounded-lg cursor-pointer transition-colors">
                    <span>Dark theme</span>
                    {/* Just a visual toggle for now since we are forced dark */}
                    <div className="w-9 h-5 bg-primary rounded-full relative">
                      <div className="absolute right-1 top-1 h-3 w-3 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                  <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex justify-between items-center">
                    <span>Language</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">English <ChevronDown size={12} /></span>
                  </button>
                </div>

                <div className="my-1 border-t border-border/50" />

                <div className="grid gap-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive font-medium rounded-lg transition-colors"
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
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 space-y-1 shadow-xl animate-in slide-in-from-top-2">
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
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    item.highlight
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400'
                      : isActive
                        ? 'bg-secondary/60 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.highlight && <Sparkles size={13} className="text-blue-400 flex-shrink-0" />}
                  {item.label}
                </Link>
              )
            }

            return (
              <div key={item.label}>
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
                  onClick={() => setActiveDropdown(isGroupOpen ? null : item.label)}
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', isGroupOpen && 'rotate-180')}
                  />
                </button>
                {isGroupOpen && (
                  <div className="mt-1 ml-3 space-y-1 border-l-2 border-border/50 pl-3">
                    {item.items!.map((subItem) => {
                      const Icon = subItem.icon
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
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
