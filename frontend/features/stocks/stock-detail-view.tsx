'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpRight, ArrowDownRight, Activity, Loader2 } from 'lucide-react';
import { fetchPrices } from '@/services/price.service';
import { fetchNews } from '@/services/news.service';
import type { NewsItem } from '@/types/news';

function relativeTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function StockDetailView({ ticker }: { ticker: string }) {
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [newsLoading, setNewsLoading] = useState(false);

    const priceQuery = useQuery({
        queryKey: ['stock-detail-price', ticker],
        queryFn: () => fetchPrices({ ticker, timeframe: '1d', limit: 2 }),
        staleTime: 60_000,
    });

    const bars = priceQuery.data?.data ?? [];
    const lastBar = bars.at(-1) ?? null;
    const prevBar = bars.length >= 2 ? bars[bars.length - 2] : null;
    const price = lastBar?.c ?? null;
    const change = lastBar && prevBar ? lastBar.c - prevBar.c : null;
    const changePercent = change !== null && prevBar ? (change / prevBar.c) * 100 : null;
    const priceLoading = priceQuery.isLoading;

    function loadNews() {
        if (newsLoading || newsItems.length > 0) return;
        setNewsLoading(true);
        fetchNews({ symbol: ticker, limit: 10 })
            .then(res => setNewsItems(res.items))
            .catch(() => setNewsItems([]))
            .finally(() => setNewsLoading(false));
    }

    const isPositive = (changePercent ?? 0) >= 0;

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-bold tracking-tight">{ticker}</h1>
                    </div>
                </div>
                <div className="text-right">
                    {priceLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                        <>
                            <div className="text-4xl font-bold">
                                {price !== null ? price.toFixed(2) : '—'}
                            </div>
                            {changePercent !== null && (
                                <div className={`flex items-center justify-end gap-2 text-lg font-medium ${isPositive ? 'text-chart-2' : 'text-destructive'}`}>
                                    {isPositive ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                                    {change !== null ? (change > 0 ? '+' : '') + change.toFixed(2) : ''}
                                    {' '}({changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="chart" className="w-full" onValueChange={(v) => { if (v === 'news') loadNews(); }}>
                <TabsList className="bg-muted w-full justify-start h-12 p-1">
                    <TabsTrigger value="chart" className="h-full px-6">Chart</TabsTrigger>
                    <TabsTrigger value="financials" className="h-full px-6">Financials</TabsTrigger>
                    <TabsTrigger value="news" className="h-full px-6">News</TabsTrigger>
                    <TabsTrigger value="analysis" className="h-full px-6 text-primary">AI Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="mt-6">
                    <Card className="p-6 h-[500px] flex items-center justify-center bg-card border-border">
                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                            <Activity size={48} />
                            <span>Chart coming soon</span>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="financials" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['Market Cap', 'P/E Ratio', 'Dividend Yield', 'EPS'].map(metric => (
                            <Card key={metric} className="p-6 bg-card border-border">
                                <div className="text-sm text-muted-foreground mb-1">{metric}</div>
                                <div className="text-2xl font-bold">---</div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="news" className="mt-6">
                    <div className="space-y-3">
                        {newsLoading && (
                            <p className="text-sm text-muted-foreground">Loading news...</p>
                        )}
                        {!newsLoading && newsItems.length === 0 && (
                            <p className="text-sm text-muted-foreground">No news found.</p>
                        )}
                        {newsItems.map(item => (
                            <Card key={item.id} className="p-4 bg-card border-border">
                                <p className="text-sm font-medium">{item.title}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                                    <span>{item.news_source ?? '—'}</span>
                                    <span>·</span>
                                    <span>{relativeTime(item.published_at)}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
