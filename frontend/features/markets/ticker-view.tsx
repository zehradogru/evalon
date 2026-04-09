'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Loader2, Maximize2, RefreshCw, TrendingUp, TrendingDown, Clock, ArrowUp, ArrowDown, BarChart3, Calendar, Star, Bell, Share2, AlertCircle, LineChart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrices } from '@/hooks/use-prices';
import { useAuthStore } from '@/store/use-auth-store';
import {
    useAddWatchlistTicker,
    useRemoveWatchlistTicker,
    useUserWatchlist,
} from '@/hooks/use-user-watchlist';
import { cn } from '@/lib/utils';
import { TICKER_NAMES } from '@/config/markets';
import type { Timeframe } from '@/types';

interface TickerViewProps {
    ticker: string;
}

// Timeframes with optimized limits
const TIMEFRAMES: { label: string; value: Timeframe; limit: number }[] = [
    { label: '1M', value: '1m', limit: 300 },   // ~1 trading day
    { label: '5M', value: '5m', limit: 150 },   // ~3 trading days
    { label: '1H', value: '1h', limit: 100 },   // ~12.5 trading days
    { label: '1D', value: '1d', limit: 50 },    // ~2 months of daily data
    { label: '1W', value: '1w', limit: 52 },    // 1 year of weekly data
];

const getTimeframeLimit = (tf: Timeframe): number => {
    const config = TIMEFRAMES.find(t => t.value === tf);
    return config?.limit || 100;
};

const getPeriodLabel = (tf: Timeframe): string => {
    switch (tf) {
        case '1d': case '1w': return 'Period';
        case '1h': return 'Weekly';
        case '5m': case '1m': return 'Daily';
        default: return 'Period';
    }
};

const formatYAxisTick = (value: number): string => value.toFixed(2);

const getYAxisWidth = (domain: [number, number] | ['auto', 'auto']): number => {
    if (!Array.isArray(domain) || typeof domain[0] !== 'number' || typeof domain[1] !== 'number') {
        return 64;
    }

    const [min, max] = domain;
    const samples = [min, max, (min + max) / 2, 0].map((value) => formatYAxisTick(value));
    const longest = samples.reduce((acc, label) => Math.max(acc, label.length), 0);
    const estimatedWidth = Math.ceil(longest * 8 + 16);

    return Math.min(96, Math.max(56, estimatedWidth));
};

export function TickerView({ ticker }: TickerViewProps) {
    const [timeframe, setTimeframe] = useState<Timeframe>('1d');
    const { isAuthenticated } = useAuthStore();
    const { data: userWatchlist } = useUserWatchlist();
    const addTickerMutation = useAddWatchlistTicker();
    const removeTickerMutation = useRemoveWatchlistTicker();
    const isWatchlistMutating =
        addTickerMutation.isPending || removeTickerMutation.isPending;
    const isInWatchlist =
        userWatchlist?.tickers.includes(ticker.toUpperCase()) ?? false;

    const handleToggleWatchlist = async () => {
        if (!isAuthenticated) {
            return;
        }

        if (isInWatchlist) {
            await removeTickerMutation.mutateAsync(ticker);
            return;
        }

        await addTickerMutation.mutateAsync(ticker);
    };

    // Header data: always fetch daily (last 2 bars) for consistent price/change display
    const { data: dailyData } = usePrices(ticker, '1d', 2);

    // Chart data: fetch based on selected timeframe
    const { data: chartPriceData, isLoading, error, refetch } = usePrices(
        ticker,
        timeframe,
        getTimeframeLimit(timeframe)
    );

    const data = useMemo(() => chartPriceData?.data ?? [], [chartPriceData]);

    // Header stats: always based on daily data (independent of timeframe)
    const headerStats = useMemo(() => {
        const dailyBars = dailyData?.data || [];
        if (dailyBars.length === 0) return null;

        const currentBar = dailyBars[dailyBars.length - 1];
        const previousBar = dailyBars.length > 1 ? dailyBars[dailyBars.length - 2] : null;

        const price = currentBar.c;
        const change = previousBar ? currentBar.c - previousBar.c : 0;
        const changePct = previousBar && previousBar.c !== 0 ? (change / previousBar.c) * 100 : 0;
        const isPositive = change >= 0;

        // Check staleness
        const lastBarDate = new Date(currentBar.t);
        const currentTimestamp = new Date().getTime();
        const daysSinceUpdate = Math.floor((currentTimestamp - lastBarDate.getTime()) / (1000 * 60 * 60 * 24));
        const isStale = daysSinceUpdate > 5;

        return { price, change, changePct, isPositive, lastBarDate, isStale, daysSinceUpdate };
    }, [dailyData]);

    // Chart stats: period high/low/vol from chart data
    const chartStats = useMemo(() => {
        if (!data || data.length === 0) return null;

        const periodHigh = Math.max(...data.map(d => d.h));
        const periodLow = Math.min(...data.map(d => d.l));
        const lastBar = data[data.length - 1];

        return { high: periodHigh, low: periodLow, vol: lastBar.v };
    }, [data]);

    // Dynamic Y-axis domain with safe minimum padding for narrow/single-value ranges
    const yDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
        if (!data || data.length === 0) return ['auto', 'auto'];
        const prices = data.flatMap(d => [d.c, d.h, d.l]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const valueBasedMinPadding = Math.max(Math.max(Math.abs(min), Math.abs(max), 1) * 0.01, 0.01);
        const padding = Math.max(range * 0.05, valueBasedMinPadding);

        let lower = min - padding;
        let upper = max + padding;

        if (upper - lower < 0.02) {
            const center = (min + max) / 2;
            lower = center - 0.01;
            upper = center + 0.01;
        }

        return [
            Math.floor(lower * 100) / 100,
            Math.ceil(upper * 100) / 100
        ];
    }, [data]);

    const yAxisWidth = useMemo(() => getYAxisWidth(yDomain), [yDomain]);

    // Format X axis labels based on timeframe
    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m' || timeframe === '1h') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (timeframe === '1M') {
            return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Format Tooltip date
    const formatTooltipDate = (label: string) => {
        const date = new Date(label);
        if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m' || timeframe === '1h') {
            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const periodLabel = getPeriodLabel(timeframe);

    return (
        <div className="flex flex-col w-full min-h-screen bg-background text-foreground animate-in fade-in duration-500">
            {/* Top Navigation Bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <Link href="/markets" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-bold text-primary shadow-sm border border-primary/10">
                        {ticker.slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight leading-tight">{ticker}</h1>
                            {headerStats?.isStale && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] px-1.5 py-0">
                                    <Clock size={10} className="mr-1" />
                                    {headerStats.daysSinceUpdate}d ago
                                </Badge>
                            )}
                        </div>
                        <span className="text-sm text-muted-foreground">{TICKER_NAMES[ticker] || 'Borsa Istanbul'}</span>
                    </div>
                </div>

                {headerStats && (
                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold tracking-tight font-mono">{headerStats.price.toFixed(2)}</span>
                                <span className="text-sm text-muted-foreground">TRY</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 text-sm font-semibold px-2 py-0.5 rounded-md",
                                headerStats.isPositive 
                                    ? "text-chart-2 bg-chart-2/10" 
                                    : "text-destructive bg-destructive/10"
                            )}>
                                {headerStats.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {headerStats.isPositive ? '+' : ''}{headerStats.change.toFixed(2)} ({headerStats.isPositive ? '+' : ''}{headerStats.changePct.toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-4 bg-card/50 border border-border/50 rounded-xl flex items-start gap-3 group hover:bg-card/80 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                            <ArrowUp size={16} className="text-chart-2" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-muted-foreground">{periodLabel} High</span>
                            <span className="text-lg font-semibold font-mono truncate">{chartStats?.high?.toFixed(2) || '—'}</span>
                        </div>
                    </Card>
                    <Card className="p-4 bg-card/50 border border-border/50 rounded-xl flex items-start gap-3 group hover:bg-card/80 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                            <ArrowDown size={16} className="text-destructive" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-muted-foreground">{periodLabel} Low</span>
                            <span className="text-lg font-semibold font-mono truncate">{chartStats?.low?.toFixed(2) || '—'}</span>
                        </div>
                    </Card>
                    <Card className="p-4 bg-card/50 border border-border/50 rounded-xl flex items-start gap-3 group hover:bg-card/80 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <BarChart3 size={16} className="text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-muted-foreground">Volume</span>
                            <span className="text-lg font-semibold truncate">{chartStats?.vol?.toLocaleString('tr-TR') || '—'}</span>
                        </div>
                    </Card>
                    <Card className="p-4 bg-card/50 border border-border/50 rounded-xl flex items-start gap-3 group hover:bg-card/80 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Calendar size={16} className="text-muted-foreground" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-muted-foreground">Periyot</span>
                            <span className="text-lg font-semibold uppercase">{timeframe}</span>
                        </div>
                    </Card>
                </div>

                {/* Stale Data Warning */}
                {headerStats?.isStale && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
                        <Clock size={16} className="text-amber-500 flex-shrink-0" />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                            <span className="text-amber-400 font-medium">Veriler guncel degil</span>
                            <span className="text-muted-foreground">
                                Son guncelleme: {headerStats.lastBarDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                )}

                {/* Chart Section */}
                <Card className="flex-1 p-1 bg-card border-border rounded-xl shadow-sm min-h-[500px] flex flex-col relative overflow-hidden">
                    {/* Chart Controls */}
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                            <TabsList className="bg-secondary/50 p-1">
                                {TIMEFRAMES.map((tf) => (
                                    <TabsTrigger
                                        key={tf.value}
                                        value={tf.value}
                                        className="text-xs px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                                    >
                                        {tf.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-1">
                            {/* Action Buttons */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'h-8 px-2 hover:bg-amber-500/10 disabled:opacity-50',
                                    isInWatchlist
                                        ? 'text-amber-500'
                                        : 'text-muted-foreground hover:text-amber-500'
                                )}
                                onClick={() => {
                                    void handleToggleWatchlist();
                                }}
                                disabled={!isAuthenticated || isWatchlistMutating}
                                title={
                                    isAuthenticated
                                        ? isInWatchlist
                                            ? 'Watchlistten cikar'
                                            : 'Watchliste ekle'
                                        : 'Watchlist icin giris gerekli'
                                }
                            >
                                <Star
                                    size={16}
                                    fill={isInWatchlist ? 'currentColor' : 'none'}
                                />
                                <span className="ml-1.5 text-xs hidden sm:inline">
                                    {isInWatchlist ? 'Added' : 'Watchlist'}
                                </span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                                disabled
                                title="Yakinda aktif olacak"
                            >
                                <Bell size={16} />
                                <span className="ml-1.5 text-xs hidden sm:inline">Alert</span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                                disabled
                                title="Yakinda aktif olacak"
                            >
                                <Share2 size={16} />
                                <span className="ml-1.5 text-xs hidden sm:inline">Paylas</span>
                            </Button>

                            <div className="w-px h-5 bg-border mx-1" />

                            {/* Chart Tools */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => refetch()}
                                disabled={isLoading}
                                title="Yenile"
                            >
                                <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
                            </Button>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground disabled:opacity-50" 
                                disabled
                                title="Tam ekran - Yakinda"
                            >
                                <Maximize2 size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 w-full h-full relative p-4 min-h-[400px]">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 transition-all duration-300">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
                                        <Loader2 className="absolute inset-0 m-auto w-6 h-6 animate-spin text-primary" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm font-medium">Grafik yukleniyor</span>
                                        <span className="text-xs text-muted-foreground">{ticker} - {timeframe.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3 max-w-xs text-center">
                                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                        <AlertCircle className="w-6 h-6 text-destructive" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">Veri yuklenemedi</span>
                                        <span className="text-xs text-muted-foreground">Lutfen daha sonra tekrar deneyin veya farkli bir periyot secin</span>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                                        <RefreshCw size={14} className="mr-1.5" />
                                        Tekrar Dene
                                    </Button>
                                </div>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3 max-w-xs text-center">
                                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                                        <LineChart className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">Veri bulunamadi</span>
                                        <span className="text-xs text-muted-foreground">Bu periyot icin {ticker} verisi mevcut degil</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={400} className="min-h-[400px]">
                                <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPricePos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorPriceNeg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333333" opacity={0.4} />
                                    <XAxis
                                        dataKey="t"
                                        tickFormatter={formatXAxis}
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        domain={yDomain}
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        width={yAxisWidth}
                                        tickFormatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            backgroundColor: '#111111',
                                            borderColor: '#333333',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                                        }}
                                        itemStyle={{ color: '#ffffff' }}
                                        labelStyle={{ color: '#888888', marginBottom: '4px' }}
                                        labelFormatter={(label) => formatTooltipDate(String(label))}
                                        formatter={(value, name) => [
                                            typeof value === 'number' ? value.toFixed(2) : String(value ?? ''),
                                            name === 'c' ? 'Price' : String(name ?? '')
                                        ]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="c"
                                        stroke={headerStats?.isPositive ? "#22c55e" : "#ef4444"}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill={headerStats?.isPositive ? "url(#colorPricePos)" : "url(#colorPriceNeg)"}
                                        animationDuration={500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
