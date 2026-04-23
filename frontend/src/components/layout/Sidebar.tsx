'use client';

import {
    List,
    Newspaper,
    Calendar,
    Lightbulb,
    MessageSquare,
    Bell,
    HelpCircle,
    Settings,
    Wallet
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

// TradingView Right Toolbar Icons
// TradingView Right Toolbar Icons
// TradingView Right Toolbar Icons
const tools = [
    { name: 'Watchlist', icon: List, path: '/watchlist', isWidget: true },
    { name: 'Paper Trade', icon: Wallet, path: '/paper-trade', isWidget: false },
    { name: 'Alerts', icon: Bell, path: '/alerts', isWidget: true },
    { name: 'News', icon: Newspaper, path: '/news', isWidget: true },
    { name: 'Screeners', icon: Search, path: '/screener', isWidget: true },
    { name: 'Evalon AI', icon: Lightbulb, path: '/ai', isWidget: true },
    { name: 'Calendar', icon: Calendar, path: '/calendar', isWidget: true },
    { name: 'Notifications', icon: MessageSquare, path: '/notifications', isWidget: true },
];

interface SidebarProps {
    activePanel?: string | null;
    onTogglePanel?: (panel: string) => void;
}

export function Sidebar({ activePanel, onTogglePanel }: SidebarProps) {
    const pathname = usePathname();

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
                        title={tool.name}
                    >
                        <tool.icon size={20} strokeWidth={1.5} />
                        {(pathname === tool.path && !activePanel) && (
                            <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-primary" />
                        )}

                        {/* Tooltip on Hover */}
                        <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                            {tool.name}
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
