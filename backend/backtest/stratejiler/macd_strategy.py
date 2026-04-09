from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import pandas as pd

from stratejiler.base_strategy import BaseStrategy, StrategyContext
from engine.backtest_engine import BacktestConfig, BacktestResult


@dataclass
class MACDStrategyConfig:
    fast_period: int = 12
    slow_period: int = 26
    signal_period: int = 9


class MACDStrategy(BaseStrategy):
    def __init__(self, config: Optional[MACDStrategyConfig] = None) -> None:
        self.config = config or MACDStrategyConfig()

    def compute_macd(self, close: pd.Series) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """MACD çizgisi, sinyal çizgisi ve histogram hesaplar."""
        fast_ema = close.ewm(span=self.config.fast_period, adjust=False).mean()
        slow_ema = close.ewm(span=self.config.slow_period, adjust=False).mean()

        macd_line = fast_ema - slow_ema
        signal_line = macd_line.ewm(span=self.config.signal_period, adjust=False).mean()
        histogram = macd_line - signal_line

        return macd_line, signal_line, histogram

    def generate_signals(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> pd.Series:
        """MACD sinyal çizgisini yukarı kestiğinde AL sinyali."""
        close = ohlcv["close"].astype(float)
        macd_line, signal_line, _ = self.compute_macd(close)

        entry = (macd_line.shift(1) < signal_line.shift(1)) & (macd_line >= signal_line)
        return entry.astype("int8")

    def get_indicators(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> list[dict]:
        close = ohlcv["close"].astype(float)
        macd, signal, hist = self.compute_macd(close)
        
        # NaN temizle
        macd = macd.fillna(0)
        signal = signal.fillna(0)
        hist = hist.fillna(0)
        
        # Veri formatla
        macd_data = [{"time": t, "value": float(v)} for t, v in macd.items()]
        signal_data = [{"time": t, "value": float(v)} for t, v in signal.items()]
        
        # Histogram için renkli veri (pozitif yeşil, negatif kırmızı)
        hist_data = []
        for t, val in hist.items():
            color = "#22c55e" if val >= 0 else "#ef4444" # green-500 / red-500
            hist_data.append({"time": t, "value": float(val), "color": color})
            
        return [
            {
                "name": "MACD",
                "type": "line",
                "data": macd_data,
                "panel": 1,
                "options": {"color": "#3b82f6", "lineWidth": 2} # blue-500
            },
            {
                "name": "Signal",
                "type": "line",
                "data": signal_data,
                "panel": 1,
                "options": {"color": "#f97316", "lineWidth": 2} # orange-500
            },
            {
                "name": "Histogram",
                "type": "histogram",
                "data": hist_data,
                "panel": 1,
                "options": {}
            }
        ]
