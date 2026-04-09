from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import pandas as pd

from engine.backtest_engine import BacktestConfig, BacktestResult, backtest_single_ticker


@dataclass
class RSIStrategyConfig:
    period: int = 14
    entry_level: float = 30.0  # oversold


class RSIStrategy:
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

    def generate_signals(self, ohlcv: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
        """
        Returns:
          - target_pos: 0/1 Series (1 only on entry bar)
          - rsi: RSI series (for inspection)
        """
        close = ohlcv["close"].astype(float)
        rsi = self.compute_rsi(close)

        # Entry when RSI crosses above entry_level
        entry = (rsi.shift(1) < self.config.entry_level) & (rsi >= self.config.entry_level)
        target_pos = entry.astype("int8")

        return target_pos, rsi

    def run_backtest(
        self,
        ohlcv: pd.DataFrame,
        config: Optional[BacktestConfig] = None,
    ) -> Tuple[BacktestResult, pd.Series]:
        target_pos, rsi = self.generate_signals(ohlcv)
        result = backtest_single_ticker(ohlcv=ohlcv, entry_signal=target_pos, config=config)
        return result, rsi


if __name__ == "__main__":
    # Minimal example (expects ohlcv with columns: open, high, low, close, volume)
    import os
    from dotenv import load_dotenv

    from bist_prices_client import BistPricesClient
    from backtest_plot import plot_trades_lightweight

    load_dotenv()
    client = BistPricesClient()
    # fetch_prices() already returns canonical OHLCV with DatetimeIndex
    ohlcv = client.fetch_prices("THYAO")

    strat = RSIStrategy(RSIStrategyConfig(period=14, entry_level=30))
    result, rsi = strat.run_backtest(
        ohlcv,
        config=BacktestConfig(
            stop_loss_pct=0.02,
            take_profit_pct=0.01,
        ),
    )

    print(result.metrics)
    chart = plot_trades_lightweight(
        ohlcv=ohlcv,
        trades=result.trades,
        title="RSI Strategy Trades",
        theme="dark",
        show_volume=True,
    )
    chart.show(block=True)
