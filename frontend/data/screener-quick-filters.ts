/**
 * Quick-filter chips displayed at the top of the screener.
 * Each chip maps to a set of pre-configured filters + timeframe.
 */

import type { QuickFilterChip } from '@/types/screener'

export const QUICK_FILTER_CHIPS: QuickFilterChip[] = [
  // ---- Momentum ----
  {
    id: 'rsi_oversold',
    label: 'RSI Aşırı Satım',
    description: 'RSI(14) < 30 — aşırı satım bölgesi',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'rsi', params: { period: 14 }, op: 'lt', value: 30 }],
  },
  {
    id: 'rsi_overbought',
    label: 'RSI Aşırı Alım',
    description: 'RSI(14) > 70 — aşırı alım bölgesi',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'rsi', params: { period: 14 }, op: 'gt', value: 70 }],
  },
  {
    id: 'rsi_cross_30',
    label: 'RSI 30 Kırış ↑',
    description: 'RSI(14) 30 seviyesini yukarı kırdı',
    timeframe: '1d',
    filters: [{ type: 'cross', indicator: 'rsi', params: { period: 14 }, direction: 'above', target: 30 }],
  },
  {
    id: 'rsi_cross_70',
    label: 'RSI 70 Kırış ↓',
    description: 'RSI(14) 70 seviyesini aşağı kırdı',
    timeframe: '1d',
    filters: [{ type: 'cross', indicator: 'rsi', params: { period: 14 }, direction: 'below', target: 70 }],
  },
  // ---- MACD ----
  {
    id: 'macd_bullish',
    label: 'MACD Pozitif',
    description: 'MACD histogramı > 0 — yükselen momentum',
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
    label: 'MACD Kesişim ↑',
    description: 'MACD çizgisi sinyal çizgisini yukarı kesti',
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
    label: 'SMA20 Üstünde',
    description: 'Kapanış fiyatı SMA(20) üzerinde',
    timeframe: '1d',
    filters: [
      { type: 'cross', indicator: 'sma', params: { period: 20 }, direction: 'above', target: 'close' },
    ],
  },
  {
    id: 'above_sma50',
    label: 'SMA50 Üstünde',
    description: 'Kapanış fiyatı SMA(50) üzerinde',
    timeframe: '1d',
    filters: [
      { type: 'cross', indicator: 'sma', params: { period: 50 }, direction: 'above', target: 'close' },
    ],
  },
  {
    id: 'adx_strong_trend',
    label: 'Güçlü Trend ADX>25',
    description: 'ADX(14) > 25 — güçlü yönlü trend',
    timeframe: '1d',
    filters: [{ type: 'indicator', indicator: 'adx', params: { period: 14 }, op: 'gt', value: 25 }],
  },
  // ---- Volume ----
  {
    id: 'volume_spike',
    label: 'Hacim Patlaması',
    description: 'Günlük hacim 2x ortalama üzerinde',
    timeframe: '1d',
    filters: [{ type: 'volume', op: 'gt', value: 2, relative: true }],
  },
  {
    id: 'high_volume_breakout',
    label: 'Hacimli Yükseliş',
    description: '>+3% artı hacim patlaması',
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
    label: '52-Hafta Zirvesinde',
    description: 'Kapanış 52-haftalık en yüksekten ≤3% uzakta',
    timeframe: '1w',
    filters: [{ type: 'high_low', side: 'high', bars: 52, pct_tolerance: 3 }],
  },
  {
    id: 'near_20d_low',
    label: '20-Gün Dibinde',
    description: 'Kapanış 20-günlük en düşükten ≤2% uzakta',
    timeframe: '1d',
    filters: [{ type: 'high_low', side: 'low', bars: 20, pct_tolerance: 2 }],
  },
  // ---- Bollinger ----
  {
    id: 'bb_squeeze_touch_lower',
    label: 'BB Alt Bant',
    description: 'Kapanış Bollinger alt bandına yakın',
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
    label: 'Güçlü Yükseliş >5%',
    description: 'Günlük değişim > +5%',
    timeframe: '1d',
    filters: [{ type: 'change_pct', op: 'gt', value: 5 }],
  },
  {
    id: 'big_loser',
    label: 'Sert Düşüş <-5%',
    description: 'Günlük değişim < -5%',
    timeframe: '1d',
    filters: [{ type: 'change_pct', op: 'lt', value: -5 }],
  },
]
