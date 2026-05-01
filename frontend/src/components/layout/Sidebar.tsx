'use client'

import {
  BellPlus,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  HelpCircle,
  Inbox,
  Newspaper,
  Settings,
  SlidersHorizontal,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAlertRules } from '@/hooks/use-alert-rules'
import { useNewsAlertRules } from '@/hooks/use-news-alert-rules'
import { useUnreadNotificationsCount } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

const tools = [
  {
    name: 'Watchlist',
    label: 'Watchlist',
    icon: Star,
    path: '/watchlist',
    isWidget: true,
  },
  {
    name: 'Paper Trade',
    label: 'Paper Trade',
    icon: BriefcaseBusiness,
    path: '/paper-trade',
    isWidget: true,
  },
  {
    name: 'Alerts',
    label: 'Price Alerts',
    icon: BellPlus,
    path: '/alerts',
    isWidget: true,
  },
  {
    name: 'News',
    label: 'News',
    icon: Newspaper,
    path: '/news',
    isWidget: true,
  },
  {
    name: 'Screeners',
    label: 'Market Screener',
    icon: SlidersHorizontal,
    path: '/screener',
    isWidget: true,
  },
  {
    name: 'Evalon AI',
    label: 'Evalon AI',
    icon: Bot,
    path: '/ai',
    isWidget: true,
  },
  {
    name: 'Calendar',
    label: 'Economic Calendar',
    icon: CalendarDays,
    path: '/calendar',
    isWidget: true,
  },
  {
    name: 'Notifications',
    label: 'Notifications',
    icon: Inbox,
    path: '/notifications',
    isWidget: true,
  },
]

interface SidebarProps {
  activePanel?: string | null
  onTogglePanel?: (panel: string) => void
}

export function Sidebar({ activePanel, onTogglePanel }: SidebarProps) {
  const pathname = usePathname()
  const { data: alertRules = [] } = useAlertRules()
  const { data: newsAlertRules = [] } = useNewsAlertRules()
  const { data: unreadNotifications = 0 } = useUnreadNotificationsCount()
  const activeAlertCount =
    alertRules.filter((rule) => rule.status === 'active').length +
    newsAlertRules.filter((rule) => rule.status === 'active').length

  const getToolAriaLabel = (tool: (typeof tools)[0]) => {
    if (tool.name === 'Alerts') {
      return `${tool.label}, ${activeAlertCount} active rules`
    }

    if (tool.name === 'Notifications') {
      return `${tool.label}, ${unreadNotifications} unread`
    }

    return tool.label
  }

  const handleToolClick = (e: React.MouseEvent, tool: (typeof tools)[0]) => {
    if (tool.isWidget && onTogglePanel) {
      e.preventDefault()
      onTogglePanel(tool.name)
    }
  }

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border z-30 flex h-full w-[52px] flex-shrink-0 flex-col items-center border-l py-2">
      <div className="scrollbar-hide flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {tools.map((tool) => (
          <Link
            key={tool.name}
            href={tool.path || '#'}
            onClick={(e) => handleToolClick(e, tool)}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-card focus-visible:ring-primary group relative flex h-11 w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
              pathname === tool.path && !activePanel && 'text-primary bg-card',
              activePanel === tool.name &&
                'text-primary bg-card border-primary border-l-2'
            )}
            aria-label={getToolAriaLabel(tool)}
            aria-current={pathname === tool.path ? 'page' : undefined}
            title={tool.label}
          >
            <tool.icon size={20} strokeWidth={1.5} />
            {pathname === tool.path && !activePanel && (
              <div className="bg-primary absolute top-0 right-0 bottom-0 w-[2px]" />
            )}
            {tool.name === 'Alerts' && activeAlertCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold">
                {activeAlertCount > 9 ? '9+' : activeAlertCount}
              </span>
            )}
            {tool.name === 'Notifications' && unreadNotifications > 0 && (
              <span className="bg-chart-2 text-background absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}

            {/* Tooltip on Hover */}
            <div className="bg-popover text-popover-foreground border-border pointer-events-none absolute right-full z-50 mr-2 rounded border px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
              {tool.label}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <button
          onClick={() => onTogglePanel && onTogglePanel('Settings')}
          className={cn(
            'text-muted-foreground hover:text-foreground hover:bg-card focus-visible:ring-primary group relative flex h-11 w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
            activePanel === 'Settings' &&
              'text-primary bg-card border-primary border-l-2'
          )}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={20} strokeWidth={1.5} />
          <div className="bg-popover text-popover-foreground border-border pointer-events-none absolute right-full z-50 mr-2 rounded border px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            Settings
          </div>
        </button>

        <button
          onClick={() => onTogglePanel && onTogglePanel('Support')}
          className={cn(
            'text-muted-foreground hover:text-foreground hover:bg-card focus-visible:ring-primary group relative flex h-11 w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
            activePanel === 'Support' &&
              'text-primary bg-card border-primary border-l-2'
          )}
          aria-label="Support"
          title="Support"
        >
          <HelpCircle size={20} strokeWidth={1.5} />
          <div className="bg-popover text-popover-foreground border-border pointer-events-none absolute right-full z-50 mr-2 rounded border px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            Support
          </div>
        </button>
      </div>
    </aside>
  )
}
