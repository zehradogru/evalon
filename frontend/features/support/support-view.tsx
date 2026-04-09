'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCircle, MessageCircle, FileText, Mail, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SupportViewProps {
    isWidget?: boolean;
}

export function SupportView({ isWidget = false }: SupportViewProps) {
    return (
        <div className={cn("flex flex-col h-full bg-background", isWidget ? "p-0" : "p-6 gap-6")}>
            {isWidget && (
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <HelpCircle size={16} /> Help & Support
                    </span>
                </div>
            )}

            <div className={cn("flex-1 overflow-auto", isWidget ? "p-4 space-y-6" : "")}>
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="How can we help?" className="pl-9 bg-secondary/50 border-transparent focus:bg-background focus:border-primary" />
                </div>

                {/* Quick Links */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Links</h4>
                    <div className="grid gap-2">
                        <Button variant="outline" className="justify-start h-auto py-3 px-3 border-border hover:bg-accent/50 hover:border-primary/50 text-left">
                            <FileText size={16} className="mr-3 text-primary" />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">Documentation</span>
                                <span className="text-[10px] text-muted-foreground font-normal">Platform guides and API docs</span>
                            </div>
                        </Button>
                        <Button variant="outline" className="justify-start h-auto py-3 px-3 border-border hover:bg-accent/50 hover:border-primary/50 text-left">
                            <MessageCircle size={16} className="mr-3 text-chart-2" />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">Community Forum</span>
                                <span className="text-[10px] text-muted-foreground font-normal">Join the discussion</span>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Contact */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Us</h4>
                    <Card className="p-4 border-border bg-card/50">
                        <div className="flex items-start gap-3">
                            <Mail size={18} className="mt-0.5 text-foreground" />
                            <div className="space-y-1">
                                <div className="font-medium text-sm">Submit a Ticket</div>
                                <p className="text-xs text-muted-foreground">We typically respond within 24 hours.</p>
                                <Button size="sm" className="w-full mt-2 h-7 text-xs">Open Ticket</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
