from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List,  Union, Optional, Any, Dict, Optional

import pandas as pd

from engine.backtest_engine import BacktestConfig, BacktestResult, backtest_single_ticker


@dataclass
class StrategyContext:
    """
    Stratejilere geçirilebilecek tüm veri türlerini barındırır.
    Yeni veri türleri eklemek için bu class'a field ekle.
    """
    ohlcv: pd.DataFrame
    
    # ML/AI için ek veriler (opsiyonel)
    images: Optional[Dict[str, Any]] = None       # CV modelleri için görüntüler (timestamp -> image)
    news: Optional[pd.DataFrame] = None            # Haber/sentiment verisi
    embeddings: Optional[Dict[str, Any]] = None    # LLM embeddings
    features: Optional[pd.DataFrame] = None        # Önceden hesaplanmış ML feature'ları
    
    # Model/API referansları
    models: Dict[str, Any] = field(default_factory=dict)  # {'llm': openai_client, 'cv': yolo_model, ...}
    
    # Ekstra metadata
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseStrategy(ABC):
    """Tüm stratejilerin implement etmesi gereken base class."""

    @abstractmethod
    def generate_signals(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> pd.Series:
        """
        Alım sinyali üretir.
        
        Args:
            ohlcv: OHLCV verisi (geriye uyumluluk için)
            context: Opsiyonel StrategyContext (ML/AI stratejileri için ek veri)
        
        Returns:
            pd.Series: 0/1 değerlerinden oluşan sinyal serisi (1 = al)
        """
        pass

    def get_indicators(self, ohlcv: pd.DataFrame, context: Optional[StrategyContext] = None) -> List[dict]:
        """
        Görselleştirme için indikatör verilerini döndürür.
        
        Returns:
            List[dict]: Her bir dict bir indikatör serisini temsil eder.
        """
        return []

    def run_backtest(
        self,
        ohlcv: pd.DataFrame,
        config: Optional[BacktestConfig] = None,
        context: Optional[StrategyContext] = None,
    ) -> BacktestResult:
        signals = self.generate_signals(ohlcv, context)
        return backtest_single_ticker(ohlcv=ohlcv, entry_signal=signals, config=config)
