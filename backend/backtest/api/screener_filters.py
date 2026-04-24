"""
Screener filter definitions, validation and evaluation logic.

Filter types
------------
- price       : close op value  (op: gt|gte|lt|lte|between)
- volume      : volume op value (absolute or relative to avg)
- volume_ratio: volume / avg_volume op value
- change_pct  : 1-bar % change op value
- indicator   : last-bar indicator value op threshold
- cross       : indicator crossed above/below another value or line
- high_low    : price at N-bar high or low (pct_from_high, pct_from_low)
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Comparison operators
# ---------------------------------------------------------------------------

NumericOp = Literal["gt", "gte", "lt", "lte", "between", "eq"]

CROSS_DIR = Literal["above", "below"]


# ---------------------------------------------------------------------------
# Individual filter models
# ---------------------------------------------------------------------------

class PriceFilter(BaseModel):
    type: Literal["price"]
    op: NumericOp
    value: float = Field(..., gt=0)
    value2: Optional[float] = Field(None, gt=0)  # for 'between'

    @model_validator(mode="after")
    def _check_between(self) -> "PriceFilter":
        if self.op == "between":
            if self.value2 is None:
                raise ValueError("value2 is required for op='between'")
            if self.value2 <= self.value:
                raise ValueError("value2 must be greater than value for op='between'")
        return self


class VolumeFilter(BaseModel):
    type: Literal["volume"]
    op: NumericOp
    value: float = Field(..., ge=0)  # absolute or ratio
    value2: Optional[float] = Field(None, ge=0)
    relative: bool = False  # if True, value is multiple of avg_volume

    @model_validator(mode="after")
    def _check_between(self) -> "VolumeFilter":
        if self.op == "between" and self.value2 is None:
            raise ValueError("value2 is required for op='between'")
        return self


class ChangePctFilter(BaseModel):
    type: Literal["change_pct"]
    op: NumericOp
    value: float  # percent e.g. 5.0 means +5%
    value2: Optional[float] = None

    @model_validator(mode="after")
    def _check_between(self) -> "ChangePctFilter":
        if self.op == "between" and self.value2 is None:
            raise ValueError("value2 is required for op='between'")
        return self


class IndicatorFilter(BaseModel):
    type: Literal["indicator"]
    indicator: str = Field(..., min_length=1, max_length=32)
    # optional params forwarded to build_indicator_series
    params: Dict[str, Any] = Field(default_factory=dict)
    # which output key to read (e.g. 'value', 'macd', 'signal', 'hist', 'upper', 'middle', 'lower')
    output_key: str = "value"
    op: NumericOp
    value: float
    value2: Optional[float] = None

    @model_validator(mode="after")
    def _check_between(self) -> "IndicatorFilter":
        if self.op == "between" and self.value2 is None:
            raise ValueError("value2 is required for op='between'")
        return self


class CrossFilter(BaseModel):
    """Detects when indicator line crosses above/below a threshold or another line (close)."""
    type: Literal["cross"]
    indicator: str = Field(..., min_length=1, max_length=32)
    params: Dict[str, Any] = Field(default_factory=dict)
    output_key: str = "value"
    direction: CROSS_DIR  # 'above' or 'below'
    # cross target: a fixed number OR 'close' (current close price)
    target: Union[float, Literal["close"]]
    # look-back bars for cross detection (default: 1 = last completed cross)
    bars: int = Field(1, ge=1, le=10)


class HighLowFilter(BaseModel):
    """e.g. price within 5% of N-bar high."""
    type: Literal["high_low"]
    side: Literal["high", "low"]
    bars: int = Field(..., ge=2, le=500)
    # max distance from the extreme in percent
    pct_tolerance: float = Field(..., ge=0, lt=100)


AnyFilter = Union[
    PriceFilter,
    VolumeFilter,
    ChangePctFilter,
    IndicatorFilter,
    CrossFilter,
    HighLowFilter,
]


# ---------------------------------------------------------------------------
# Helper: evaluate a numeric comparison
# ---------------------------------------------------------------------------

def _cmp(actual: float, op: NumericOp, value: float, value2: Optional[float] = None) -> bool:
    if op == "gt":
        return actual > value
    if op == "gte":
        return actual >= value
    if op == "lt":
        return actual < value
    if op == "lte":
        return actual <= value
    if op == "eq":
        return abs(actual - value) < 1e-9
    if op == "between":
        return value <= actual <= (value2 or value)
    return False


# ---------------------------------------------------------------------------
# Per-bar data container
# ---------------------------------------------------------------------------

class BarData(BaseModel):
    """Pre-computed bar values passed to evaluate()."""
    close: float
    open: float
    high: float
    low: float
    volume: float
    change_pct: float        # (close - prev_close) / prev_close * 100
    avg_volume: float        # average volume over lookback window
    # indicator cache: key → last-bar float value
    # populated lazily by ScannerService
    indicators: Dict[str, float] = Field(default_factory=dict)
    # N-bar high/low cache: "high_{n}" / "low_{n}" → float
    extremes: Dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate_filter(f: AnyFilter, bar: BarData) -> bool:
    """Return True if bar passes the filter, False otherwise."""
    if isinstance(f, PriceFilter):
        return _cmp(bar.close, f.op, f.value, f.value2)

    if isinstance(f, VolumeFilter):
        vol = bar.volume / bar.avg_volume if f.relative and bar.avg_volume > 0 else bar.volume
        return _cmp(vol, f.op, f.value, f.value2)

    if isinstance(f, ChangePctFilter):
        return _cmp(bar.change_pct, f.op, f.value, f.value2)

    if isinstance(f, IndicatorFilter):
        key = _indicator_cache_key(f.indicator, f.params, f.output_key)
        val = bar.indicators.get(key)
        if val is None:
            return False
        return _cmp(val, f.op, f.value, f.value2)

    if isinstance(f, CrossFilter):
        key = _indicator_cache_key(f.indicator, f.params, f.output_key)
        # We need at least 2 consecutive values to detect a cross.
        # The indicators cache stores current bar; prev bar stored as key+"__prev"
        cur = bar.indicators.get(key)
        prev = bar.indicators.get(key + "__prev")
        if cur is None or prev is None:
            return False
        target = bar.close if f.target == "close" else float(f.target)
        if f.direction == "above":
            return prev < target <= cur or prev <= target < cur
        else:  # below
            return prev > target >= cur or prev >= target > cur

    if isinstance(f, HighLowFilter):
        extreme_key = f"{f.side}_{f.bars}"
        extreme = bar.extremes.get(extreme_key)
        if extreme is None or extreme <= 0:
            return False
        pct_diff = abs(bar.close - extreme) / extreme * 100
        return pct_diff <= f.pct_tolerance

    return False  # unknown filter type


def evaluate_filters(filters: List[AnyFilter], bar: BarData, logic: Literal["AND", "OR"] = "AND") -> List[str]:
    """
    Evaluate all filters.  Returns a list of matched filter descriptions (empty = no match).
    For AND logic: all filters must pass.
    For OR  logic: at least one filter must pass.
    """
    results: List[str] = []
    for f in filters:
        if evaluate_filter(f, bar):
            results.append(_filter_label(f))
    if logic == "AND":
        if len(results) == len(filters):
            return results
        return []
    else:  # OR
        return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _indicator_cache_key(indicator: str, params: Dict[str, Any], output_key: str) -> str:
    param_str = ",".join(f"{k}={v}" for k, v in sorted(params.items()))
    return f"{indicator}|{param_str}|{output_key}"


def _filter_label(f: AnyFilter) -> str:
    if isinstance(f, PriceFilter):
        return f"Fiyat {f.op} {f.value}"
    if isinstance(f, VolumeFilter):
        suffix = "x avg" if f.relative else ""
        return f"Hacim {f.op} {f.value}{suffix}"
    if isinstance(f, ChangePctFilter):
        return f"Değişim% {f.op} {f.value}%"
    if isinstance(f, IndicatorFilter):
        period = f.params.get("period", "")
        label = f"{f.indicator.upper()}"
        if period:
            label += f"({period})"
        return f"{label} {f.op} {f.value}"
    if isinstance(f, CrossFilter):
        target_label = "close" if f.target == "close" else str(f.target)
        return f"{f.indicator.upper()} crosses {f.direction} {target_label}"
    if isinstance(f, HighLowFilter):
        return f"{f.bars}-bar {f.side} ±{f.pct_tolerance}%"
    return "Bilinmeyen filtre"
