'use client';

import { Badge } from '@/components/ui/badge';
import { Bell, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn utility is available

interface NotificationsViewProps {
    isWidget?: boolean;
}

const mockNotifications = [
    { id: 1, type: 'alert', title: 'Price Alert: AAPL', message: 'AAPL crossed above $180.00', time: '10:30 AM', read: false },
    { id: 2, type: 'info', title: 'System Maintenance', message: 'Scheduled maintenance tonight at 02:00 AM UTC.', time: '09:00 AM', read: true },
    { id: 3, type: 'success', title: 'Order Executed', message: 'Buy 100 shares of MSFT at $405.20 filled.', time: 'Yesterday', read: true },
    { id: 4, type: 'warning', title: 'Margin Call Warning', message: 'Your account margin level is approaching 25%.', time: 'Yesterday', read: true },
];

export function NotificationsView({ isWidget = false }: NotificationsViewProps) {
    return (
        <div className={cn("flex flex-col h-full bg-background", isWidget ? "p-0" : "p-6 gap-6")}>
            {!isWidget && (
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                    <p className="text-muted-foreground">Manage your alerts and system messages.</p>
                </div>
            )}

            <div className={cn("flex flex-col gap-4 flex-1 overflow-hidden", isWidget ? "h-full" : "")}>
                {/* Header for Widget */}
                {isWidget && (
                    <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10">
                        <span className="font-semibold text-sm flex items-center gap-2">
                            <Bell size={16} /> Notifications
                        </span>
                        <Badge variant="secondary" className="bg-secondary text-xs">4 New</Badge>
                    </div>
                )}

                <div className={cn("flex-1 overflow-auto space-y-2", isWidget ? "px-2 py-2" : "")}>
                    {mockNotifications.map(notif => (
                        <div key={notif.id} className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border border-transparent hover:bg-accent/50 hover:border-border transition-colors cursor-pointer relative group",
                            !notif.read && "bg-accent/10 border-l-2 border-l-primary"
                        )}>
                            <div className={cn("mt-1",
                                notif.type === 'alert' ? 'text-primary' :
                                    notif.type === 'warning' ? 'text-chart-4' :
                                        notif.type === 'success' ? 'text-chart-2' : 'text-muted-foreground'
                            )}>
                                {notif.type === 'alert' ? <Bell size={16} /> :
                                    notif.type === 'warning' ? <AlertTriangle size={16} /> :
                                        notif.type === 'success' ? <CheckCircle size={16} /> : <Info size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <span className={cn("text-sm font-medium", !notif.read && "font-bold")}>{notif.title}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">{notif.time}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            </div>
                            {!notif.read && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
