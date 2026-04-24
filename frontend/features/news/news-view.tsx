'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Share2, Bookmark, Clock, ExternalLink, Zap, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select-native';
import { fetchNews } from '@/services/news.service';
import type { NewsItem } from '@/types/news';

const PAGE_SIZE = 10;

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function mapSentiment(s: string | null): string {
    if (!s) return 'Neutral';
    const u = s.toUpperCase();
    if (u === 'OLUMLU') return 'Olumlu';
    if (u === 'OLUMSUZ') return 'Olumsuz';
    if (u === 'NÖTR' || u === 'NOTR') return 'Neutral';
    if (u === 'BEKLIYOR') return 'Bekleniyor';
    return s;
}




interface NewsViewProps {
    isWidget?: boolean;
}

export function NewsView({ isWidget = false }: NewsViewProps) {
    const [selectedNews, setSelectedNews] = useState<number | null>(null);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Reset + fetch first page when searchQ changes
    useEffect(() => {
        setLoading(true);
        setError(null);
        setNewsItems([]);
        setPage(1);
        setHasMore(true);
        fetchNews({ limit: PAGE_SIZE, page: 1, q: searchQ || undefined })
            .then(res => {
                setNewsItems(res.items);
                setHasMore(res.items.length === PAGE_SIZE);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [searchQ]);

    // Load next page
    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore) return;
        const nextPage = page + 1;
        setLoadingMore(true);
        fetchNews({ limit: PAGE_SIZE, page: nextPage, q: searchQ || undefined })
            .then(res => {
                setNewsItems(prev => [...prev, ...res.items]);
                setPage(nextPage);
                setHasMore(res.items.length === PAGE_SIZE);
            })
            .catch(() => { /* silently ignore load-more errors */ })
            .finally(() => setLoadingMore(false));
    }, [loadingMore, hasMore, page, searchQ]);

    // IntersectionObserver — fires loadMore when sentinel scrolls into view
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) loadMore(); },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore]);

    if (isWidget) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10 shrink-0">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <Zap size={16} /> Haberler
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Filter size={14} /></Button>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    {loading && (
                        <div className="divide-y divide-border">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-1.5 py-2 px-4">
                                    <Skeleton className="h-2.5 w-24" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            ))}
                        </div>
                    )}
                    {error && <p className="text-xs text-destructive p-4">{error}</p>}
                    {newsItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex flex-col py-2 px-4 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0 gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground font-mono">{formatRelativeTime(item.published_at)}</span>
                                <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">{item.news_source ?? '—'}</span>
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
                            <Zap className="text-chart-4 fill-chart-4" size={20} /> BIST Haberleri
                        </h1>
                        <div className="flex items-center gap-2">
                            <Select className="w-[120px] h-8 text-xs bg-secondary/50 border-0">
                                <option>All News</option>
                                <option value="OLUMLU">Olumlu</option>
                                <option value="OLUMSUZ">Olumsuz</option>
                                <option value="NÖTR">Neutral</option>
                            </Select>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search title, symbol..."
                            className="pl-9 bg-secondary/30 border-border"
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                        />
                    </div>
                </div>

                {/* News List */}
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                        {loading && (
                            <>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="p-4 space-y-2">
                                        <Skeleton className="h-3 w-32" />
                                        <Skeleton className="h-5 w-full" />
                                        <Skeleton className="h-4 w-5/6" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                ))}
                            </>
                        )}
                        {error && <p className="p-6 text-sm text-destructive">{error}</p>}
                        {!loading && !error && newsItems.length === 0 && (
                            <p className="p-6 text-sm text-muted-foreground">No news found.</p>
                        )}
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
                                            {item.news_source ?? '—'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock size={10} /> {formatRelativeTime(item.published_at)}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {item.symbol && (
                                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1 rounded hover:text-foreground">
                                                {item.symbol}
                                            </span>
                                        )}
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
                        {/* Sentinel — triggers loadMore when scrolled into view */}
                        <div ref={sentinelRef} className="py-4 flex justify-center">
                            {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {!loadingMore && !hasMore && newsItems.length > 0 && (
                                <span className="text-[11px] text-muted-foreground">Tüm haberler yüklendi</span>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </div>

            {/* Reading Pane (Conditional) */}
            {selectedNews && (() => {
                const item = newsItems.find(n => n.id === selectedNews);
                if (!item) return null;
                const sentimentColor =
                    item.sentiment?.toUpperCase() === 'OLUMLU' ? 'text-emerald-400 bg-emerald-400/10' :
                    item.sentiment?.toUpperCase() === 'OLUMSUZ' ? 'text-red-400 bg-red-400/10' :
                    'text-muted-foreground bg-secondary';
                const scoreDisplay = item.sentiment_score != null
                    ? `${(item.sentiment_score * 100).toFixed(0)}%`
                    : null;

                return (
                    <div className="flex-1 bg-card border-l border-border h-full overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Top bar */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedNews(null)}>
                                ← Kapat
                            </Button>
                            {item.news_url && (
                                <Button variant="outline" size="sm" className="gap-2" asChild>
                                    <a href={item.news_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink size={14} /> Kaynağa Git
                                    </a>
                                </Button>
                            )}
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-8 max-w-2xl mx-auto space-y-6">
                                {/* Meta row */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {item.news_source && (
                                        <span className="font-semibold text-foreground bg-secondary px-2 py-0.5 rounded">
                                            {item.news_source}
                                        </span>
                                    )}
                                    {item.symbol && (
                                        <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                                            {item.symbol}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock size={11} /> {formatRelativeTime(item.published_at)}
                                    </span>
                                    {item.author && (
                                        <>
                                            <span className="text-border">·</span>
                                            <span>{item.author}</span>
                                        </>
                                    )}
                                </div>

                                {/* Title */}
                                <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground">
                                    {item.title}
                                </h1>

                                {/* Sentiment badge */}
                                {item.sentiment && (
                                    <div className="flex items-center gap-2">
                                        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', sentimentColor)}>
                                            {mapSentiment(item.sentiment)}
                                        </span>
                                        {scoreDisplay && (
                                            <span className="text-xs text-muted-foreground">güven: {scoreDisplay}</span>
                                        )}
                                    </div>
                                )}

                                {/* Summary */}
                                {item.summary ? (
                                    <div className="border-l-4 border-primary pl-4 py-1">
                                        <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                                            {item.summary}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">Özet mevcut değil.</p>
                                )}

                                {/* Market info grid */}
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Hisse</div>
                                        <div className="font-bold">{item.symbol ?? '—'}</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Duygu</div>
                                        <div className={cn('font-bold', sentimentColor.split(' ')[0])}>
                                            {mapSentiment(item.sentiment ?? null)}
                                            {scoreDisplay && <span className="text-xs font-normal text-muted-foreground ml-1">({scoreDisplay})</span>}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Kaynak</div>
                                        <div className="font-medium text-sm">{item.news_source ?? '—'}</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Yazar</div>
                                        <div className="font-medium text-sm truncate">{item.author ?? '—'}</div>
                                    </div>
                                </div>

                                {/* External link button at bottom */}
                                {item.news_url && (
                                    <a
                                        href={item.news_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                                    >
                                        <ExternalLink size={14} /> Haberin tamamını oku
                                    </a>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                );
            })()}
        </div>
    );
}
