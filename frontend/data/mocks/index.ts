import { Market, Stock, Strategy, Correlation, BacktestResult, CalendarEvent, AnalysisSignal } from '../types';

export const mockCalendarEvents: CalendarEvent[] = [
    { id: '1', time: '10:00', currency: 'TRY', country: 'TR', importance: 'High', title: 'GDP Growth Rate YoY', actual: '4.5%', forecast: '4.2%', previous: '4.0%', date: '2024-02-16' },
    { id: '2', time: '15:30', currency: 'USD', country: 'US', importance: 'High', title: 'PPI MoM', actual: '0.3%', forecast: '0.1%', previous: '-0.1%', date: '2024-02-16' },
    { id: '3', time: '15:30', currency: 'USD', country: 'US', importance: 'Medium', title: 'Building Permits', actual: '1.45M', forecast: '1.49M', previous: '1.49M', date: '2024-02-16' },
    { id: '4', time: '16:00', currency: 'USD', country: 'US', importance: 'Medium', title: 'Michigan Consumer Sentiment', actual: '79.6', forecast: '80.0', previous: '79.0', date: '2024-02-16' },
    { id: '5', time: '09:00', currency: 'GBP', country: 'UK', importance: 'Medium', title: 'Retail Sales MoM', actual: '3.4%', forecast: '1.5%', previous: '-3.3%', date: '2024-02-17' },
    { id: '6', time: '12:00', currency: 'EUR', country: 'EU', importance: 'Low', title: 'Trade Balance', actual: '', forecast: '12.5B', previous: '11.8B', date: '2024-02-17' },
];

export const mockMarkets: Market[] = [
    { id: 'bist', symbol: 'XU100', name: 'BIST 100', price: 9250.45, change: 114.2, changePercent: 1.25, volume: 45000000, category: 'BIST' },
    { id: 'nasdaq', symbol: 'NDX', name: 'NASDAQ 100', price: 17850.30, change: -45.6, changePercent: -0.25, volume: 150000000, category: 'NASDAQ' },
    { id: 'sp500', symbol: 'SPX', name: 'S&P 500', price: 5080.20, change: 12.8, changePercent: 0.25, volume: 2100000000, category: 'NASDAQ' },
    { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', price: 51250.00, change: 850.00, changePercent: 1.68, volume: 25000000000, category: 'CRYPTO' },
    { id: 'eth', symbol: 'ETHUSD', name: 'Ethereum', price: 2950.40, change: 45.20, changePercent: 1.55, volume: 12000000000, category: 'CRYPTO' },
];

export const mockStocks: Stock[] = [
    { ticker: 'AAPL', name: 'Apple Inc.', price: 182.50, change: -1.25, changePercent: -0.68, marketOpen: true },
    { ticker: 'MSFT', name: 'Microsoft Corp.', price: 410.20, change: 2.45, changePercent: 0.60, marketOpen: true },
    { ticker: 'TSLA', name: 'Tesla Inc.', price: 195.40, change: -2.10, changePercent: -1.06, marketOpen: true },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 785.30, change: 12.50, changePercent: 1.62, marketOpen: true },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 172.10, change: 1.80, changePercent: 1.06, marketOpen: true },
];

export const mockStrategies: Strategy[] = [
    { id: '1', name: 'Moving Average Crossover', description: 'Classic trend following strategy using SMA 50/200.', author: 'System', riskLevel: 'Medium', tags: ['Trend', 'Momentum'] },
    { id: '2', name: 'RSI Mean Reversion', description: 'Buy oversold (RSI < 30), sell overbought (RSI > 70).', author: 'User', riskLevel: 'High', tags: ['Reversion', 'Oscillator'] },
    { id: '3', name: 'Dividend Growth', description: 'Long term portfolio of high dividend yield stocks.', author: 'Evalon AI', riskLevel: 'Low', tags: ['Investing', 'Dividend'] },
];

export const mockCorrelations: Correlation[] = [
    { ticker1: 'BTC', ticker2: 'ETH', value: 0.85 },
    { ticker1: 'SPX', ticker2: 'BTC', value: 0.42 },
    { ticker1: 'USD', ticker2: 'GOLD', value: -0.65 },
    { ticker1: 'AAPL', ticker2: 'MSFT', value: 0.72 },
    { ticker1: 'TSLA', ticker2: 'NVDA', value: 0.55 },
];

export const mockBacktestResults: BacktestResult[] = [
    { id: '1', strategyName: 'Moving Average Crossover', totalReturn: 125.4, maxDrawdown: -15.2, winRate: 58.5, trades: 142, equityCurve: [100, 102, 105, 103, 108, 112, 110, 115, 120, 125] },
    { id: '2', strategyName: 'RSI Mean Reversion', totalReturn: 45.2, maxDrawdown: -22.5, winRate: 62.0, trades: 85, equityCurve: [100, 98, 95, 102, 105, 104, 110, 115, 112, 145] },
    { id: '3', strategyName: 'Dividend Growth', totalReturn: 18.5, maxDrawdown: -5.4, winRate: 75.0, trades: 24, equityCurve: [100, 100.5, 101, 102, 103, 105, 108, 110, 112, 118] },
];

export const mockAnalysisSignals: AnalysisSignal[] = [
    { id: '1', ticker: 'THYAO', type: 'BUY', confidence: 92, timestamp: '2024-02-16T10:00:00Z', reason: 'RSI divergence + MA crossover' },
    { id: '2', ticker: 'BTCUSDT', type: 'HOLD', confidence: 65, timestamp: '2024-02-16T10:15:00Z', reason: 'Consolidating near resistance' },
    { id: '3', ticker: 'ASELS', type: 'SELL', confidence: 78, timestamp: '2024-02-16T09:45:00Z', reason: 'Breaking down support level' },
];
