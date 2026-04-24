/**
 * Quick-filter chips displayed at the top of the screener.
 * Each chip maps to a set of pre-configured filters + timeframe.
 */

import type { QuickFilterChip } from '@/types/screener'

export const QUICK_FILTER_CHIPS: QuickFilterChip[] = [
  // ---- Momentum ----
  {
    id: 'rsi_oversold',
    label: 'RSI Oversold',
    description: 'RSI(14) < 30 — oversold zone',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'rsi', params: { period: 14 }, op: 'lt', value: 30 }],
  },
  {
    id: 'rsi_overbought',
    label: 'RSI Overbought',
    description: 'RSI(14) > 70 — overbought zone',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'rsi', params: { period: 14 }, op: 'gt', value: 70 }],
  },
  {
    id: 'rsi_cross_30',
    label: 'RSI Cross 30 ↑',
    description: 'RSI(14) crossed above 30',
    timeframe: '1d',
    filters: [{ type: 'cross', indicator: 'rsi', params: { period: 14 }, direction: 'above', target: 30 }],
  },
  {
    id: 'rsi_cross_70',
    label: 'RSI Cross 70 ↓',
    description: 'RSI(14) crossed below 70',
    timeframe: '1d',
    filters: [{ type: 'cross', indicator: 'rsi', params: { period: 14 }, direction: 'below', target: 70 }],
  },
  // ---- MACD ----
  {
    id: 'macd_bullish',
    label: 'MACD Positive',
    description: 'MACD histogram > 0 — rising momentum',
    timeframe: '1d',
    filters: [
      {
        type: 'indicator',
        indicator: 'macd',
        params: { fast: 12, slow: 26, signal: 9 },
        output_key: 'hist',
        op: 'gt',
        value: 0,
      },
    ],
  },
  {
    id: 'macd_cross_up',
    label: 'MACD Cross ↑',
    description: 'MACD line crossed above signal line',
    timeframe: '1d',
    filters: [
      {
        type: 'cross',
        indicator: 'macd',
        params: { fast: 12, slow: 26, signal: 9 },
        output_key: 'hist',
        direction: 'above',
        target: 0,
      },
    ],
  },
  // ---- Trend ----
  {
    id: 'above_sma20',
    label: 'Above SMA 20',
    description: 'Close price above SMA(20)',
    timeframe: '1d',
    filters: [
      { type: 'cross', indicator: 'sma', params: { period: 20 }, direction: 'above', target: 'close' },
    ],
  },
  {
    id: 'above_sma50',
    label: 'Above SMA 50',
    description: 'Close price above SMA(50)',
    timeframe: '1d',
    filters: [
      { type: 'cross', indicator: 'sma', params: { period: 50 }, direction: 'above', target: 'close' },
    ],
  },
  {
    id: 'adx_strong_trend',
    label: 'Strong Trend ADX>25',
    description: 'ADX(14) > 25 — strong directional trend',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'adx', params: { period: 14 }, op: 'gt', value: 25 }],
  },
  // ---- Volume ----
  {
    id: 'volume_spike',
    label: 'Volume Spike',
    description: 'Daily volume 2× above average',
    timeframe: '1d',
    filters: [{ type: 'volume', op: 'gt', value: 2, relative: true }],
  },
  {
    id: 'high_volume_breakout',
    label: 'Vol Breakout',
    description: '>+3% gain with volume spike',
    timeframe: '1d',
    logic: 'AND',
    filters: [
      { type: 'change_pct', op: 'gt', value: 3 },
      { type: 'volume', op: 'gt', value: 1.5, relative: true },
    ],
  },
  // ---- Price extremes ----
  {
    id: 'near_52w_high',
    label: '52W High',
    description: 'Close within 3% of 52-week high',
    timeframe: '1w',
    filters: [{ type: 'high_low', side: 'high', bars: 52, pct_tolerance: 3 }],
  },
  {
    id: 'near_20d_low',
    label: '20D Low',
    description: 'Close within 2% of 20-day low',
    timeframe: '1d',
    filters: [{ type: 'high_low', side: 'low', bars: 20, pct_tolerance: 2 }],
  },
  // ---- Bollinger ----
  {
    id: 'bb_squeeze_touch_lower',
    label: 'BB Lower Band',
    description: 'Close near Bollinger lower band',
    timeframe: '1d',
    filters: [
      {
        type: 'indicator',
        indicator: 'bbands',
        params: { period: 20, std_up: 2, std_dn: 2 },
        output_key: 'lower',
        op: 'gte',
        value: 0,
      },
    ],
  },
  // ---- Gainers / Losers ----
  {
    id: 'big_gainer',
    label: 'Big Gainer >5%',
    description: 'Daily change > +5%',
    timeframe: '1d',
    filters: [{ type: 'change_pct', op: 'gt', value: 5 }],
  },
  {
    id: 'big_loser',
    label: 'Big Loser <-5%',
    description: 'Daily change < -5%',
    timeframe: '1d',
    filters: [{ type: 'change_pct', op: 'lt', value: -5 }],
  },
]
