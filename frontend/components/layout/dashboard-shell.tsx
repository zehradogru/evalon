'use client'

import { ReactNode, useRef, useState } from 'react'
import { Navbar } from '@/components/dashboard/navbar'
import { TickerTape } from '@/features/dashboard/ticker-tape'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { CalendarView } from '@/features/calendar/calendar-view'
import { WatchlistView } from '@/features/watchlist/watchlist-view'
import { AlertsView } from '@/features/notifications/alerts-view'
import { NewsView } from '@/features/news/news-view'
import { ScreenerView } from '@/features/screener/screener-view'
import { AiAssistantView } from '@/features/ai-assistant/ai-assistant-view'
import { NotificationsView } from '@/features/notifications/notifications-view'
import { SupportView } from '@/features/support/support-view'
import { SettingsView } from '@/features/settings/settings-view'
import { PaperTradeWidget } from '@/features/paper-trade/paper-trade-widget'
import { DashboardFooter } from '@/components/layout/dashboard-footer'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [panelWidth, setPanelWidth] = useState(340)
  const isResizing = useRef(false)

  const togglePanel = (panel: string) => {
    if (activePanel === panel) {
      setActivePanel(null)
    } else {
      setActivePanel(panel)
    }
  }

  function startResize(e: React.MouseEvent) {
    isResizing.current = true
    const startX = e.clientX
    const startWidth = panelWidth

    function onMouseMove(ev: MouseEvent) {
      if (!isResizing.current) return
      const delta = startX - ev.clientX
      setPanelWidth(Math.min(700, Math.max(280, startWidth + delta)))
    }
    function onMouseUp() {
      isResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden font-sans">
      {/* Main Content Area (Left) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar />

        {/* Ticker Tape - Top full width */}
        <div className="border-border z-10 w-full border-b">
          <TickerTape />
        </div>

        {/* Scrollable Page Content */}
        <main className="scrollbar-hide bg-background relative flex flex-1 flex-col overflow-y-auto p-0">
          {children}
          <DashboardFooter />
        </main>
      </div>

      {/* Right Widget Panel (Expandable) */}
      <div
        style={activePanel ? { width: panelWidth } : undefined}
        className={cn(
          'bg-card border-border relative z-20 flex origin-right flex-col border-l shadow-xl transition-[width] duration-0',
          activePanel ? 'flex' : 'hidden'
        )}
      >
        {/* Resize handle — left edge drag */}
        <div
          onMouseDown={startResize}
          className="hover:bg-primary/40 active:bg-primary/60 absolute top-0 bottom-0 left-0 z-30 w-1.5 cursor-col-resize transition-colors"
        />
        <div className="relative flex h-full flex-col">
          {activePanel === 'Paper Trade' && <PaperTradeWidget />}
          {activePanel === 'Calendar' && <CalendarView isWidget />}
          {activePanel === 'Watchlist' && <WatchlistView isWidget />}
          {activePanel === 'Alerts' && <AlertsView isWidget />}
          {activePanel === 'News' && <NewsView isWidget />}
          {activePanel === 'Screeners' && <ScreenerView isWidget />}
          {activePanel === 'Evalon AI' && <AiAssistantView isWidget />}
          {activePanel === 'Notifications' && <NotificationsView isWidget />}
          {activePanel === 'Support' && <SupportView isWidget />}
          {activePanel === 'Settings' && <SettingsView isWidget />}
        </div>
      </div>

      {/* Right Sidebar (Fixed) */}
      <Sidebar activePanel={activePanel} onTogglePanel={togglePanel} />
    </div>
  )
}
