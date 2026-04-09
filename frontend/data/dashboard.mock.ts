// Dashboard Mock Data - TradingView inspired

export interface TickerTapeItem {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
}

export interface AIAlphaPick {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  signal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'
  confidence: number
  reason: string
}

export interface WatchlistRow {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: string
  aiSignal: 'Buy' | 'Sell' | 'Neutral'
  category: 'BIST' | 'NASDAQ' | 'CRYPTO' | 'FOREX'
}

export interface MarketIndex {
  name: string
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  badge: string
  badgeColor: string
}

// Ticker Tape Data
export const tickerTapeData: TickerTapeItem[] = [
  { symbol: 'BIST 100', price: 14347.49, change: 167.48, changePercent: 1.18, currency: 'TRY' },
  { symbol: 'S&P 500', price: 6836.18, change: 3.41, changePercent: 0.05, currency: 'USD' },
  { symbol: 'NASDAQ', price: 24732.73, change: 44.52, changePercent: 0.18, currency: 'USD' },
  { symbol: 'BTCUSDT_C', price: 97542.30, change: 1245.60, changePercent: 1.29, currency: 'USD' },
  { symbol: 'THYAO', price: 285.50, change: 6.70, changePercent: 2.40, currency: 'TRY' },
  { symbol: 'EREGL', price: 53.75, change: -0.85, changePercent: -1.56, currency: 'TRY' },
  { symbol: 'SOLUSDT_C', price: 198.45, change: 5.23, changePercent: 2.71, currency: 'USD' },
  { symbol: 'ETHUSDT_C', price: 3180.00, change: -45.00, changePercent: -1.40, currency: 'USD' },
  { symbol: 'GARAN', price: 155.30, change: 2.70, changePercent: 1.77, currency: 'TRY' },
  { symbol: 'EUR/USD', price: 1.0842, change: 0.0012, changePercent: 0.11, currency: '' },
  { symbol: 'ASELS', price: 42.10, change: -0.30, changePercent: -0.71, currency: 'TRY' },
  { symbol: 'USD/TRY', price: 36.45, change: -0.12, changePercent: -0.33, currency: '' },
  { symbol: 'GOLD', price: 2935.80, change: 12.40, changePercent: 0.42, currency: 'USD' },
  { symbol: 'AAPL', price: 245.20, change: 3.10, changePercent: 1.28, currency: 'USD' },
  { symbol: 'TSLA', price: 338.50, change: -8.20, changePercent: -2.37, currency: 'USD' },
]

// AI Alpha Picks
export const aiAlphaPicks: AIAlphaPick[] = [
  {
    ticker: 'THYAO',
    name: 'Turkish Airlines',
    price: 285.50,
    change: 6.70,
    changePercent: 2.40,
    signal: 'Strong Buy',
    confidence: 94,
    reason: 'Strong momentum + positive earnings revision',
  },
  {
    ticker: 'BTCUSDT_C',
    name: 'Bitcoin / USDT',
    price: 97542.30,
    change: 1245.60,
    changePercent: 1.29,
    signal: 'Buy',
    confidence: 87,
    reason: 'Bullish breakout above $95K resistance',
  },
  {
    ticker: 'SOLUSDT_C',
    name: 'Solana / USDT',
    price: 198.45,
    change: 5.23,
    changePercent: 2.71,
    signal: 'Strong Buy',
    confidence: 91,
    reason: 'DeFi volume surge + technical breakout',
  },
]

// Live Watchlist
export const watchlistData: WatchlistRow[] = [
  { ticker: 'THYAO', name: 'Turkish Airlines', price: 285.50, change: 6.70, changePercent: 2.40, volume: '12.5M', aiSignal: 'Buy', category: 'BIST' },
  { ticker: 'GARAN', name: 'Garanti BBVA', price: 155.30, change: 2.70, changePercent: 1.77, volume: '8.2M', aiSignal: 'Buy', category: 'BIST' },
  { ticker: 'EREGL', name: 'Ereğli Demir Çelik', price: 53.75, change: -0.85, changePercent: -1.56, volume: '5.8M', aiSignal: 'Sell', category: 'BIST' },
  { ticker: 'ASELS', name: 'Aselsan', price: 42.10, change: -0.30, changePercent: -0.71, volume: '5.1M', aiSignal: 'Neutral', category: 'BIST' },
  { ticker: 'BTCUSDT_C', name: 'Bitcoin', price: 97542.30, change: 1245.60, changePercent: 1.29, volume: '31.2B', aiSignal: 'Buy', category: 'CRYPTO' },
  { ticker: 'ETHUSDT_C', name: 'Ethereum', price: 3180.00, change: -45.00, changePercent: -1.40, volume: '17.8B', aiSignal: 'Neutral', category: 'CRYPTO' },
  { ticker: 'SOLUSDT_C', name: 'Solana', price: 198.45, change: 5.23, changePercent: 2.71, volume: '4.5B', aiSignal: 'Buy', category: 'CRYPTO' },
  { ticker: 'AAPL', name: 'Apple Inc.', price: 245.20, change: 3.10, changePercent: 1.28, volume: '54.2M', aiSignal: 'Buy', category: 'NASDAQ' },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 338.50, change: -8.20, changePercent: -2.37, volume: '76.5M', aiSignal: 'Sell', category: 'NASDAQ' },
  { ticker: 'EUR/USD', name: 'Euro / Dollar', price: 1.0842, change: 0.0012, changePercent: 0.11, volume: '145B', aiSignal: 'Neutral', category: 'FOREX' },
]

// Market Indices (for landing page & dashboard)
export const marketIndices: MarketIndex[] = [
  { name: 'BIST 100', symbol: 'XU100', price: 14347.49, change: 167.48, changePercent: 1.18, currency: 'TRY', badge: '100', badgeColor: 'bg-sky-500' },
  { name: 'BIST 50', symbol: 'XU050', price: 12606.04, change: 132.42, changePercent: 1.06, currency: 'TRY', badge: '50', badgeColor: 'bg-blue-500' },
  { name: 'S&P 500', symbol: 'SPX', price: 6836.18, change: 3.41, changePercent: 0.05, currency: 'USD', badge: '500', badgeColor: 'bg-red-500' },
  { name: 'Nasdaq 100', symbol: 'NDX', price: 24732.73, change: 44.52, changePercent: 0.18, currency: 'USD', badge: '100', badgeColor: 'bg-blue-600' },
  { name: 'Japan 225', symbol: 'NI225', price: 56806.36, change: -136.33, changePercent: -0.24, currency: 'JPY', badge: '225', badgeColor: 'bg-blue-500' },
  { name: 'SSE Composite', symbol: '000001', price: 4082.07, change: -51.84, changePercent: -1.26, currency: 'CNY', badge: '🌏', badgeColor: 'bg-teal-500' },
  { name: 'FTSE 100', symbol: 'UKX', price: 10474.97, change: 28.28, changePercent: 0.27, currency: 'GBP', badge: '🇬🇧', badgeColor: 'bg-blue-700' },
]

// Generate intraday chart data (BIST 100 style)
export function generateIntradayData(points: number = 78) {
  const data = []
  let price = 14180
  const baseDate = new Date()
  baseDate.setHours(9, 30, 0, 0)

  for (let i = 0; i < points; i++) {
    const timestamp = new Date(baseDate.getTime() + i * 5 * 60 * 1000)
    const volatility = i < 20 ? 15 : i < 40 ? 8 : 12
    const trend = i < 30 ? 0.6 : i < 50 ? -0.2 : 0.3
    const change = (Math.random() - 0.5 + trend) * volatility
    price = Math.max(price + change, 13900)

    data.push({
      time: timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      price: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 500000) + 100000,
    })
  }

  return data
}

// Generate daily chart data
export function generateDailyData(days: number = 90) {
  const data = []
  let price = 250
  const now = new Date()

  for (let i = days; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const change = (Math.random() - 0.47) * 5
    price = Math.max(price + change, 180)

    data.push({
      time: timestamp.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      price: Math.round(price * 100) / 100,
      open: Math.round((price - Math.random() * 2) * 100) / 100,
      high: Math.round((price + Math.random() * 3) * 100) / 100,
      low: Math.round((price - Math.random() * 3) * 100) / 100,
      close: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 5000000) + 1000000,
    })
  }

  return data
}
