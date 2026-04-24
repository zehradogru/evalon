'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Share2, Bookmark, Clock, ExternalLink, Zap, TrendingUp, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select-native';
import { fetchNews } from '@/services/news.service';
import type { NewsItem } from '@/types/news';

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'şimdi';
    if (mins < 60) return `${mins}d önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}s önce`;
    return `${Math.floor(hours / 24)}g önce`;
}

function mapSentiment(s: string | null): string {
    if (!s) return 'Nötr';
    const u = s.toUpperCase();
    if (u === 'OLUMLU') return 'Olumlu';
    if (u === 'OLUMSUZ') return 'Olumsuz';
    if (u === 'NÖTR' || u === 'NOTR') return 'Nötr';
    if (u === 'BEKLIYOR') return 'Bekleniyor';
    return s;
}




interface NewsViewProps {
    isWidget?: boolean;
}

export function NewsView({ isWidget = false }: NewsViewProps) {
    const [selectedNews, setSelectedNews] = useState<number | null>(null);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchNews({ limit: 50, q: searchQ || undefined })
            .then(res => setNewsItems(res.items))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [searchQ]);

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
                    {loading && <p className="text-xs text-muted-foreground p-4">Yükleniyor...</p>}
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
                                <option>Tüm Haberler</option>
                                <option value="OLUMLU">Olumlu</option>
                                <option value="OLUMSUZ">Olumsuz</option>
                                <option value="NÖTR">Nötr</option>
                            </Select>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Başlık, sembol ara..."
                            className="pl-9 bg-secondary/30 border-border"
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                        />
                    </div>
                </div>

                {/* News List */}
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                        {loading && <p className="p-6 text-sm text-muted-foreground">Haberler yükleniyor...</p>}
                        {error && <p className="p-6 text-sm text-destructive">{error}</p>}
                        {!loading && !error && newsItems.length === 0 && (
                            <p className="p-6 text-sm text-muted-foreground">Haber bulunamadı.</p>
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
                    </div>
                </ScrollArea>
            </div>

            {/* Reading Pane (Conditional) */}
            {selectedNews && (
                <div className="flex-1 bg-card border-l border-border h-full overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setSelectedNews(null)} className="gap-2">
                            Kapat
                        </Button>
                        <div className="flex gap-2">
                            {newsItems.find(n => n.id === selectedNews)?.news_url && (
                                <Button variant="outline" size="sm" className="gap-2" asChild>
                                    <a href={newsItems.find(n => n.id === selectedNews)!.news_url!} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink size={14} /> Kaynağa Git
                                    </a>
                                </Button>
                            )}
                            <Button variant="default" size="sm">Haber ile İşlem</Button>
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-8">
                        <article className="prose dark:prose-invert max-w-none">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-sm text-muted-foreground">{newsItems.find(n => n.id === selectedNews)?.news_source ?? '—'}</span>
                                <span className="h-1 w-1 rounded-full bg-border"></span>
                                <span className="text-sm text-muted-foreground">{formatRelativeTime(newsItems.find(n => n.id === selectedNews)?.published_at ?? null)}</span>
                                {newsItems.find(n => n.id === selectedNews)?.symbol && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-border"></span>
                                        <span className="text-sm font-mono text-primary">{newsItems.find(n => n.id === selectedNews)?.symbol}</span>
                                    </>
                                )}
                            </div>
                            <h1 className="text-4xl font-extrabold mb-6 leading-tight tracking-tight">
                                {newsItems.find(n => n.id === selectedNews)?.title}
                            </h1>
                            <div className="p-4 bg-secondary/30 rounded-lg border-l-4 border-primary mb-8 italic text-lg text-muted-foreground">
                                {newsItems.find(n => n.id === selectedNews)?.summary ?? ''}
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
                                        <div className="text-sm text-muted-foreground mb-1">Hisse</div>
                                        <div className="font-bold text-lg">{newsItems.find(n => n.id === selectedNews)?.symbol ?? '—'}</div>
                                    </div>
                                    <div className="p-4 bg-secondary/50 rounded-lg">
                                        <div className="text-sm text-muted-foreground mb-1">Duygu</div>
                                        <div className="font-bold text-lg">{mapSentiment(newsItems.find(n => n.id === selectedNews)?.sentiment ?? null)}</div>
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
