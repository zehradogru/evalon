/** Simplified list of indicators for the filter builder UI */
export const INDICATOR_CATALOG = [
  { id: 'rsi', label: 'RSI', hasOutput: false },
  { id: 'sma', label: 'SMA', hasOutput: false },
  { id: 'ema', label: 'EMA', hasOutput: false },
  { id: 'wma', label: 'WMA', hasOutput: false },
  { id: 'adx', label: 'ADX', hasOutput: false },
  { id: 'cci', label: 'CCI', hasOutput: false },
  { id: 'roc', label: 'ROC', hasOutput: false },
  { id: 'mom', label: 'MOM', hasOutput: false },
  { id: 'atr', label: 'ATR', hasOutput: false },
  { id: 'stochrsi', label: 'Stoch RSI (k)', hasOutput: false },
  { id: 'willr', label: "Williams %R", hasOutput: false },
  { id: 'mfi', label: 'MFI', hasOutput: false },
  { id: 'obv', label: 'OBV', hasOutput: false },
  { id: 'macd', label: 'MACD', hasOutput: true },
  { id: 'bbands', label: 'Bollinger Bands', hasOutput: true },
  { id: 'stoch', label: 'Stochastic', hasOutput: true },
  { id: 'aroon', label: 'Aroon', hasOutput: true },
] as const

export type IndicatorId = typeof INDICATOR_CATALOG[number]['id']
