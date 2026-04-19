'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select-native';
import { Calendar as CalendarIcon, Filter, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Detailed Mock Data for Economic Calendar
const calendarEvents = [
    { time: '09:30', currency: 'USD', country: 'United States', event: 'Non-Farm Payrolls', actual: '275K', forecast: '200K', previous: '229K', impact: 'High', sentiment: 'Bullish' },
    { time: '10:00', currency: 'USD', country: 'United States', event: 'Unemployment Rate', actual: '3.9%', forecast: '3.7%', previous: '3.7%', impact: 'High', sentiment: 'Bearish' },
    { time: '11:00', currency: 'EUR', country: 'Euro Zone', event: 'CPI (YoY)', actual: '2.6%', forecast: '2.5%', previous: '2.8%', impact: 'High', sentiment: 'Mixed' },
    { time: '12:30', currency: 'GBP', country: 'United Kingdom', event: 'GDP Growth Rate (QoQ)', actual: '-0.3%', forecast: '-0.1%', previous: '-0.1%', impact: 'Medium', sentiment: 'Bearish' },
    { time: '14:00', currency: 'TRY', country: 'Turkey', event: 'Interest Rate Decision', actual: '45%', forecast: '45%', previous: '42.5%', impact: 'High', sentiment: 'Neutral' },
    { time: '15:30', currency: 'JPY', country: 'Japan', event: 'Industrial Production', actual: '-7.5%', forecast: '-6.8%', previous: '1.4%', impact: 'Medium', sentiment: 'Bearish' },
    { time: '16:00', currency: 'USD', country: 'United States', event: 'ISM Manufacturing PMI', actual: '47.8', forecast: '49.5', previous: '49.1', impact: 'High', sentiment: 'Bearish' },
    { time: '17:45', currency: 'NZD', country: 'New Zealand', event: 'Retail Sales (QoQ)', actual: '-1.9%', forecast: '-0.2%', previous: '-0.8%', impact: 'Medium', sentiment: 'Bearish' },
    { time: '19:00', currency: 'CAD', country: 'Canada', event: 'Ivey PMI', actual: '53.9', forecast: '55.0', previous: '56.5', impact: 'Low', sentiment: 'Bearish' },
    { time: '20:30', currency: 'AUD', country: 'Australia', event: 'Building Permits', actual: '1.3%', forecast: '0.5%', previous: '-9.5%', impact: 'Low', sentiment: 'Bullish' },
];

function ImpactBadge({ impact }: { impact: string }) {
    let colorClass = "bg-muted text-muted-foreground";
    if (impact === 'High') colorClass = "bg-destructive text-destructive-foreground font-bold";
    if (impact === 'Medium') colorClass = "bg-orange-500 text-white font-medium";
    if (impact === 'Low') colorClass = "bg-chart-2 text-white font-medium";

    return (
        <Badge className={cn("rounded-sm px-2 py-0 h-5 text-[10px] border-none shadow-none hover:opacity-90", colorClass)}>
            {impact}
        </Badge>
    );
}

function SentimentIndicator({ sentiment }: { sentiment: string }) {
    if (sentiment === 'Bullish') return <span className="text-chart-2 font-medium text-xs">Positive</span>;
    if (sentiment === 'Bearish') return <span className="text-destructive font-medium text-xs">Negative</span>;
    return <span className="text-muted-foreground text-xs">Neutral</span>;
}


interface CalendarViewProps {
    isWidget?: boolean;
}

export function CalendarView({ isWidget = false }: CalendarViewProps) {
    if (isWidget) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 shrink-0">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <CalendarIcon size={16} /> Calendar
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Filter size={14} /></Button>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    {calendarEvents.slice(0, 8).map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-4 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-mono text-muted-foreground">{item.time} • {item.currency}</span>
                                <span className="text-xs font-medium truncate max-w-[140px]">{item.event}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">{item.actual}</span>
                                <ImpactBadge impact={item.impact} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header Section */}
            <div className="flex flex-col border-b border-border bg-background p-6 gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                            <CalendarIcon className="h-8 w-8 text-primary" /> Economic Calendar
                        </h1>
                        <p className="text-muted-foreground">Key global economic events and indicators.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-secondary/50 rounded-md p-1 border border-border">
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground">Yesterday</Button>
                            <Button variant="secondary" size="sm" className="h-8 text-xs font-medium shadow-sm">Today</Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground">Tomorrow</Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-foreground">This Week</Button>
                        </div>
                        <Select className="w-[140px] h-10 bg-background border-border">
                            <option>GMT +3 (Istanbul)</option>
                            <option>GMT +0 (London)</option>
                            <option>GMT -5 (New York)</option>
                        </Select>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button variant="outline" size="sm" className="h-9 gap-2 border-border text-muted-foreground hover:text-foreground border-dashed">
                        <Filter size={14} /> Filter
                    </Button>
                    <Select className="w-[120px] h-9 bg-secondary/30 border-border text-xs">
                        <option>All Countries</option>
                        <option>United States</option>
                        <option>Euro Zone</option>
                        <option>Turkey</option>
                    </Select>
                    <Select className="w-[120px] h-9 bg-secondary/30 border-border text-xs">
                        <option>All Impact</option>
                        <option>High Impact</option>
                        <option>Medium Impact</option>
                        <option>Low Impact</option>
                    </Select>
                    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock size={14} />
                        <span>Next update in 04:32</span>
                    </div>
                </div>
            </div>

            {/* Calendar Data Table */}
            <div className="flex-1 overflow-auto bg-background p-6 pt-0">
                <Card className="bg-card border-border overflow-hidden rounded-md mt-6 shadow-sm">
                    <Table>
                        <TableHeader className="bg-secondary/40">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="w-[100px] font-semibold text-xs text-muted-foreground">Time</TableHead>
                                <TableHead className="w-[80px] font-semibold text-xs text-muted-foreground text-center">Country</TableHead>
                                <TableHead className="font-semibold text-xs text-muted-foreground">Event</TableHead>
                                <TableHead className="text-center font-semibold text-xs text-muted-foreground w-[100px]">Impact</TableHead>
                                <TableHead className="text-right font-semibold text-xs text-muted-foreground w-[100px]">Actual</TableHead>
                                <TableHead className="text-right font-semibold text-xs text-muted-foreground w-[100px]">Forecast</TableHead>
                                <TableHead className="text-right font-semibold text-xs text-muted-foreground w-[100px]">Previous</TableHead>
                                <TableHead className="text-right font-semibold text-xs text-muted-foreground pr-6 w-[120px]">Sentiment</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calendarEvents.map((item, i) => (
                                <TableRow key={i} className="border-border hover:bg-muted/30 transition-colors group h-14">
                                    <TableCell className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors border-r border-border/40">
                                        {item.time}
                                    </TableCell>
                                    <TableCell className="text-center border-r border-border/40">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="font-bold text-xs">{item.currency}</span>
                                            {/* Flag placeholder or icon could go here */}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-sm py-3 border-r border-border/40">
                                        <div className="flex flex-col">
                                            <span className="group-hover:text-primary transition-colors">{item.event}</span>
                                            <span className="text-xs text-muted-foreground font-normal">{item.country}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center border-r border-border/40">
                                        <div className="flex justify-center">
                                            <ImpactBadge impact={item.impact} />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm font-bold border-r border-border/40">
                                        {item.actual}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-muted-foreground border-r border-border/40">
                                        {item.forecast}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-muted-foreground border-r border-border/40">
                                        {item.previous}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <SentimentIndicator sentiment={item.sentiment} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
}
