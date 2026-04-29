from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


@dataclass(frozen=True)
class CoMovementAnalyzeInput:
    symbols: list[str]
    start_date: date
    end_date: date
    top_k: int = 3
    min_similarity: float = 0.60
    rolling_window: int = 90
    rolling_step: int = 20
    max_missing_ratio: float = 0.15
    min_history_rows: int = 60
    timeframe: str = "1d"


@dataclass(frozen=True)
class CoMovementExplainInput:
    top_pairs: list[dict[str, Any]] = field(default_factory=list)
    communities: list[dict[str, Any]] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    language: str = "tr"
    symbols: list[str] = field(default_factory=list)
    date_range: dict[str, Any] = field(default_factory=dict)
