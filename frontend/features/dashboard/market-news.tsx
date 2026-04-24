'use client'

import { useState, useEffect } from 'react'
import { Newspaper, ExternalLink } from 'lucide-react'
import { fetchNews } from '@/services/news.service'
import type { NewsItem } from '@/types/news'

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

export function MarketNews() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews({ limit: 4 })
      .then(res => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Market News</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-muted-foreground p-4 text-center">Loading...</p>
        )}
        {!loading && items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-border/20 hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground">{item.news_source ?? '—'}</span>
                <span className="text-[10px] text-muted-foreground/50">·</span>
                <span className="text-[10px] text-muted-foreground">{relativeTime(item.published_at)}</span>
                {item.symbol && (
                  <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                    {item.symbol}
                  </span>
                )}
              </div>
            </div>
            {item.news_url ? (
              <a href={item.news_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5 flex-shrink-0" />
              </a>
            ) : (
              <ExternalLink className="h-3 w-3 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
