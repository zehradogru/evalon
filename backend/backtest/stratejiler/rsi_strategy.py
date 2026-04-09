from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from stratejiler.base_strategy import BaseStrategy, StrategyContext
from engine.backtest_engine import BacktestConfig, BacktestResult


@dataclass
class RSIStrategyConfig:
    period: int = 14
    entry_level: float = 30.0  # oversold


class RSIStrategy(BaseStrategy):
    def __init__(self, config: Optional[RSIStrategyConfig] = None) -> None:
        self.config = config or RSIStrategyConfig()

    def compute_rsi(self, close: pd.Series) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)

        avg_gain = gain.ewm(alpha=1 / self.config.period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / self.config.period, adjust=False).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(0)

    def generate_signals(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> pd.Series:
        """RSI entry_level'ı yukarı kestiğinde AL sinyali."""
        close = ohlcv["close"].astype(float)
        rsi = self.compute_rsi(close)

        entry = (rsi.shift(1) < self.config.entry_level) & (rsi >= self.config.entry_level)
        return entry.astype("int8")

    def get_indicators(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> list[dict]:
        close = ohlcv["close"].astype(float)
        rsi = self.compute_rsi(close)
        
        # NaN temizle
        rsi = rsi.fillna(0)
        
        result = []
        
        # 1. RSI Çizgisi
        rsi_data = []
        for t, val in rsi.items():
            rsi_data.append({"time": t, "value": float(val)})
            
        result.append({
            "name": f"RSI ({self.config.period})",
            "type": "line",
            "data": rsi_data,
            "panel": 1,
            "options": {"color": "#be185d", "lineWidth": 2} # Pink-700
        })
        
        # 2. Aşırı Alım/Satım Seviyeleri (Opsiyonel: 30 ve 70)
        # Genelde 70 ve 30 standarttır, config'de sadece entry_level var ama görsel açıdan ikisini de ekleyelim.
        upper_data = [{"time": t, "value": 70.0} for t in rsi.index]
        lower_data = [{"time": t, "value": 30.0} for t in rsi.index]
        
        result.append({
            "name": "Overbought (70)",
            "type": "line",
            "data": upper_data,
            "panel": 1,
            "options": {"color": "#9ca3af", "lineWidth": 1, "lineStyle": 2} # Dashed Grey
        })
        
        result.append({
            "name": "Oversold (30)",
            "type": "line",
            "data": lower_data,
            "panel": 1,
            "options": {"color": "#9ca3af", "lineWidth": 1, "lineStyle": 2}
        })
        
        return result
