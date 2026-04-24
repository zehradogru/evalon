"""
Screener / Scanner Service for BIST.

Endpoint: POST /v1/screener/scan
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.screener_filters import (
    AnyFilter,
    BarData,
    ChangePctFilter,
    CrossFilter,
    HighLowFilter,
    IndicatorFilter,
    VolumeFilter,
    _indicator_cache_key,
    evaluate_filters,
)
from api.talib_indicators import TalibUnavailableError, build_indicator_series, normalize_indicator_key

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static sector / ticker data
# ---------------------------------------------------------------------------

_SECTORS_PATH = Path(__file__).parent / "static" / "bist_sectors.json"


@lru_cache(maxsize=1)
def _load_sectors() -> Dict[str, str]:
    """Returns {TICKER: sector_name}. Cached for the process lifetime."""
    if _SECTORS_PATH.is_file():
        with _SECTORS_PATH.open(encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def get_all_tickers() -> List[Dict[str, str]]:
    """Return [{ticker, sector}] sorted by ticker."""
    sectors = _load_sectors()
    return [{"ticker": t, "sector": s} for t, s in sorted(sectors.items())]


def get_sector_list() -> List[str]:
    sectors = _load_sectors()
    unique = sorted(set(sectors.values()))
    return unique


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

SUPPORTED_TIMEFRAMES = {"1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"}

FilterPayload = Dict[str, Any]


class ScanRequest(BaseModel):
    """POST /v1/screener/scan body."""

    # Ticker selection: 'all' or an explicit list.
    tickers: Union[Literal["all"], List[str]] = "all"

    # Filter by sector(s) — names from bist_sectors.json
    sectors: Optional[List[str]] = None

    # Timeframe for OHLCV data fetch
    timeframe: str = Field("1d", description="e.g. 1d, 1h, 4h, 1w")

    # How many recent bars to use (lookback)
    lookback_bars: int = Field(100, ge=10, le=500)

    # Filters list — each item is a dict that maps to one of the AnyFilter discriminated union models.
    # We accept raw dicts and parse them manually so the API stays clean.
    filters: List[Dict[str, Any]] = Field(default_factory=list)

    # AND = all filters must match; OR = any filter must match
    logic: Literal["AND", "OR"] = "AND"

    # Result controls
    limit: int = Field(200, ge=1, le=1000)
    sort_by: str = Field(
        "change_pct",
        description="close|change_pct|volume|vol_ratio|ticker or any indicator key",
    )
    sort_dir: Literal["asc", "desc"] = "desc"


class ScanResultRow(BaseModel):
    ticker: str
    sector: str
    close: float
    open: float
    high: float
    low: float
    change_pct: float
    volume: float
    avg_volume: float
    vol_ratio: float
    indicators: Dict[str, Optional[float]]
    matched_filters: List[str]


class ScanResponse(BaseModel):
    scanned_at: str
    total_scanned: int
    matched: int
    elapsed_ms: float
    errors: List[Dict[str, str]]
    rows: List[ScanResultRow]


# ---------------------------------------------------------------------------
# Indicator value extraction helpers
# ---------------------------------------------------------------------------

_MULTI_OUTPUT_MAP: Dict[str, List[str]] = {
    "bbands": ["upper", "middle", "lower"],
    "macd": ["macd", "signal", "hist"],
    "stoch": ["k", "d"],
    "stochrsi": ["k", "d"],
    "aroon": ["up", "down"],
}


def _extract_last_values(
    series_list: List[Dict[str, Any]],
    indicator_key: str,
) -> Dict[str, Optional[float]]:
    """
    Given build_indicator_series() output, extract the last non-NaN value
    for each line.  Returns {output_key: float|None}.
    """
    named = _MULTI_OUTPUT_MAP.get(indicator_key, ["value"])

    result: Dict[str, Optional[float]] = {}

    for i, series in enumerate(series_list):
        out_key = named[i] if i < len(named) else f"line{i}"
        data = series.get("data", [])

        val: Optional[float] = None
        for point in reversed(data):
            v = point.get("value") if isinstance(point, dict) else None
            if v is not None and not (isinstance(v, float) and np.isnan(v)):
                val = float(v)
                break

        result[out_key] = val

    return result


# ---------------------------------------------------------------------------
# Single-ticker scan helper (runs in thread)
# ---------------------------------------------------------------------------

def _scan_ticker(
    ticker: str,
    sector: str,
    timeframe: str,
    lookback_bars: int,
    parsed_filters: List[AnyFilter],
    logic: Literal["AND", "OR"],
    price_client: Any,
    indicator_ids: List[str],
    indicator_params_list: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Fetch price data, compute indicators, evaluate filters.
    Returns a result dict or None on error / no-match.
    """
    try:
        df = price_client.fetch_prices_timeframe(
            ticker=ticker,
            timeframe=timeframe,
            limit=lookback_bars,
            canonicalize=True,
        )
    except Exception as exc:
        raise RuntimeError(f"{ticker}: fetch failed — {exc}") from exc

    if df is None or df.empty or len(df) < 2:
        return None  # not enough data, skip silently

    close_arr = df["close"].astype(float).values
    volume_arr = df["volume"].astype(float).values

    last_close = float(close_arr[-1])
    last_open = float(df["open"].iloc[-1])
    last_high = float(df["high"].iloc[-1])
    last_low = float(df["low"].iloc[-1])
    last_vol = float(volume_arr[-1])
    prev_close = float(close_arr[-2])
    change_pct = (last_close - prev_close) / prev_close * 100 if prev_close != 0 else 0.0
    avg_vol = float(np.mean(volume_arr[:-1])) if len(volume_arr) > 1 else last_vol
    vol_ratio = last_vol / avg_vol if avg_vol > 0 else 1.0

    # --- Build BarData with indicator values ---
    bar = BarData(
        close=last_close,
        open=last_open,
        high=last_high,
        low=last_low,
        volume=last_vol,
        change_pct=change_pct,
        avg_volume=avg_vol,
    )

    # Compute requested indicators
    indicator_values: Dict[str, Optional[float]] = {}

    for ind_id, ind_params in zip(indicator_ids, indicator_params_list):
        try:
            key = normalize_indicator_key(ind_id)
            series_list = build_indicator_series(df, key, ind_params)
            last_vals = _extract_last_values(series_list, key)

            for out_key, val in last_vals.items():
                cache_key = _indicator_cache_key(ind_id, ind_params, out_key)
                bar.indicators[cache_key] = val  # type: ignore[assignment]

                # Prev bar value (for cross detection)
                # Extract second-to-last non-NaN value
                if val is not None:
                    try:
                        second_last = _extract_second_last(series_list, out_key)
                        if second_last is not None:
                            bar.indicators[cache_key + "__prev"] = second_last  # type: ignore[assignment]
                    except Exception:
                        pass

                # Expose with friendlier key for response: {ind_id}_{out_key}
                resp_key = f"{ind_id}_{out_key}" if out_key != "value" else ind_id
                indicator_values[resp_key] = val

        except (TalibUnavailableError, ValueError):
            pass
        except Exception as exc:
            log.debug("Indicator error %s/%s: %s", ticker, ind_id, exc)

    # Compute high/low extremes for HighLow filters
    for f in parsed_filters:
        if isinstance(f, HighLowFilter):
            ekey = f"{f.side}_{f.bars}"
            if ekey not in bar.extremes:
                window = df.tail(f.bars)
                if f.side == "high":
                    bar.extremes[ekey] = float(window["high"].max())
                else:
                    bar.extremes[ekey] = float(window["low"].min())

    # --- Evaluate filters ---
    if not parsed_filters:
        # no filters = return all tickers
        matched = []
    else:
        matched = evaluate_filters(parsed_filters, bar, logic)
        if not matched:
            return None  # does not pass

    return {
        "ticker": ticker,
        "sector": sector,
        "close": last_close,
        "open": last_open,
        "high": last_high,
        "low": last_low,
        "change_pct": change_pct,
        "volume": last_vol,
        "avg_volume": avg_vol,
        "vol_ratio": round(vol_ratio, 2),
        "indicators": indicator_values,
        "matched_filters": matched,
    }


def _extract_second_last(series_list: List[Dict[str, Any]], output_key: str) -> Optional[float]:
    named = _MULTI_OUTPUT_MAP
    for i, series in enumerate(series_list):
        ind_name = series.get("name", "")
        # Find the right series by position matching output_key
        data = series.get("data", [])
        count = 0
        for point in reversed(data):
            v = point.get("value") if isinstance(point, dict) else None
            if v is not None and not (isinstance(v, float) and np.isnan(v)):
                count += 1
                if count == 2:
                    return float(v)
    return None


# ---------------------------------------------------------------------------
# Parse filters from raw dicts
# ---------------------------------------------------------------------------

from pydantic import TypeAdapter

_filter_adapter: TypeAdapter[AnyFilter] = TypeAdapter(AnyFilter)


def _parse_filter(raw: Dict[str, Any]) -> AnyFilter:
    return _filter_adapter.validate_python(raw)


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------

_THREAD_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="screener")


def create_screener_router(price_client: Any) -> APIRouter:
    router = APIRouter(prefix="/v1/screener", tags=["screener"])

    @router.get("/tickers")
    def list_tickers(
        q: Optional[str] = None,
        sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        all_tickers = get_all_tickers()
        filtered = all_tickers

        if sector:
            sector_lower = sector.lower()
            filtered = [t for t in filtered if t["sector"].lower() == sector_lower]

        if q:
            q_lower = q.lower()
            filtered = [t for t in filtered if q_lower in t["ticker"].lower()]

        sectors = get_sector_list()
        return {
            "count": len(filtered),
            "tickers": filtered,
            "sectors": sectors,
        }

    @router.post("/scan", response_model=ScanResponse)
    async def scan(body: ScanRequest) -> ScanResponse:
        t0 = time.time()
        sectors_map = _load_sectors()

        # --- Resolve ticker list ---
        if body.tickers == "all":
            ticker_list = list(sectors_map.keys())
        else:
            ticker_list = [t.upper().strip() for t in body.tickers if t.strip()]

        # Filter by sector
        if body.sectors:
            sectors_lower = {s.lower() for s in body.sectors}
            ticker_list = [
                t for t in ticker_list
                if sectors_map.get(t, "").lower() in sectors_lower
            ]

        if not ticker_list:
            raise HTTPException(status_code=400, detail="No tickers to scan.")

        # Validate timeframe
        if body.timeframe not in SUPPORTED_TIMEFRAMES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported timeframe '{body.timeframe}'. Use: {sorted(SUPPORTED_TIMEFRAMES)}",
            )

        # Parse filters
        parsed_filters: List[AnyFilter] = []
        for i, raw in enumerate(body.filters):
            try:
                parsed_filters.append(_parse_filter(raw))
            except Exception as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"Filter #{i} validation error: {exc}",
                ) from exc

        # Collect unique indicator ids needed from filters (for efficient batch loading)
        indicator_ids: List[str] = []
        indicator_params_list: List[Dict[str, Any]] = []
        seen_indicators: set = set()

        for f in parsed_filters:
            if isinstance(f, (IndicatorFilter, CrossFilter)):
                key = _indicator_cache_key(f.indicator, f.params, f.output_key)
                if key not in seen_indicators:
                    seen_indicators.add(key)
                    indicator_ids.append(f.indicator)
                    indicator_params_list.append(f.params)

        # --- Run per-ticker scan in thread pool ---
        loop = asyncio.get_event_loop()
        errors: List[Dict[str, str]] = []
        raw_results: List[Optional[Dict[str, Any]]] = []

        async def _run_one(ticker: str) -> Optional[Dict[str, Any]]:
            sector = sectors_map.get(ticker, "Diğer")
            try:
                result = await loop.run_in_executor(
                    _THREAD_POOL,
                    _scan_ticker,
                    ticker,
                    sector,
                    body.timeframe,
                    body.lookback_bars,
                    parsed_filters,
                    body.logic,
                    price_client,
                    indicator_ids,
                    indicator_params_list,
                )
                return result
            except Exception as exc:
                errors.append({"ticker": ticker, "error": str(exc)})
                return None

        # Batch with semaphore to avoid overwhelming Oracle pool
        sem = asyncio.Semaphore(8)

        async def _run_with_sem(ticker: str) -> Optional[Dict[str, Any]]:
            async with sem:
                return await _run_one(ticker)

        tasks = [_run_with_sem(t) for t in ticker_list]
        raw_results = await asyncio.gather(*tasks)

        # Filter None results
        rows = [ScanResultRow(**r) for r in raw_results if r is not None]

        # Sort
        def _sort_key(row: ScanResultRow) -> float:
            val = getattr(row, body.sort_by, None)
            if val is None:
                # Try indicators dict
                val = row.indicators.get(body.sort_by)
            if val is None:
                return float("-inf") if body.sort_dir == "desc" else float("inf")
            return float(val)

        rows.sort(key=_sort_key, reverse=(body.sort_dir == "desc"))
        rows = rows[: body.limit]

        elapsed_ms = (time.time() - t0) * 1000

        from datetime import datetime, timezone
        return ScanResponse(
            scanned_at=datetime.now(timezone.utc).isoformat(),
            total_scanned=len(ticker_list),
            matched=len(rows),
            elapsed_ms=round(elapsed_ms, 1),
            errors=errors[:50],  # cap error list
            rows=rows,
        )

    return router
