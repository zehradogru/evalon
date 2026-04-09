'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Newspaper, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { mockNews, getCategoryColor, getCategoryLabel } from '@/data/news.mock'
import { cn } from '@/lib/utils'

export function NewsCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0)
    const itemsPerPage = 2

    const totalPages = Math.ceil(mockNews.length / itemsPerPage)
    const currentNews = mockNews.slice(
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
                                Son gelişmeler
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
                {currentNews.map((news) => (
                    <div
                        key={news.id}
                        className="p-3 rounded-lg bg-background hover:bg-muted/50 transition-all duration-200 cursor-pointer group border border-border/50"
                    >
                        {/* Category & Time */}
                        <div className="flex items-center justify-between mb-2">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getCategoryColor(news.category))}>
                                {getCategoryLabel(news.category)}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {news.time}
                            </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                            {news.title}
                        </h4>

                        {/* Summary */}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {news.summary}
                        </p>

                        {/* Source & Ticker */}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                                {news.source}
                            </span>
                            {news.ticker && (
                                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                    {news.ticker}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
