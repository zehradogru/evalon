'use client'

import { Newspaper, ExternalLink } from 'lucide-react'

const placeholderNews = [
  {
    id: 1,
    title: 'BIST 100 endeksi gune yukselisle basladi',
    source: 'Bloomberg HT',
    time: '2 saat once',
    tag: 'BIST',
  },
  {
    id: 2,
    title: 'Merkez Bankasi faiz kararini acikladi',
    source: 'Reuters',
    time: '3 saat once',
    tag: 'Ekonomi',
  },
  {
    id: 3,
    title: 'THYAO yeni ucus hatlari ile buyumeye devam ediyor',
    source: 'Anadolu Ajansi',
    time: '5 saat once',
    tag: 'THYAO',
  },
  {
    id: 4,
    title: 'Teknoloji hisseleri global piyasalarda yukseldi',
    source: 'Financial Times',
    time: '6 saat once',
    tag: 'Global',
  },
]

export function MarketNews() {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Market News</h3>
        </div>
        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted">Coming Soon</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {placeholderNews.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-border/20 hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground">{item.source}</span>
                <span className="text-[10px] text-muted-foreground/50">·</span>
                <span className="text-[10px] text-muted-foreground">{item.time}</span>
                <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                  {item.tag}
                </span>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
