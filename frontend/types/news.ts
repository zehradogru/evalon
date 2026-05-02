export interface NewsItem {
  id: number
  symbol: string | null
  news_source: string | null
  title: string
  summary: string | null
  content: string | null
  sentiment: string | null
  sentiment_score: number | null
  news_url: string | null
  author: string | null
  published_at: string | null
}

export interface NewsResponse {
  items: NewsItem[]
  total: number
  page: number
  limit: number
}
