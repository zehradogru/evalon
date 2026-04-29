from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from data_clients.bist_prices_1h_client import BistPrices1HClient
from data_clients.bist_prices_client import BistPricesClient


class HybridBistPricesClient(BistPricesClient):
    """
    Uses the new 1h Oracle table for 1h-and-above candles, while keeping the old
    1m-based implementation intact for lower timeframes.
    """

    def __init__(
        self,
        user: Optional[str] = None,
        password: Optional[str] = None,
        dsn: Optional[str] = None,
        wallet_dir: Optional[str] = None,
        wallet_password: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> None:
        super().__init__(
            user=user,
            password=password,
            dsn=dsn,
            wallet_dir=wallet_dir,
            wallet_password=wallet_password,
            debug=debug,
        )
        self._hourly_client = BistPrices1HClient(
            user=user,
            password=password,
            dsn=dsn,
            wallet_dir=wallet_dir,
            wallet_password=wallet_password,
            debug=debug,
        )

    def init_pool(self, min: int = 1, max: int = 4, increment: int = 1) -> None:
        super().init_pool(min=min, max=max, increment=increment)
        self._hourly_client.init_pool(min=min, max=max, increment=increment)

    def close_pool(self) -> None:
        try:
            self._hourly_client.close_pool()
        finally:
            super().close_pool()

    def fetch_prices_timeframe(
        self,
        ticker: str,
        timeframe: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
        canonicalize: bool = True,
    ) -> pd.DataFrame:
        normalized_ticker = self._hourly_client.normalize_ticker(ticker)
        if self._hourly_client.supports_timeframe(timeframe):
            return self._hourly_client.fetch_prices_timeframe(
                ticker=normalized_ticker,
                timeframe=timeframe,
                start=start,
                end=end,
                limit=limit,
                canonicalize=canonicalize,
            )
        return super().fetch_prices_timeframe(
            ticker=normalized_ticker,
            timeframe=timeframe,
            start=start,
            end=end,
            limit=limit,
            canonicalize=canonicalize,
        )

    def supports_hourly_bundle(self, timeframes: list[str]) -> bool:
        return bool(timeframes) and all(self._hourly_client.supports_timeframe(timeframe) for timeframe in timeframes)

    def expand_hourly_query_window(
        self,
        timeframe: str,
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> tuple[Optional[datetime], Optional[datetime]]:
        return self._hourly_client.expand_query_window(timeframe, start, end)

    def fetch_hourly_base(
        self,
        ticker: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> pd.DataFrame:
        return self._hourly_client.fetch_hourly_base(
            ticker=ticker,
            start=start,
            end=end,
        )

    def fetch_hourly_base_many(
        self,
        tickers: list[str],
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, pd.DataFrame]:
        normalized_pairs = [
            (ticker, self._hourly_client.normalize_ticker(ticker))
            for ticker in tickers
        ]
        normalized_frames = self._hourly_client.fetch_hourly_base_many(
            tickers=[normalized for _, normalized in normalized_pairs],
            start=start,
            end=end,
        )
        return {
            ticker: normalized_frames.get(normalized, self._hourly_client._canonicalize(pd.DataFrame()))
            for ticker, normalized in normalized_pairs
        }

    def build_from_hourly_base(
        self,
        hourly: pd.DataFrame,
        timeframe: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
        canonicalize: bool = True,
    ) -> pd.DataFrame:
        return self._hourly_client.build_from_hourly_base(
            hourly=hourly,
            timeframe=timeframe,
            start=start,
            end=end,
            limit=limit,
            canonicalize=canonicalize,
        )

    def fetch_prices_bulk(
        self,
        tickers: list[str],
        timeframe: str = "1d",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
    ) -> dict[str, pd.DataFrame]:
        """Fetch OHLCV for multiple tickers in one Oracle round-trip, then resample.

        Uses ``fetch_hourly_base_many`` to issue a single ``IN (...)`` query, then
        resamples each ticker's hourly data to the requested timeframe. This is
        dramatically faster than N individual ``fetch_prices_timeframe`` calls.
        """
        if not tickers:
            return {}

        normalized_pairs = [
            (ticker, self._hourly_client.normalize_ticker(ticker))
            for ticker in tickers
        ]
        normalized_tickers = [normalized for _, normalized in normalized_pairs]

        query_start, query_end = self._hourly_client.expand_query_window(timeframe, start, end)

        hourly_data = self._hourly_client.fetch_hourly_base_many(
            tickers=normalized_tickers,
            start=query_start,
            end=query_end,
        )

        result: dict[str, pd.DataFrame] = {}
        for orig_ticker, normalized_ticker in normalized_pairs:
            hourly_df = hourly_data.get(normalized_ticker, pd.DataFrame())
            try:
                df = self._hourly_client.build_from_hourly_base(
                    hourly=hourly_df,
                    timeframe=timeframe,
                    start=start,
                    end=end,
                    limit=limit,
                )
            except Exception:
                df = pd.DataFrame()
            result[orig_ticker] = df

        return result
