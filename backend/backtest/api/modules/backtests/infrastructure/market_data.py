from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List,  Union, Optional, Any, Callable, Optional

import pandas as pd

from data_clients.bist_prices_client import BistPricesClient


class MarketDataGateway:
    def __init__(
        self,
        client: BistPricesClient,
        test_loader: Callable[[str, Optional[datetime], Optional[datetime], Optional[int]], pd.DataFrame],
    ) -> None:
        self._client = client
        self._test_loader = test_loader

    def load_candles_by_timeframe(
        self,
        symbol: str,
        timeframes: List[str],
        test_window_days: int,
        warmup_bars: int,
        now_utc: datetime,
    ) -> Dict[str, List[Dict[str, Union[float, int]]]]:
        unique_timeframes = sorted(set(timeframes))
        requests = {
            timeframe: build_timeframe_request(
                timeframe=timeframe,
                test_window_days=test_window_days,
                warmup_bars=warmup_bars,
                now_utc=now_utc,
            )
            for timeframe in unique_timeframes
        }

        if symbol != "TEST" and supports_hourly_bundle(self._client, unique_timeframes):
            return self._load_hourly_bundle(symbol, unique_timeframes, requests, now_utc)

        candles_by_timeframe: Dict[str, List[Dict[str, Union[float, int]]]] = {}
        for timeframe in unique_timeframes:
            request = requests[timeframe]
            if symbol == "TEST":
                df = self._test_loader(
                    timeframe=timeframe,
                    start=request["start"],
                    end=now_utc,
                    limit=request["limit"],
                )
            else:
                df = self._client.fetch_prices_timeframe(
                    ticker=symbol,
                    timeframe=timeframe,
                    start=request["start"],
                    end=now_utc,
                    limit=request["limit"],
                    canonicalize=True,
                )

            candles_by_timeframe[timeframe] = dataframe_to_candles(df)

        return candles_by_timeframe

    def _load_hourly_bundle(
        self,
        symbol: str,
        timeframes: List[str],
        requests: Dict[str, Dict[str, Any]],
        now_utc: datetime,
    ) -> Dict[str, List[Dict[str, Union[float, int]]]]:
        expanded_windows = [
            self._client.expand_hourly_query_window(timeframe, request["start"], now_utc)
            for timeframe, request in requests.items()
        ]
        base_starts = [start for start, _ in expanded_windows if start is not None]
        base_ends = [end for _, end in expanded_windows if end is not None]
        base_start = min(base_starts) if base_starts else None
        base_end = max(base_ends) if base_ends else now_utc

        hourly = self._client.fetch_hourly_base(
            ticker=symbol,
            start=base_start,
            end=base_end,
        )

        candles_by_timeframe: Dict[str, List[Dict[str, Union[float, int]]]] = {}
        for timeframe in timeframes:
            request = requests[timeframe]
            df = self._client.build_from_hourly_base(
                hourly=hourly,
                timeframe=timeframe,
                start=request["start"],
                end=now_utc,
                limit=request["limit"],
                canonicalize=True,
            )
            candles_by_timeframe[timeframe] = dataframe_to_candles(df)

        return candles_by_timeframe

    def load_candles_for_symbols(
        self,
        symbols: List[str],
        timeframes: List[str],
        test_window_days: int,
        warmup_bars: int,
        now_utc: datetime,
    ) -> Dict[str, Dict[str, List[Dict[str, Union[float, int]]]]]:
        unique_symbols = list(dict.fromkeys(symbols))
        unique_timeframes = sorted(set(timeframes))
        requests = {
            timeframe: build_timeframe_request(
                timeframe=timeframe,
                test_window_days=test_window_days,
                warmup_bars=warmup_bars,
                now_utc=now_utc,
            )
            for timeframe in unique_timeframes
        }

        if not supports_hourly_bundle(self._client, unique_timeframes) or not supports_multi_symbol_hourly_bundle(self._client):
            raise ValueError("Client mevcut timeframe seti icin toplu saatlik yuklemeyi desteklemiyor.")

        expanded_windows = [
            self._client.expand_hourly_query_window(timeframe, request["start"], now_utc)
            for timeframe, request in requests.items()
        ]
        base_starts = [start for start, _ in expanded_windows if start is not None]
        base_ends = [end for _, end in expanded_windows if end is not None]
        base_start = min(base_starts) if base_starts else None
        base_end = max(base_ends) if base_ends else now_utc

        hourly_frames = self._client.fetch_hourly_base_many(
            tickers=unique_symbols,
            start=base_start,
            end=base_end,
        )

        candles_by_symbol: Dict[str, Dict[str, List[Dict[str, Union[float, int]]]]] = {}
        for symbol in unique_symbols:
            hourly = hourly_frames.get(symbol)
            if hourly is None:
                hourly = pd.DataFrame()

            candles_by_symbol[symbol] = {}
            for timeframe in unique_timeframes:
                request = requests[timeframe]
                df = self._client.build_from_hourly_base(
                    hourly=hourly,
                    timeframe=timeframe,
                    start=request["start"],
                    end=now_utc,
                    limit=request["limit"],
                    canonicalize=True,
                )
                candles_by_symbol[symbol][timeframe] = dataframe_to_candles(df)

        return candles_by_symbol


def dataframe_to_candles(df: pd.DataFrame) -> List[Dict[str, Union[float, int]]]:
    if df.empty:
        return []

    candles: List[Dict[str, Union[float, int]]] = []
    ordered = df.sort_index()
    for row in ordered.itertuples(index=True):
        ts = row.Index
        timestamp = pd.Timestamp(ts)
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")

        candles.append(
            {
                "t": int(timestamp.timestamp()),
                "o": float(row.open),
                "h": float(row.high),
                "l": float(row.low),
                "c": float(row.close),
                "v": float(row.volume),
            }
        )

    return candles


def get_timeframe_seconds(tf: str) -> int:
    mapping = {
        "1m": 60,
        "3m": 180,
        "5m": 300,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
        "2h": 7200,
        "4h": 14400,
        "6h": 21600,
        "12h": 43200,
        "1d": 86400,
        "3d": 259200,
        "1w": 604800,
        "1M": 2592000,
    }
    return mapping.get(tf, 3600)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_timeframe_request(
    *,
    timeframe: str,
    test_window_days: int,
    warmup_bars: int,
    now_utc: datetime,
) -> Dict[str, Any]:
    tf_seconds = get_timeframe_seconds(timeframe)
    start = now_utc - timedelta(seconds=(test_window_days * 86400) + (warmup_bars * tf_seconds))
    limit = min(200_000, max(250, int(((now_utc - start).total_seconds() / tf_seconds)) + 10))
    return {
        "timeframe": timeframe,
        "seconds": tf_seconds,
        "start": start,
        "limit": limit,
    }


def supports_hourly_bundle(client: BistPricesClient, timeframes: List[str]) -> bool:
    checker = getattr(client, "supports_hourly_bundle", None)
    return bool(callable(checker) and checker(list(timeframes)))


def supports_multi_symbol_hourly_bundle(client: BistPricesClient) -> bool:
    loader = getattr(client, "fetch_hourly_base_many", None)
    builder = getattr(client, "build_from_hourly_base", None)
    expander = getattr(client, "expand_hourly_query_window", None)
    return bool(callable(loader) and callable(builder) and callable(expander))
