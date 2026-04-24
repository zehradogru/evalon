'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Newspaper, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { fetchNews } from '@/services/news.service'
import type { NewsItem } from '@/types/news'
import { cn } from '@/lib/utils'

function sentimentColor(s: string | null): string {
    if (!s) return 'bg-muted text-muted-foreground'
    const u = s.toUpperCase()
    if (u === 'OLUMLU') return 'bg-chart-2/15 text-chart-2'
    if (u === 'OLUMSUZ') return 'bg-destructive/15 text-destructive'
    return 'bg-muted text-muted-foreground'
}

function sentimentLabel(s: string | null): string {
    if (!s) return 'Haber'
    const u = s.toUpperCase()
    if (u === 'OLUMLU') return 'Olumlu'
    if (u === 'OLUMSUZ') return 'Olumsuz'
    return 'Neutral'
}

function relativeTime(dateStr: string | null): string {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export function NewsCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [news, setNews] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)
    const itemsPerPage = 2

    useEffect(() => {
        fetchNews({ limit: 6 })
            .then(res => setNews(res.items))
            .catch(() => setNews([]))
            .finally(() => setLoading(false))
    }, [])

    const totalPages = Math.max(1, Math.ceil(news.length / itemsPerPage))
    const currentNews = news.slice(
        currentIndex * itemsPerPage,
        (currentIndex + 1) * itemsPerPage
    )

    const goToPrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === totalPages - 1 ? 0 : prev + 1))
    }

    return (
        <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Newspaper className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-medium text-foreground">
                                Piyasa Haberleri
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Latest updates
                            </p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goToPrev}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                            {currentIndex + 1}/{totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goToNext}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-3">
                {loading && (
                    <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
                )}
                {!loading && currentNews.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No news found.</p>
                )}
                {!loading && currentNews.map((item) => (
                    <div
                        key={item.id}
                        className="p-3 rounded-lg bg-background hover:bg-muted/50 transition-all duration-200 cursor-pointer group border border-border/50"
                    >
                        {/* Sentiment & Time */}
                        <div className="flex items-center justify-between mb-2">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sentimentColor(item.sentiment))}>
                                {sentimentLabel(item.sentiment)}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {relativeTime(item.published_at)}
                            </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                            {item.title}
                        </h4>

                        {/* Summary */}
                        {item.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {item.summary}
                            </p>
                        )}

                        {/* Source & Symbol */}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                                {item.news_source ?? '—'}
                            </span>
                            {item.symbol && (
                                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                    {item.symbol}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
