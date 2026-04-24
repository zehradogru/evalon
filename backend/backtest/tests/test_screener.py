"""Tests for screener_filters.py — no Oracle needed."""
from __future__ import annotations

import pytest

from api.screener_filters import (
    BarData,
    ChangePctFilter,
    CrossFilter,
    HighLowFilter,
    IndicatorFilter,
    PriceFilter,
    VolumeFilter,
    _cmp,
    _indicator_cache_key,
    evaluate_filter,
    evaluate_filters,
)


# ---------------------------------------------------------------------------
# _cmp
# ---------------------------------------------------------------------------

def test_cmp_gt():
    assert _cmp(10.0, "gt", 5.0) is True
    assert _cmp(5.0, "gt", 5.0) is False


def test_cmp_gte():
    assert _cmp(5.0, "gte", 5.0) is True
    assert _cmp(4.9, "gte", 5.0) is False


def test_cmp_lt():
    assert _cmp(3.0, "lt", 5.0) is True
    assert _cmp(5.0, "lt", 5.0) is False


def test_cmp_lte():
    assert _cmp(5.0, "lte", 5.0) is True


def test_cmp_between():
    assert _cmp(7.0, "between", 5.0, 10.0) is True
    assert _cmp(4.9, "between", 5.0, 10.0) is False
    assert _cmp(10.1, "between", 5.0, 10.0) is False


# ---------------------------------------------------------------------------
# PriceFilter
# ---------------------------------------------------------------------------

def _make_bar(**kwargs) -> BarData:
    defaults = dict(
        close=100.0,
        open=98.0,
        high=102.0,
        low=97.0,
        volume=1_000_000.0,
        change_pct=2.0,
        avg_volume=800_000.0,
    )
    defaults.update(kwargs)
    return BarData(**defaults)


def test_price_filter_passes():
    f = PriceFilter(type="price", op="gt", value=50.0)
    assert evaluate_filter(f, _make_bar(close=100.0)) is True


def test_price_filter_fails():
    f = PriceFilter(type="price", op="gt", value=150.0)
    assert evaluate_filter(f, _make_bar(close=100.0)) is False


def test_price_filter_between():
    f = PriceFilter(type="price", op="between", value=90.0, value2=110.0)
    assert evaluate_filter(f, _make_bar(close=100.0)) is True
    assert evaluate_filter(f, _make_bar(close=80.0)) is False


def test_price_filter_between_missing_value2():
    with pytest.raises(ValueError):
        PriceFilter(type="price", op="between", value=90.0)


# ---------------------------------------------------------------------------
# VolumeFilter
# ---------------------------------------------------------------------------

def test_volume_filter_absolute():
    f = VolumeFilter(type="volume", op="gt", value=500_000.0)
    assert evaluate_filter(f, _make_bar(volume=1_000_000.0)) is True


def test_volume_filter_relative():
    # volume=1_000_000, avg=800_000 → ratio≈1.25
    f = VolumeFilter(type="volume", op="gt", value=1.0, relative=True)
    assert evaluate_filter(f, _make_bar(volume=1_000_000.0, avg_volume=800_000.0)) is True


def test_volume_filter_relative_fails():
    # volume=600_000, avg=800_000 → ratio=0.75 < 1.0
    f = VolumeFilter(type="volume", op="gt", value=1.0, relative=True)
    assert evaluate_filter(f, _make_bar(volume=600_000.0, avg_volume=800_000.0)) is False


# ---------------------------------------------------------------------------
# ChangePctFilter
# ---------------------------------------------------------------------------

def test_change_pct_filter():
    f = ChangePctFilter(type="change_pct", op="gt", value=1.0)
    assert evaluate_filter(f, _make_bar(change_pct=2.0)) is True
    assert evaluate_filter(f, _make_bar(change_pct=0.5)) is False


def test_change_pct_negative():
    f = ChangePctFilter(type="change_pct", op="lt", value=0.0)
    assert evaluate_filter(f, _make_bar(change_pct=-1.5)) is True
    assert evaluate_filter(f, _make_bar(change_pct=0.1)) is False


# ---------------------------------------------------------------------------
# IndicatorFilter
# ---------------------------------------------------------------------------

def test_indicator_filter_passes():
    cache_key = _indicator_cache_key("rsi", {}, "value")
    bar = _make_bar()
    bar.indicators[cache_key] = 35.0
    f = IndicatorFilter(type="indicator", indicator="rsi", op="lt", value=40.0)
    assert evaluate_filter(f, bar) is True


def test_indicator_filter_missing_returns_false():
    bar = _make_bar()
    f = IndicatorFilter(type="indicator", indicator="rsi", op="lt", value=40.0)
    # No indicator in cache
    assert evaluate_filter(f, bar) is False


def test_indicator_filter_with_period():
    cache_key = _indicator_cache_key("sma", {"period": 20}, "value")
    bar = _make_bar()
    bar.indicators[cache_key] = 95.0
    f = IndicatorFilter(
        type="indicator", indicator="sma", params={"period": 20}, op="lt", value=100.0
    )
    assert evaluate_filter(f, bar) is True


# ---------------------------------------------------------------------------
# CrossFilter
# ---------------------------------------------------------------------------

def test_cross_above_detected():
    key = _indicator_cache_key("rsi", {}, "value")
    bar = _make_bar()
    bar.indicators[key] = 32.0        # current: above 30
    bar.indicators[key + "__prev"] = 28.0  # previous: below 30
    f = CrossFilter(type="cross", indicator="rsi", direction="above", target=30.0)
    assert evaluate_filter(f, bar) is True


def test_cross_below_detected():
    key = _indicator_cache_key("rsi", {}, "value")
    bar = _make_bar()
    bar.indicators[key] = 68.0        # current: below 70
    bar.indicators[key + "__prev"] = 72.0  # previous: above 70
    f = CrossFilter(type="cross", indicator="rsi", direction="below", target=70.0)
    assert evaluate_filter(f, bar) is True


def test_cross_not_detected_no_cross():
    key = _indicator_cache_key("rsi", {}, "value")
    bar = _make_bar()
    bar.indicators[key] = 50.0
    bar.indicators[key + "__prev"] = 45.0
    # Both above 30, no cross
    f = CrossFilter(type="cross", indicator="rsi", direction="above", target=30.0)
    assert evaluate_filter(f, bar) is False


def test_cross_missing_prev_returns_false():
    key = _indicator_cache_key("rsi", {}, "value")
    bar = _make_bar()
    bar.indicators[key] = 32.0
    # no __prev key
    f = CrossFilter(type="cross", indicator="rsi", direction="above", target=30.0)
    assert evaluate_filter(f, bar) is False


# ---------------------------------------------------------------------------
# HighLowFilter
# ---------------------------------------------------------------------------

def test_high_low_filter_near_high():
    bar = _make_bar(close=99.5)
    bar.extremes["high_20"] = 100.0
    f = HighLowFilter(type="high_low", side="high", bars=20, pct_tolerance=1.0)
    # distance = 0.5% → within 1%
    assert evaluate_filter(f, bar) is True


def test_high_low_filter_far_from_high():
    bar = _make_bar(close=90.0)
    bar.extremes["high_20"] = 100.0
    f = HighLowFilter(type="high_low", side="high", bars=20, pct_tolerance=5.0)
    # distance = 10% → outside 5%
    assert evaluate_filter(f, bar) is False


# ---------------------------------------------------------------------------
# evaluate_filters (AND / OR logic)
# ---------------------------------------------------------------------------

def test_evaluate_and_all_pass():
    f1 = PriceFilter(type="price", op="gt", value=50.0)
    f2 = ChangePctFilter(type="change_pct", op="gt", value=1.0)
    bar = _make_bar(close=100.0, change_pct=2.0)
    result = evaluate_filters([f1, f2], bar, logic="AND")
    assert len(result) == 2


def test_evaluate_and_one_fails():
    f1 = PriceFilter(type="price", op="gt", value=50.0)
    f2 = ChangePctFilter(type="change_pct", op="gt", value=5.0)  # fails (2.0 > 5.0)
    bar = _make_bar(close=100.0, change_pct=2.0)
    result = evaluate_filters([f1, f2], bar, logic="AND")
    assert result == []


def test_evaluate_or_one_passes():
    f1 = PriceFilter(type="price", op="gt", value=200.0)  # fails
    f2 = ChangePctFilter(type="change_pct", op="gt", value=1.0)  # passes
    bar = _make_bar(close=100.0, change_pct=2.0)
    result = evaluate_filters([f1, f2], bar, logic="OR")
    assert len(result) == 1


def test_evaluate_or_none_pass():
    f1 = PriceFilter(type="price", op="gt", value=200.0)
    f2 = ChangePctFilter(type="change_pct", op="gt", value=5.0)
    bar = _make_bar(close=100.0, change_pct=2.0)
    result = evaluate_filters([f1, f2], bar, logic="OR")
    assert result == []


def test_evaluate_empty_filters():
    bar = _make_bar()
    # empty filter list → always AND: 0 matched == 0 total → passes
    result = evaluate_filters([], bar, logic="AND")
    assert result == []
