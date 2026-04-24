/**
 * Screener-specific TypeScript types.
 *
 * These are separate from types/index.ts to keep screener concerns isolated.
 */

// ---------------------------------------------------------------------------
// Numeric comparison operator
// ---------------------------------------------------------------------------
export type NumericOp = 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'eq'

// ---------------------------------------------------------------------------
// Filter models (mirror backend screener_filters.py)
// ---------------------------------------------------------------------------

export interface PriceFilter {
  type: 'price'
  op: NumericOp
  value: number
  value2?: number
}

export interface VolumeFilter {
  type: 'volume'
  op: NumericOp
  value: number
  value2?: number
  /** If true, value is a multiple of avg_volume (e.g. 2 = 2x avg) */
  relative?: boolean
}

export interface ChangePctFilter {
  type: 'change_pct'
  op: NumericOp
  value: number
  value2?: number
}

export interface IndicatorFilter {
  type: 'indicator'
  indicator: string
  params?: Record<string, number | string>
  /** Which line to read from multi-output indicators (default: 'value') */
  output_key?: string
  op: NumericOp
  value: number
  value2?: number
}

export interface CrossFilter {
  type: 'cross'
  indicator: string
  params?: Record<string, number | string>
  output_key?: string
  /** 'above' = bullish cross, 'below' = bearish cross */
  direction: 'above' | 'below'
  /** Fixed number OR 'close' (cross vs current price) */
  target: number | 'close'
  /** Look-back bars to detect the cross (default 1) */
  bars?: number
}

export interface HighLowFilter {
  type: 'high_low'
  side: 'high' | 'low'
  bars: number
  /** Max distance from the N-bar extreme in % */
  pct_tolerance: number
}

export type ScreenerFilter =
  | PriceFilter
  | VolumeFilter
  | ChangePctFilter
  | IndicatorFilter
  | CrossFilter
  | HighLowFilter

// ---------------------------------------------------------------------------
// Scan request / response
// ---------------------------------------------------------------------------

export type ScreenerTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
export type FilterLogic = 'AND' | 'OR'
export type ScanSortDir = 'asc' | 'desc'

export interface ScanRequest {
  tickers?: 'all' | string[]
  sectors?: string[]
  timeframe?: ScreenerTimeframe
  lookback_bars?: number
  filters?: ScreenerFilter[]
  logic?: FilterLogic
  limit?: number
  sort_by?: string
  sort_dir?: ScanSortDir
}

export interface ScanResultRow {
  ticker: string
  sector: string
  close: number
  open: number
  high: number
  low: number
  change_pct: number
  volume: number
  avg_volume: number
  vol_ratio: number
  indicators: Record<string, number | null>
  matched_filters: string[]
}

export interface ScanResponse {
  scanned_at: string
  total_scanned: number
  matched: number
  elapsed_ms: number
  errors: Array<{ ticker: string; error: string }>
  rows: ScanResultRow[]
}

// ---------------------------------------------------------------------------
// Ticker / Sector list response
// ---------------------------------------------------------------------------

export interface TickerItem {
  ticker: string
  sector: string
}

export interface TickerListResponse {
  count: number
  tickers: TickerItem[]
  sectors: string[]
}

// ---------------------------------------------------------------------------
// Screener preset (extends UserScreenerPreset with scan-specific fields)
// ---------------------------------------------------------------------------

export interface ScreenerScanPreset {
  id: string
  name: string
  /** 'browse' = market list sort/search, 'scan' = technical filter scan */
  mode: 'browse' | 'scan'
  // --- Browse mode fields ---
  search?: string
  sortBy?: string
  sortDir?: ScanSortDir
  // --- Scan mode fields ---
  timeframe?: ScreenerTimeframe
  lookback_bars?: number
  sectors?: string[]
  filters?: ScreenerFilter[]
  logic?: FilterLogic
  scan_sort_by?: string
  scan_sort_dir?: ScanSortDir
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Quick filter chip definition (static, not fetched)
// ---------------------------------------------------------------------------

export interface QuickFilterChip {
  id: string
  label: string
  /** Short description shown on hover */
  description: string
  filters: ScreenerFilter[]
  timeframe?: ScreenerTimeframe
  logic?: FilterLogic
}

// ---------------------------------------------------------------------------
// Filter builder row (UI state for the filter builder)
// ---------------------------------------------------------------------------

export interface FilterBuilderRow {
  /** Unique row ID for React keys */
  rowId: string
  filter: ScreenerFilter
}

// ---------------------------------------------------------------------------
// Supported timeframe labels
// ---------------------------------------------------------------------------

export const SCREENER_TIMEFRAMES: { value: ScreenerTimeframe; label: string }[] = [
  { value: '1m', label: '1 Min' },
  { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' },
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: 'Daily' },
  { value: '1w', label: 'Weekly' },
]

export const NUMERIC_OPS: { value: NumericOp; label: string }[] = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
  { value: 'between', label: 'arasında' },
]
