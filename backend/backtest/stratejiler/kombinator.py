from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List,  Union, Optional, Optional, Tuple, List

import pandas as pd

from stratejiler.base_strategy import BaseStrategy, StrategyContext
from engine.backtest_engine import BacktestConfig, BacktestResult, backtest_single_ticker


class StratejiKombinator(BaseStrategy):
    """
    Birden fazla stratejiyi birleştirir.
    Tüm stratejiler aynı anda AL sinyali verirse AL sinyali üretir.
    """

    def __init__(self, stratejiler: List[BaseStrategy]) -> None:
        if not stratejiler:
            raise ValueError("En az bir strateji verilmeli.")
        self.stratejiler = stratejiler

    def generate_signals(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> pd.Series:
        """
        Tüm stratejilerden sinyal al, hepsi 1 veriyorsa 1 döndür.
        """
        signals_list = []
        for strat in self.stratejiler:
            sig = strat.generate_signals(ohlcv, context)
            signals_list.append(sig)

        # Tüm sinyalleri birleştir: hepsi 1 ise 1, değilse 0
        combined = signals_List[0].copy()
        for sig in signals_List[1:]:
            combined = combined & sig

        return combined.astype("int8")

    def run_backtest(
        self,
        ohlcv: pd.DataFrame,
        config: Optional[BacktestConfig] = None,
        context: Optional[StrategyContext] = None,
    ) -> BacktestResult:
        signals = self.generate_signals(ohlcv, context)
        return backtest_single_ticker(ohlcv=ohlcv, entry_signal=signals, config=config)
