'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper, Search, Share2, Bookmark, Clock, ExternalLink, Zap, TrendingUp, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select-native';

// Mock News Data
const newsItems = [
    { id: 1, source: 'Bloomberg', time: '2m ago', title: 'Fed Signals Potential Rate Cuts Later This Year as Inflation Cools', summary: 'Federal Reserve officials signaled they are getting closer to cutting interest rates, though they want to see more evidence that inflation is moving sustainably toward their 2% target.', sentiment: 'Positive', related: ['USD', 'SPX'] },
    { id: 2, source: 'Reuters', time: '15m ago', title: 'Bitcoin Surges Past $65,000 as ETF Inflows Accelerate', summary: 'The world\'s largest cryptocurrency extended its rally, driven by massive inflows into spot Bitcoin ETFs and anticipation of the upcoming halving event.', sentiment: 'Positive', related: ['BTC', 'COIN'] },
    { id: 3, source: 'CNBC', time: '32m ago', title: 'Tesla Shares Slide on Report of Berlin Factory Outage', summary: 'Production at Tesla\'s Gigafactory near Berlin has been halted due to a suspected arson attack on a nearby power pylon, causing a power outage at the plant.', sentiment: 'Negative', related: ['TSLA'] },
    { id: 4, source: 'Financial Times', time: '1h ago', title: 'ECB Leaves Rates Unchanged, Lowers Inflation Forecasts', summary: ' The European Central Bank kept borrowing costs at record highs but acknowledged that inflammation is falling faster than expected, opening the door for cuts in June.', sentiment: 'Neutral', related: ['EUR', 'DAX'] },
    { id: 5, source: 'Wall Street Journal', time: '2h ago', title: 'Apple fined €1.8bn by EU for Antitrust Violations', summary: 'Brussels has hit the iPhone maker with a massive fine for stifling competition from rival music streaming services on its App Store.', sentiment: 'Negative', related: ['AAPL'] },
    { id: 6, source: 'TechCrunch', time: '3h ago', title: 'Anthropic Releases Claude 3, Claims Performance Beats GPT-4', summary: 'The AI startup backed by Amazon and Google has released its most powerful models yet, claiming they outperform OpenAI\'s GPT-4 on a range of benchmarks.', sentiment: 'Positive', related: ['GOOGL', 'AMZN'] },
    { id: 7, source: 'CoinDesk', time: '4h ago', title: 'Ethereum Usage Spikes Ahead of Dencun Upgrade', summary: 'Activity on the Ethereum network has reached levels not seen since 2022 as users anticipate the upcoming Dencun upgrade which promises to lower fees.', sentiment: 'Positive', related: ['ETH'] },
    { id: 8, source: 'Yahoo Finance', time: '5h ago', title: 'Oil Prices Hold Steady Amid OPEC+ Cut Extensions', summary: 'Crude oil futures showed little movement after major producers agreed to extend voluntary supply cuts into the second quarter of the year.', sentiment: 'Neutral', related: ['CL=F'] },
];


interface NewsViewProps {
    isWidget?: boolean;
}

export function NewsView({ isWidget = false }: NewsViewProps) {
    const [selectedNews, setSelectedNews] = useState<number | null>(null);

    if (isWidget) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 shrink-0">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <Zap size={16} /> News
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Filter size={14} /></Button>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    {newsItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex flex-col py-2 px-4 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0 gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground font-mono">{item.time}</span>
                                <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">{item.source}</span>
                            </div>
                            <span className="text-xs font-medium line-clamp-2 leading-tight">{item.title}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-background overflow-hidden">
            {/* Feed Column */}
            <div className={cn("flex flex-col border-r border-border bg-background transition-all duration-300", selectedNews ? "w-[450px]" : "w-full max-w-4xl mx-auto")}>
                {/* Header */}
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <Zap className="text-chart-4 fill-chart-4" size={20} /> Real-time Feed
                        </h1>
                        <div className="flex items-center gap-2">
                            <Select className="w-[120px] h-8 text-xs bg-secondary/50 border-0">
                                <option>Top Stories</option>
                                <option>Crypto</option>
                                <option>Forex</option>
                                <option>Stocks</option>
                            </Select>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search headlines, tickers..." className="pl-9 bg-secondary/30 border-border" />
                    </div>
                </div>

                {/* News List */}
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                        {newsItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => setSelectedNews(item.id)}
                                className={cn(
                                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors group relative",
                                    selectedNews === item.id ? "bg-muted/50 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] h-5 px-1 border-border text-primary bg-primary/10">
                                            {item.source}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock size={10} /> {item.time}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {item.related.map(ticker => (
                                            <span key={ticker} className="text-[10px] font-mono text-muted-foreground bg-secondary px-1 rounded hover:text-foreground">
                                                {ticker}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <h3 className={cn("text-base font-bold leading-tight mb-2 group-hover:text-primary transition-colors", selectedNews === item.id ? "text-primary" : "text-foreground")}>
                                    {item.title}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {item.summary}
                                </p>

                                <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"><Share2 size={12} /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"><Bookmark size={12} /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Reading Pane (Conditional) */}
            {selectedNews && (
                <div className="flex-1 bg-card border-l border-border h-full overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setSelectedNews(null)} className="gap-2">
                            Close
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-2"><ExternalLink size={14} /> Open Source</Button>
                            <Button variant="default" size="sm">Trade this news</Button>
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-8">
                        <article className="prose dark:prose-invert max-w-none">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-sm text-muted-foreground">{newsItems.find(n => n.id === selectedNews)?.source}</span>
                                <span className="h-1 w-1 rounded-full bg-border"></span>
                                <span className="text-sm text-muted-foreground">{newsItems.find(n => n.id === selectedNews)?.time}</span>
                            </div>
                            <h1 className="text-4xl font-extrabold mb-6 leading-tight tracking-tight">
                                {newsItems.find(n => n.id === selectedNews)?.title}
                            </h1>
                            <div className="p-4 bg-secondary/30 rounded-lg border-l-4 border-primary mb-8 italic text-lg text-muted-foreground">
                                {newsItems.find(n => n.id === selectedNews)?.summary}
                            </div>
                            <p className="text-lg leading-relaxed text-foreground/90">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>
                            <p className="text-lg leading-relaxed text-foreground/90 mt-4">
                                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                            </p>
                            <div className="my-8 p-6 border border-border rounded-xl bg-background">
                                <h4 className="font-bold flex items-center gap-2 mb-4">
                                    <TrendingUp size={20} className="text-chart-2" /> Market Impact
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-secondary/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground mb-1">Affected Asset</div>
                                        <div className="font-bold text-lg">BTC/USD</div>
                                    </div>
                                    <div className="p-4 bg-secondary/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground mb-1">Projected Volatility</div>
                                        <div className="font-bold text-lg text-chart-4">High</div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
}
