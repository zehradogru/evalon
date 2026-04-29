from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from typing import Any

import pandas as pd

from data_clients.bist_prices_client import BistPricesClient


class CoMovementMarketDataGateway:
    def __init__(self, client: BistPricesClient) -> None:
        self._client = client

    def load_close_frames(
        self,
        *,
        symbols: list[str],
        start_date: datetime,
        end_date: datetime,
        timeframe: str = "1d",
    ) -> dict[str, pd.DataFrame]:
        if timeframe == "1d":
            return self._load_daily_close_frames(
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
            )

        self._ensure_hourly_bundle_support()

        query_start, query_end = self._expand_query_window(timeframe, start_date, end_date)
        hourly_frames = self._client.fetch_hourly_base_many(
            tickers=symbols,
            start=query_start,
            end=query_end,
        )

        frames: dict[str, pd.DataFrame] = {}
        for symbol in symbols:
            hourly = hourly_frames.get(symbol)
            if hourly is None:
                hourly = self._empty_hourly_frame()

            frames[symbol] = self._client.build_from_hourly_base(
                hourly=hourly,
                timeframe=timeframe,
                start=start_date,
                end=end_date,
                canonicalize=True,
            )

        return frames

    def _load_daily_close_frames(
        self,
        *,
        symbols: list[str],
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, pd.DataFrame]:
        table_name = self._resolve_hourly_table_name()
        normalize_ticker = self._resolve_ticker_normalizer()
        normalized_symbols = [normalize_ticker(symbol) for symbol in symbols]
        grouped_rows: dict[str, list[tuple[Any, ...]]] = {symbol: [] for symbol in normalized_symbols}

        for chunk in self._chunked(normalized_symbols, size=300):
            placeholder_names = [f"ticker_{index}" for index in range(len(chunk))]
            sql = [
                "SELECT",
                "  TICKER,",
                "  TRUNC(PRICE_DATETIME) AS PRICE_DATETIME,",
                "  MIN(OPEN_PRICE) KEEP (DENSE_RANK FIRST ORDER BY PRICE_DATETIME) AS OPEN_PRICE,",
                "  MAX(HIGH_PRICE) AS HIGH_PRICE,",
                "  MIN(LOW_PRICE) AS LOW_PRICE,",
                "  MAX(CLOSE_PRICE) KEEP (DENSE_RANK LAST ORDER BY PRICE_DATETIME) AS CLOSE_PRICE,",
                "  SUM(VOLUME) AS VOLUME",
                f"FROM {table_name}",
                f"WHERE TICKER IN ({', '.join(f':{name}' for name in placeholder_names)})",
                "AND PRICE_DATETIME >= :start_dt",
                "AND PRICE_DATETIME < :end_dt",
                "GROUP BY TICKER, TRUNC(PRICE_DATETIME)",
                "ORDER BY TICKER, PRICE_DATETIME",
            ]
            params: dict[str, object] = {
                name: ticker
                for name, ticker in zip(placeholder_names, chunk, strict=False)
            }
            params["start_dt"] = start_date
            params["end_dt"] = end_date

            with self._client._connect() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("\n".join(sql), params)
                    rows = cursor.fetchall()

            for row in rows:
                grouped_rows[str(row[0])].append(row)

        frames: dict[str, pd.DataFrame] = {}
        for original_symbol, normalized_symbol in zip(symbols, normalized_symbols, strict=False):
            rows = grouped_rows.get(normalized_symbol, [])
            if not rows:
                frames[original_symbol] = self._empty_hourly_frame()
                continue

            frame = pd.DataFrame(
                rows,
                columns=[
                    "ticker",
                    "price_datetime",
                    "open_price",
                    "high_price",
                    "low_price",
                    "close_price",
                    "volume",
                ],
            )
            frames[original_symbol] = self._canonicalize_like_hourly_client(frame)

        return frames

    @lru_cache(maxsize=1)
    def list_available_symbols(self) -> list[str]:
        table_name = self._resolve_hourly_table_name()
        query = f"SELECT TICKER FROM {table_name} GROUP BY TICKER ORDER BY TICKER"
        with self._client._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
        return [str(row[0]) for row in rows if row and row[0]]

    def search_symbols(self, *, search: str = "", limit: int = 100) -> dict[str, Any]:
        all_symbols = self.list_available_symbols()
        keyword = search.strip().upper()
        filtered = [symbol for symbol in all_symbols if keyword in symbol] if keyword else all_symbols
        selected = filtered[:limit]
        return {
            "count": len(selected),
            "total_available": len(all_symbols),
            "search": search,
            "symbols": [{"symbol": symbol} for symbol in selected],
        }

    def get_available_date_range(self) -> dict[str, str]:
        table_name = self._resolve_hourly_table_name()
        query = f"SELECT MIN(PRICE_DATETIME), MAX(PRICE_DATETIME) FROM {table_name}"
        with self._client._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                min_value, max_value = cursor.fetchone()
        if min_value is None or max_value is None:
            raise ValueError("Saatlik veri tablosunda tarih araligi bulunamadi.")
        return {
            "start": pd.Timestamp(min_value).date().isoformat(),
            "end": pd.Timestamp(max_value).date().isoformat(),
        }

    def to_date_window(self, start: datetime, end: datetime) -> tuple[datetime, datetime]:
        if end < start:
            raise ValueError("end_date start_date'den once olamaz.")
        return start, end

    def build_daily_window(self, start_date: date, end_date: date) -> tuple[datetime, datetime]:
        start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end_dt = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        return self.to_date_window(start_dt, end_dt)

    def _ensure_hourly_bundle_support(self) -> None:
        fetch_many = getattr(self._client, "fetch_hourly_base_many", None)
        build_many = getattr(self._client, "build_from_hourly_base", None)
        expand_many = getattr(self._client, "expand_hourly_query_window", None)
        if not callable(fetch_many) or not callable(build_many) or not callable(expand_many):
            raise ValueError("Bu modül 1h Oracle bundle destekleyen istemci gerektirir.")

    def _expand_query_window(
        self,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> tuple[datetime | None, datetime | None]:
        expander = getattr(self._client, "expand_hourly_query_window", None)
        if not callable(expander):
            return start, end
        return expander(timeframe, start, end)

    def _resolve_hourly_table_name(self) -> str:
        hourly_client = getattr(self._client, "_hourly_client", None)
        table_name = getattr(hourly_client, "_table_name", None)
        if table_name:
            return str(table_name)
        return "BIST_PRICES_1H"

    def _resolve_ticker_normalizer(self):
        hourly_client = getattr(self._client, "_hourly_client", None)
        normalizer = getattr(hourly_client, "normalize_ticker", None)
        if callable(normalizer):
            return normalizer

        def fallback(ticker: str) -> str:
            value = str(ticker).strip().upper()
            if value.endswith(".IS"):
                value = value[:-3]
            return "".join(char for char in value if char.isalnum() or char == "_")

        return fallback

    def _canonicalize_like_hourly_client(self, df: pd.DataFrame) -> pd.DataFrame:
        hourly_client = getattr(self._client, "_hourly_client", None)
        canonicalize = getattr(hourly_client, "_canonicalize", None)
        if callable(canonicalize):
            return canonicalize(df)
        raise ValueError("Saatlik istemcide canonicalize yardimcisi bulunamadi.")

    @staticmethod
    def _empty_hourly_frame() -> pd.DataFrame:
        empty = pd.DataFrame(columns=["ticker", "open", "high", "low", "close", "volume"])
        empty.index = pd.DatetimeIndex([], name="price_datetime")
        return empty

    @staticmethod
    def _chunked(items: list[str], size: int) -> list[list[str]]:
        return [items[index:index + size] for index in range(0, len(items), size)]
