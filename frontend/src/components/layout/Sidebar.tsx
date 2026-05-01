'use client';

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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAlertRules } from '@/hooks/use-alert-rules';
import { useNewsAlertRules } from '@/hooks/use-news-alert-rules';
import { useUnreadNotificationsCount } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const tools = [
    { name: 'Watchlist', label: 'Watchlist', icon: Star, path: '/watchlist', isWidget: true },
    { name: 'Paper Trade', label: 'Paper Trade', icon: BriefcaseBusiness, path: '/paper-trade', isWidget: true },
    { name: 'Alerts', label: 'Price Alerts', icon: BellPlus, path: '/alerts', isWidget: true },
    { name: 'News', label: 'News', icon: Newspaper, path: '/news', isWidget: true },
    { name: 'Screeners', label: 'Market Screener', icon: SlidersHorizontal, path: '/screener', isWidget: true },
    { name: 'Evalon AI', label: 'Evalon AI', icon: Bot, path: '/ai', isWidget: true },
    { name: 'Calendar', label: 'Economic Calendar', icon: CalendarDays, path: '/calendar', isWidget: true },
    { name: 'Notifications', label: 'Notifications', icon: Inbox, path: '/notifications', isWidget: true },
];

interface SidebarProps {
    activePanel?: string | null;
    onTogglePanel?: (panel: string) => void;
}

export function Sidebar({ activePanel, onTogglePanel }: SidebarProps) {
    const pathname = usePathname();
    const { data: alertRules = [] } = useAlertRules();
    const { data: newsAlertRules = [] } = useNewsAlertRules();
    const { data: unreadNotifications = 0 } = useUnreadNotificationsCount();
    const activeAlertCount =
        alertRules.filter((rule) => rule.status === 'active').length +
        newsAlertRules.filter((rule) => rule.status === 'active').length;

    const handleToolClick = (e: React.MouseEvent, tool: typeof tools[0]) => {
        if (tool.isWidget && onTogglePanel) {
            e.preventDefault();
            onTogglePanel(tool.name);
        }
    };

    return (
        <aside className="w-[52px] flex flex-col items-center bg-sidebar text-sidebar-foreground border-l border-sidebar-border h-full py-2 z-30 flex-shrink-0">
            <div className="flex-1 flex flex-col items-center gap-1 w-full overflow-y-auto scrollbar-hide">
                {tools.map((tool) => (
                    <Link
                        key={tool.name}
                        href={tool.path || '#'}
                        onClick={(e) => handleToolClick(e, tool)}
                        className={cn(
                            "w-full h-[42px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors relative group",
                            (pathname === tool.path && !activePanel) && "text-primary bg-card",
                            activePanel === tool.name && "text-primary bg-card border-l-2 border-primary"
                        )}
                        title={tool.label}
                    >
                        <tool.icon size={20} strokeWidth={1.5} />
                        {(pathname === tool.path && !activePanel) && (
                            <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-primary" />
                        )}
                        {tool.name === 'Alerts' && activeAlertCount > 0 && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                                {activeAlertCount > 9 ? '9+' : activeAlertCount}
                            </span>
                        )}
                        {tool.name === 'Notifications' && unreadNotifications > 0 && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-chart-2 px-1 text-[9px] font-semibold text-background">
                                {unreadNotifications > 9 ? '9+' : unreadNotifications}
                            </span>
                        )}

                        {/* Tooltip on Hover */}
                        <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                            {tool.label}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-auto w-full flex flex-col items-center gap-1">
                <button
                    onClick={() => onTogglePanel && onTogglePanel('Settings')}
                    className={cn(
                        "w-full h-[42px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors relative group",
                        activePanel === 'Settings' && "text-primary bg-card border-l-2 border-primary"
                    )}
                >
                    <Settings size={20} strokeWidth={1.5} />
                    <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                        Settings
                    </div>
                </button>

                <button
                    onClick={() => onTogglePanel && onTogglePanel('Support')}
                    className={cn(
                        "w-full h-[42px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors relative group",
                        activePanel === 'Support' && "text-primary bg-card border-l-2 border-primary"
                    )}
                >
                    <HelpCircle size={20} strokeWidth={1.5} />
                    <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                        Support
                    </div>
                </button>
            </div>
        </aside>
    );
}
