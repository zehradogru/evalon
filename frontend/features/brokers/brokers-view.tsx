'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ExternalLink, Shield, BarChart2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Market = 'BIST' | 'US' | 'Crypto' | 'Forex' | 'EU';

interface Broker {
    id: string;
    name: string;
    rating: number;
    tags: string[];
    description: string;
    link: string;
    popular: boolean;
    country: string;
    countryFlag: string;
    markets: Market[];
    commission: string;
    minDeposit: string;
    mobile: boolean;
    regulated: boolean;
    features: string[];
}

const brokers: Broker[] = [
    {
        id: 'midas',
        name: 'Midas',
        rating: 4.5,
        tags: ['BIST', 'US Stocks', 'Zero Commission', 'Crypto'],
        description: 'Turkish fintech app with zero-commission BIST trading, US stocks at $1.5/trade, crypto, TEFAS funds, fractional shares, and AI-powered news summaries. SPK licensed, MKK & SIPC protected.',
        link: 'https://www.getmidas.com/',
        popular: true,
        country: 'Turkey',
        countryFlag: '🇹🇷',
        markets: ['BIST', 'US', 'Crypto'],
        commission: '$1.5 US / Free BIST',
        minDeposit: '₺0',
        mobile: true,
        regulated: true,
        features: ['Zero Commission BIST', 'Fractional Shares', 'Options Trading', 'Crypto', 'TEFAS Funds', 'AI News', 'SIPC Protected', '7/24 Support'],
    },
    {
        id: 'is-yatirim',
        name: 'İş Yatırım',
        rating: 4.4,
        tags: ['BIST', 'Futures', 'Professional'],
        description: "Turkey's largest and most trusted investment platform, backed by İşbank with full SPK regulation.",
        link: 'https://isyatirim.com.tr',
        popular: true,
        country: 'Turkey',
        countryFlag: '🇹🇷',
        markets: ['BIST', 'Forex'],
        commission: '0.10%',
        minDeposit: '₺1,000',
        mobile: true,
        regulated: true,
        features: ['SPK Regulated', 'Futures & Options', 'Research Reports', 'API Access'],
    },
    {
        id: 'garanti-yatirim',
        name: 'Garanti Yatırım',
        rating: 4.3,
        tags: ['BIST', 'Bonds', 'Banking Integration'],
        description: 'Integrated investment services from Garanti BBVA, offering stocks, bonds, and funds with full banking integration.',
        link: 'https://garantiyatirim.com.tr',
        popular: false,
        country: 'Turkey',
        countryFlag: '🇹🇷',
        markets: ['BIST', 'Forex'],
        commission: '0.12%',
        minDeposit: '₺500',
        mobile: true,
        regulated: true,
        features: ['Banking Integration', 'Mutual Funds', 'Fixed Income', 'SPK Regulated'],
    },
    {
        id: 'gedik',
        name: 'Gedik Yatırım',
        rating: 4.2,
        tags: ['BIST', 'Derivatives', 'Research'],
        description: 'Established Turkish brokerage with strong derivatives trading capabilities and in-depth market research.',
        link: 'https://gedik.com',
        popular: false,
        country: 'Turkey',
        countryFlag: '🇹🇷',
        markets: ['BIST', 'Forex'],
        commission: '0.09%',
        minDeposit: '₺2,000',
        mobile: true,
        regulated: true,
        features: ['SPK Regulated', 'Derivatives', 'Research', 'Algo Trading'],
    },
    {
        id: 'ak-yatirim',
        name: 'Ak Yatırım',
        rating: 4.3,
        tags: ['BIST', 'Eurobonds', 'Banking'],
        description: "Akbank's investment arm providing stocks, funds, eurobonds, and structured products with premium banking support.",
        link: 'https://akyatirim.com.tr',
        popular: false,
        country: 'Turkey',
        countryFlag: '🇹🇷',
        markets: ['BIST', 'Forex'],
        commission: '0.11%',
        minDeposit: '₺1,000',
        mobile: true,
        regulated: true,
        features: ['Banking Integration', 'Eurobonds', 'Structured Products', 'SPK Regulated'],
    },
    {
        id: 'interactive-brokers',
        name: 'Interactive Brokers',
        rating: 4.8,
        tags: ['Global', 'Low Fees', 'Pro Tools'],
        description: 'Best for professional traders requiring access to global markets, advanced order types, and institutional-grade tools.',
        link: 'https://interactivebrokers.com',
        popular: true,
        country: 'USA',
        countryFlag: '🇺🇸',
        markets: ['US', 'EU', 'Forex'],
        commission: '$0.005/share',
        minDeposit: '$0',
        mobile: true,
        regulated: true,
        features: ['Global Markets', 'Options & Futures', 'Algo Trading', 'API Access', 'Margin Trading'],
    },
    {
        id: 'binance',
        name: 'Binance',
        rating: 4.6,
        tags: ['Crypto', 'High Volume', 'Staking'],
        description: "World's largest cryptocurrency exchange by volume, offering spot, futures, staking, and a wide range of DeFi products.",
        link: 'https://binance.com',
        popular: true,
        country: 'Global',
        countryFlag: '🌐',
        markets: ['Crypto'],
        commission: '0.10%',
        minDeposit: '$10',
        mobile: true,
        regulated: false,
        features: ['700+ Coins', 'Staking', 'Futures', 'P2P Trading', 'Web3 Wallet'],
    },
    {
        id: 'etoro',
        name: 'eToro',
        rating: 4.3,
        tags: ['Social Trading', 'Copy Trade', 'Beginner'],
        description: 'Social investment platform with copy trading, perfect for beginners who want to follow expert investors automatically.',
        link: 'https://etoro.com',
        popular: false,
        country: 'Global',
        countryFlag: '🌐',
        markets: ['US', 'Crypto', 'Forex'],
        commission: 'Spread',
        minDeposit: '$50',
        mobile: true,
        regulated: true,
        features: ['Copy Trading', 'Social Feed', 'Virtual Portfolio', 'Crypto & Stocks'],
    },
];

const MARKET_FILTERS: { label: string; value: Market | 'All' }[] = [
    { label: 'All', value: 'All' },
    { label: 'BIST', value: 'BIST' },
    { label: 'US Stocks', value: 'US' },
    { label: 'Crypto', value: 'Crypto' },
    { label: 'Forex', value: 'Forex' },
];

const MARKET_COLORS: Record<Market, string> = {
    BIST: 'bg-red-500/10 text-red-400 border-red-500/20',
    US: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Crypto: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Forex: 'bg-green-500/10 text-green-400 border-green-500/20',
    EU: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export function BrokersView() {
    const [activeMarket, setActiveMarket] = useState<Market | 'All'>('All');
    const [showComparison, setShowComparison] = useState(false);
    const [compareIds, setCompareIds] = useState<string[]>([]);

    const filtered = useMemo(() => {
        if (activeMarket === 'All') return brokers;
        return brokers.filter(b => b.markets.includes(activeMarket));
    }, [activeMarket]);

    const toggleCompare = (id: string) => {
        setCompareIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : prev.length < 3
                    ? [...prev, id]
                    : prev
        );
    };

    const compareBrokers = brokers.filter(b => compareIds.includes(b.id));

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Brokers & Platforms</h1>
                <p className="text-muted-foreground">Compare and connect to the right brokerage for your investment style.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Listed Brokers', value: String(brokers.length) },
                    { label: 'Turkish Brokers', value: String(brokers.filter(b => b.country === 'Turkey').length) },
                    { label: 'SPK Regulated', value: String(brokers.filter(b => b.regulated && b.country === 'Turkey').length) },
                    { label: 'Zero Commission', value: String(brokers.filter(b => b.commission === 'Free').length) },
                ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
                {MARKET_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setActiveMarket(f.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                            activeMarket === f.value
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
                <div className="ml-auto">
                    <button
                        onClick={() => setShowComparison(s => !s)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                            showComparison
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
                        )}
                    >
                        <BarChart2 size={14} />
                        Compare
                        {compareIds.length > 0 && (
                            <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                                {compareIds.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Comparison table */}
            {showComparison && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {compareIds.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            Select up to <strong className="text-foreground">3 brokers</strong> using the <strong className="text-foreground">+ Compare</strong> button on each card.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left p-4 text-muted-foreground font-medium w-40">Feature</th>
                                        {compareBrokers.map(b => (
                                            <th key={b.id} className="text-center p-4 font-bold text-foreground">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span>{b.countryFlag} {b.name}</span>
                                                    <div className="flex items-center gap-0.5">
                                                        <Star size={10} className="text-chart-4 fill-chart-4" />
                                                        <span className="text-xs font-medium text-muted-foreground">{b.rating}</span>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 text-muted-foreground">Markets</td>
                                        {compareBrokers.map(b => (
                                            <td key={b.id} className="p-4 text-center">
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {b.markets.map(m => (
                                                        <span key={m} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', MARKET_COLORS[m])}>
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 text-muted-foreground">Commission</td>
                                        {compareBrokers.map(b => (
                                            <td key={b.id} className="p-4 text-center font-semibold">
                                                <span className={b.commission === 'Free' ? 'text-emerald-400' : 'text-foreground'}>
                                                    {b.commission}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 text-muted-foreground">Min. Deposit</td>
                                        {compareBrokers.map(b => (
                                            <td key={b.id} className="p-4 text-center font-semibold text-foreground">{b.minDeposit}</td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="p-4 text-muted-foreground">Regulated</td>
                                        {compareBrokers.map(b => (
                                            <td key={b.id} className="p-4 text-center">
                                                {b.regulated
                                                    ? <Check size={16} className="text-emerald-400 mx-auto" />
                                                    : <span className="text-muted-foreground/40 text-xs">—</span>
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="p-4 text-muted-foreground">Mobile App</td>
                                        {compareBrokers.map(b => (
                                            <td key={b.id} className="p-4 text-center">
                                                {b.mobile
                                                    ? <Check size={16} className="text-emerald-400 mx-auto" />
                                                    : <span className="text-muted-foreground/40 text-xs">—</span>
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Broker cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((broker) => {
                    const isComparing = compareIds.includes(broker.id);
                    return (
                        <Card
                            key={broker.id}
                            className={cn(
                                'flex flex-col gap-4 p-5 border-border transition-all bg-card relative overflow-hidden',
                                isComparing ? 'border-primary/50 ring-1 ring-primary/20' : 'hover:border-primary/30'
                            )}
                        >
                            {broker.popular && (
                                <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                    POPULAR
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center font-bold text-base text-foreground shrink-0">
                                        {broker.name[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="font-bold text-base leading-tight">{broker.name}</h3>
                                            <span className="text-sm">{broker.countryFlag}</span>
                                        </div>
                                        <div className="flex items-center gap-0.5 mt-0.5">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <Star
                                                    key={i}
                                                    size={10}
                                                    className={i <= Math.round(broker.rating) ? 'text-chart-4 fill-chart-4' : 'text-muted-foreground/30'}
                                                />
                                            ))}
                                            <span className="text-[11px] text-muted-foreground ml-0.5">{broker.rating}</span>
                                        </div>
                                    </div>
                                </div>
                                {broker.regulated && (
                                    <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-400/20 shrink-0">
                                        <Shield size={9} />
                                        Regulated
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[32px]">
                                {broker.description}
                            </p>

                            {/* Markets */}
                            <div className="flex flex-wrap gap-1.5">
                                {broker.markets.map(m => (
                                    <span
                                        key={m}
                                        className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold tracking-wide', MARKET_COLORS[m])}
                                    >
                                        {m}
                                    </span>
                                ))}
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-secondary/30 px-3 py-2">
                                    <p className="text-[10px] text-muted-foreground">Commission</p>
                                    <p className={cn('text-xs font-bold mt-0.5', broker.commission === 'Free' ? 'text-emerald-400' : 'text-foreground')}>
                                        {broker.commission}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-secondary/30 px-3 py-2">
                                    <p className="text-[10px] text-muted-foreground">Min. Deposit</p>
                                    <p className="text-xs font-bold mt-0.5 text-foreground">{broker.minDeposit}</p>
                                </div>
                            </div>

                            {/* Feature badges */}
                            <div className="flex flex-wrap gap-1">
                                {broker.features.slice(0, 3).map(f => (
                                    <Badge key={f} variant="secondary" className="text-[10px] bg-secondary/60 text-secondary-foreground">
                                        {f}
                                    </Badge>
                                ))}
                                {broker.features.length > 3 && (
                                    <Badge variant="secondary" className="text-[10px] bg-secondary/60 text-muted-foreground">
                                        +{broker.features.length - 3} more
                                    </Badge>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1 mt-auto">
                                {showComparison && (
                                    <button
                                        onClick={() => toggleCompare(broker.id)}
                                        disabled={!isComparing && compareIds.length >= 3}
                                        className={cn(
                                            'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all',
                                            isComparing
                                                ? 'bg-primary/15 text-primary border-primary/30'
                                                : compareIds.length >= 3
                                                    ? 'opacity-40 cursor-not-allowed text-muted-foreground border-border'
                                                    : 'text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
                                        )}
                                    >
                                        {isComparing ? '✓ Comparing' : '+ Compare'}
                                    </button>
                                )}
                                <Button
                                    className={cn('gap-2 text-xs', showComparison ? 'flex-1' : 'w-full')}
                                    variant="outline"
                                    asChild
                                >
                                    <a href={broker.link} target="_blank" rel="noopener noreferrer">
                                        Visit <ExternalLink size={12} />
                                    </a>
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-muted-foreground/50 text-center pt-4 border-t border-border/50">
                Evalonn does not endorse any specific broker. Ratings and data are for informational purposes only. Always verify regulatory status before investing.
            </p>
        </div>
    );
}
