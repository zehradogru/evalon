import { User } from '@/types'; // Import User if needed or define locally if strictly data types

export interface Strategy {
    id: string;
    name: string;
    description: string;
    author: string;
    riskLevel: 'Low' | 'Medium' | 'High';
    tags: string[];
}

export interface Correlation {
    ticker1: string;
    ticker2: string;
    value: number; // -1 to 1
}

// ... existing types
export interface Stock {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    marketOpen: boolean;
}

export interface ChartDataPoint {
    time: string;
    value: number;
}

export interface AnalysisSignal {
    id: string;
    ticker: string;
    type: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    timestamp: string;
    reason: string;
}

export interface BacktestResult {
    id: string;
    strategyName: string;
    totalReturn: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    equityCurve: number[]; // Simple array for sparkline
}

export interface MarketIndex {
    id: string;
    name: string;
    value: number;
    change: number;
    changePercent: number;
    region: string;
}

export interface Market {
    id: string;
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    category: string;
}

export interface CalendarEvent {
    id: string;
    time: string;
    currency: string;
    country: string; // code like 'US', 'TR', 'EU'
    importance: 'Low' | 'Medium' | 'High';
    title: string;
    actual?: string;
    forecast?: string;
    previous?: string;
    date: string; // YYYY-MM-DD
}
