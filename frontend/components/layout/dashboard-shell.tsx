'use client';

import { ReactNode, useRef, useState } from 'react';
import { Navbar } from '@/components/dashboard/navbar';
import { TickerTape } from '@/features/dashboard/ticker-tape';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { CalendarView } from '@/features/calendar/calendar-view';
import { WatchlistView } from '@/features/watchlist/watchlist-view';
import { AlertsView } from '@/features/notifications/alerts-view';
import { NewsView } from '@/features/news/news-view';
import { ScreenerView } from '@/features/screener/screener-view';
import { AiAssistantView } from '@/features/ai-assistant/ai-assistant-view';
import { NotificationsView } from '@/features/notifications/notifications-view';
import { SupportView } from '@/features/support/support-view';
import { SettingsView } from '@/features/settings/settings-view';
import { PaperTradeWidget } from '@/features/paper-trade/paper-trade-widget';
import { DashboardFooter } from '@/components/layout/dashboard-footer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DashboardShellProps {
    children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
    const [activePanel, setActivePanel] = useState<string | null>(null);
    const [panelWidth, setPanelWidth] = useState(340);
    const isResizing = useRef(false);

    const togglePanel = (panel: string) => {
        if (activePanel === panel) {
            setActivePanel(null);
        } else {
            setActivePanel(panel);
        }
    };

    function startResize(e: React.MouseEvent) {
        isResizing.current = true;
        const startX = e.clientX;
        const startWidth = panelWidth;

        function onMouseMove(ev: MouseEvent) {
            if (!isResizing.current) return;
            const delta = startX - ev.clientX;
            setPanelWidth(Math.min(700, Math.max(280, startWidth + delta)));
        }
        function onMouseUp() {
            isResizing.current = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* Main Content Area (Left) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Navbar */}
                <Navbar />

                {/* Ticker Tape - Top full width */}
                <div className="w-full z-10 border-b border-border">
                    <TickerTape />
                </div>

                {/* Scrollable Page Content */}
                <main className="flex-1 overflow-y-auto p-0 scrollbar-hide bg-background relative flex flex-col">
                    {children}
                    <DashboardFooter />
                </main>
            </div>

            {/* Right Widget Panel (Expandable) */}
            <div
                style={activePanel ? { width: panelWidth } : undefined}
                className={cn(
                    "bg-card border-l border-border flex flex-col origin-right z-20 shadow-xl transition-[width] duration-0 relative",
                    activePanel ? "flex" : "hidden"
                )}
            >
                {/* Resize handle — left edge drag */}
                <div
                    onMouseDown={startResize}
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-30"
                />
                <div className="flex flex-col h-full relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 z-20 h-6 w-6"
                        onClick={() => setActivePanel(null)}
                    >
                        <X size={14} />
                    </Button>

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
    );
}
