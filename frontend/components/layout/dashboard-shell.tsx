'use client';

import { ReactNode, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DashboardShellProps {
    children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
    const [activePanel, setActivePanel] = useState<string | null>(null);

    const togglePanel = (panel: string) => {
        if (activePanel === panel) {
            setActivePanel(null);
        } else {
            setActivePanel(panel);
        }
    };

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
                <main className="flex-1 overflow-y-auto p-0 scrollbar-hide bg-background relative">
                    {children}
                </main>
            </div>

            {/* Right Widget Panel (Expandable) */}
            <div className={cn(
                "w-[340px] bg-card border-l border-border flex flex-col transition-all duration-300 ease-in-out transform origin-right z-20 shadow-xl",
                activePanel ? "translate-x-0 mr-0" : "translate-x-full -mr-[340px] hidden"
            )}>
                <div className="flex flex-col h-full relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 z-20 h-6 w-6"
                        onClick={() => setActivePanel(null)}
                    >
                        <X size={14} />
                    </Button>

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
