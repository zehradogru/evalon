from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from dotenv import load_dotenv

from data_clients.bist_prices_client import BistPricesClient


DEFAULT_1H_WALLET_DIR = "/Users/aliberkyesilduman/borsa-1/oracle_wallet"


@dataclass(frozen=True)
class HourlyTimeframeSpec:
    timeframe: str
    pandas_rule: str
    bucket_seconds: int
    direct_table: bool


class BistPrices1HClient(BistPricesClient):
    def __init__(
        self,
        user: Optional[str] = None,
        password: Optional[str] = None,
        dsn: Optional[str] = None,
        wallet_dir: Optional[str] = None,
        wallet_password: Optional[str] = None,
        debug: Optional[bool] = None,
        table_name: Optional[str] = None,
    ) -> None:
        load_dotenv()
        resolved_wallet_dir = wallet_dir or self._resolve_wallet_dir()
        resolved_password = (
            wallet_password
            or os.environ.get("ORACLE_1H_WALLET_PASSWORD")
            or os.environ.get("ORACLE_WALLET_PASSWORD")
            or password
            or os.environ.get("ORACLE_1H_DB_PASSWORD")
            or os.environ.get("ORACLE_DB_PASSWORD")
            or None
        )
        super().__init__(
            user=user or os.environ.get("ORACLE_1H_DB_USER") or os.environ.get("ORACLE_DB_USER", "ADMIN"),
            password=password or os.environ.get("ORACLE_1H_DB_PASSWORD") or os.environ.get("ORACLE_DB_PASSWORD", ""),
            dsn=dsn or os.environ.get("ORACLE_1H_DB_DSN") or os.environ.get("ORACLE_DB_DSN", "evalondb_high"),
            wallet_dir=resolved_wallet_dir,
            wallet_password=resolved_password,
            debug=debug,
        )
        self._table_name = table_name or os.environ.get("ORACLE_1H_TABLE", "BIST_PRICES_1H")

    def supports_timeframe(self, timeframe: str) -> bool:
        try:
            self._parse_timeframe(timeframe)
            return True
        except ValueError:
            return False

    def fetch_prices_timeframe(
        self,
        ticker: str,
        timeframe: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
        canonicalize: bool = True,
    ) -> pd.DataFrame:
        spec = self._parse_timeframe(timeframe)
        normalized_ticker = self.normalize_ticker(ticker)
        query_start, query_end = self._expand_query_window(start, end, spec)
        source_limit = self._derive_source_limit(limit, spec, query_start, query_end)

        hourly = self._fetch_hourly_rows(
            ticker=normalized_ticker,
            start=query_start,
            end=query_end,
            limit=source_limit,
        )

        if spec.direct_table:
            result = hourly
        else:
            result = self._resample(hourly, spec)
            result = self._filter_output_window(result, start, end, spec)

        if limit is not None:
            result = result.tail(int(limit))

        if canonicalize:
            return result
        return self._decanonicalize(result)

    def expand_query_window(
        self,
        timeframe: str,
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> tuple[Optional[datetime], Optional[datetime]]:
        spec = self._parse_timeframe(timeframe)
        return self._expand_query_window(start, end, spec)

    def fetch_hourly_base(
        self,
        ticker: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> pd.DataFrame:
        normalized_ticker = self.normalize_ticker(ticker)
        return self._fetch_hourly_rows(
            ticker=normalized_ticker,
            start=start,
            end=end,
            limit=None,
        )

    def fetch_hourly_base_many(
        self,
        tickers: list[str],
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, pd.DataFrame]:
        normalized_tickers = []
        seen: set[str] = set()
        for ticker in tickers:
            normalized = self.normalize_ticker(ticker)
            if not normalized or normalized in seen:
                continue
            normalized_tickers.append(normalized)
            seen.add(normalized)

        if not normalized_tickers:
            return {}

        placeholder_names = [f"ticker_{index}" for index in range(len(normalized_tickers))]
        sql = [
            "SELECT TICKER, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME",
            f"FROM {self._table_name}",
            f"WHERE TICKER IN ({', '.join(f':{name}' for name in placeholder_names)})",
        ]
        params: dict[str, object] = {
            name: ticker
            for name, ticker in zip(placeholder_names, normalized_tickers, strict=False)
        }

        if start is not None:
            sql.append("AND PRICE_DATETIME >= :start_dt")
            params["start_dt"] = start
        if end is not None:
            sql.append("AND PRICE_DATETIME <= :end_dt")
            params["end_dt"] = end

        sql.append("ORDER BY TICKER, PRICE_DATETIME")
        query = "\n".join(sql)

        with self._connect() as conn:
            with conn.cursor() as cur:
                self._log(f"Executing 1h batch query for {len(normalized_tickers)} tickers...")
                cur.execute(query, params)
                columns = [col[0].lower() for col in cur.description]
                rows = cur.fetchall()

        if not rows:
            return {ticker: self._canonicalize(pd.DataFrame()) for ticker in normalized_tickers}

        raw_df = pd.DataFrame(rows, columns=columns)
        grouped_raw = {
            str(group_ticker): group.copy()
            for group_ticker, group in raw_df.groupby("ticker", sort=False)
        }
        return {
            ticker: self._canonicalize(grouped_raw.get(ticker, pd.DataFrame()))
            for ticker in normalized_tickers
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
        spec = self._parse_timeframe(timeframe)

        if spec.direct_table:
            result = self._filter_output_window(hourly, start, end, spec)
        else:
            result = self._resample(hourly, spec)
            result = self._filter_output_window(result, start, end, spec)

        if limit is not None:
            result = result.tail(int(limit))

        if canonicalize:
            return result
        return self._decanonicalize(result)

    def normalize_ticker(self, ticker: str) -> str:
        value = str(ticker).strip().upper()
        if value.endswith(".IS"):
            value = value[:-3]
        return "".join(ch for ch in value if ch.isalnum())

    def _resolve_wallet_dir(self) -> str:
        candidates = [
            os.environ.get("ORACLE_1H_WALLET_DIR"),
            os.environ.get("ORACLE_WALLET_DIR"),
            DEFAULT_1H_WALLET_DIR,
            str(Path(__file__).resolve().parent / "wallet"),
        ]
        for candidate in candidates:
            if candidate and Path(candidate).is_dir():
                return candidate
        return str(Path(__file__).resolve().parent / "wallet")

    def _fetch_hourly_rows(
        self,
        ticker: str,
        start: Optional[datetime],
        end: Optional[datetime],
        limit: Optional[int],
    ) -> pd.DataFrame:
        sql = [
            "SELECT TICKER, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME",
            f"FROM {self._table_name}",
            "WHERE TICKER = :ticker",
        ]
        params: dict[str, object] = {"ticker": ticker}

        if start is not None:
            sql.append("AND PRICE_DATETIME >= :start_dt")
            params["start_dt"] = start
        if end is not None:
            sql.append("AND PRICE_DATETIME <= :end_dt")
            params["end_dt"] = end

        apply_limit_in_sql = limit is not None and start is None and end is None
        sql.append("ORDER BY PRICE_DATETIME DESC" if apply_limit_in_sql else "ORDER BY PRICE_DATETIME")
        if apply_limit_in_sql:
            sql.append("FETCH FIRST :limit_rows ROWS ONLY")
            params["limit_rows"] = int(limit)

        query = "\n".join(sql)
        with self._connect() as conn:
            with conn.cursor() as cur:
                self._log("Executing 1h source query...")
                cur.execute(query, params)
                columns = [col[0].lower() for col in cur.description]
                rows = cur.fetchall()

        df = pd.DataFrame(rows, columns=columns)
        return self._canonicalize(df)

    def _canonicalize(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            empty = pd.DataFrame(columns=["ticker", "open", "high", "low", "close", "volume"])
            empty.index = pd.DatetimeIndex([], name="price_datetime")
            return empty

        if "price_datetime" not in df.columns:
            raise ValueError("Expected column 'price_datetime' in query result.")

        df["price_datetime"] = pd.to_datetime(df["price_datetime"], errors="coerce", utc=True)
        df = df.dropna(subset=["price_datetime"]).sort_values("price_datetime")
        df["price_datetime"] = df["price_datetime"].dt.tz_convert("UTC").dt.tz_localize(None)

        rename_map = {
            "open_price": "open",
            "high_price": "high",
            "low_price": "low",
            "close_price": "close",
        }
        df = df.rename(columns=rename_map)

        keep_cols = ["ticker", "price_datetime", "open", "high", "low", "close", "volume"]
        missing = [col for col in keep_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Missing expected columns: {missing}")

        df = df[keep_cols]
        df = df.set_index("price_datetime")
        df = df[~df.index.duplicated(keep="last")]

        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")
        df = df.dropna(subset=["open", "high", "low", "close"])
        df.index.name = "price_datetime"
        return df.sort_index()

    def _decanonicalize(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame(
                columns=["ticker", "price_datetime", "open_price", "high_price", "low_price", "close_price", "volume"]
            )

        raw = df.reset_index().rename(
            columns={
                "open": "open_price",
                "high": "high_price",
                "low": "low_price",
                "close": "close_price",
            }
        )
        return raw[["ticker", "price_datetime", "open_price", "high_price", "low_price", "close_price", "volume"]]

    def _expand_query_window(
        self,
        start: Optional[datetime],
        end: Optional[datetime],
        spec: HourlyTimeframeSpec,
    ) -> tuple[Optional[datetime], Optional[datetime]]:
        if spec.direct_table:
            return start, end
        padding = max(0, spec.bucket_seconds - 3600)
        query_start = start - timedelta(seconds=padding) if start is not None else None
        query_end = end + timedelta(seconds=padding) if end is not None else None
        return query_start, query_end

    def _derive_source_limit(
        self,
        limit: Optional[int],
        spec: HourlyTimeframeSpec,
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> Optional[int]:
        if limit is None or start is not None or end is not None:
            return None
        hourly_multiplier = max(1, int(spec.bucket_seconds // 3600))
        return min(200_000, max(250, int(limit) * hourly_multiplier + hourly_multiplier))

    def _resample(self, hourly: pd.DataFrame, spec: HourlyTimeframeSpec) -> pd.DataFrame:
        if hourly.empty:
            return hourly

        aggregated = (
            hourly.resample(spec.pandas_rule, label="left", closed="left")
            .agg(
                {
                    "ticker": "last",
                    "open": "first",
                    "high": "max",
                    "low": "min",
                    "close": "last",
                    "volume": "sum",
                }
            )
            .dropna(subset=["open", "high", "low", "close"])
        )
        aggregated["volume"] = pd.to_numeric(aggregated["volume"], errors="coerce").fillna(0).astype("int64")
        aggregated.index.name = "price_datetime"
        return aggregated

    def _filter_output_window(
        self,
        df: pd.DataFrame,
        start: Optional[datetime],
        end: Optional[datetime],
        spec: HourlyTimeframeSpec,
    ) -> pd.DataFrame:
        if df.empty:
            return df

        filtered = df
        if start is not None:
            filtered = filtered[filtered.index >= self._floor_timestamp(start, spec)]
        if end is not None:
            filtered = filtered[filtered.index <= self._to_naive_utc_timestamp(end)]
        return filtered

    def _floor_timestamp(self, value: datetime, spec: HourlyTimeframeSpec) -> pd.Timestamp:
        ts = self._to_naive_utc_timestamp(value)
        if spec.timeframe == "1W":
            base = ts.normalize()
            return base - pd.Timedelta(days=base.weekday())
        if spec.timeframe == "1M":
            return pd.Timestamp(year=ts.year, month=ts.month, day=1)
        return ts.floor(spec.pandas_rule)

    def _to_naive_utc_timestamp(self, value: datetime) -> pd.Timestamp:
        ts = pd.Timestamp(value)
        if ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        return ts

    def _parse_timeframe(self, timeframe: str) -> HourlyTimeframeSpec:
        raw = str(timeframe).strip()
        if not raw:
            raise ValueError("timeframe cannot be empty")

        upper = raw.upper()
        if upper == "1M":
            return HourlyTimeframeSpec(timeframe="1M", pandas_rule="MS", bucket_seconds=31 * 86400, direct_table=False)

        lower = raw.lower()
        unit_alias = {
            "m": "m",
            "min": "m",
            "mins": "m",
            "minute": "m",
            "minutes": "m",
            "dk": "m",
            "dakika": "m",
            "h": "h",
            "hr": "h",
            "hrs": "h",
            "hour": "h",
            "hours": "h",
            "sa": "h",
            "saat": "h",
            "d": "d",
            "day": "d",
            "days": "d",
            "g": "d",
            "gun": "d",
            "w": "w",
            "wk": "w",
            "week": "w",
            "weeks": "w",
            "hafta": "w",
            "mo": "mo",
            "mon": "mo",
            "month": "mo",
            "months": "mo",
            "ay": "mo",
        }

        digits = ""
        letters = ""
        for char in lower:
            if char.isdigit():
                digits += char
            else:
                letters += char
        if not digits:
            raise ValueError(f"Invalid timeframe: {timeframe}")

        amount = int(digits)
        unit = unit_alias.get(letters or "m")
        if unit is None or amount <= 0:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        if unit == "mo":
            if amount != 1:
                raise ValueError("Only 1M monthly candles are supported from the 1h source.")
            return HourlyTimeframeSpec(timeframe="1M", pandas_rule="MS", bucket_seconds=31 * 86400, direct_table=False)

        if unit == "w":
            if amount != 1:
                raise ValueError("Only 1w weekly candles are supported from the 1h source.")
            return HourlyTimeframeSpec(timeframe="1W", pandas_rule="W-MON", bucket_seconds=7 * 86400, direct_table=False)

        if unit == "d":
            return HourlyTimeframeSpec(
                timeframe=f"{amount}D",
                pandas_rule=f"{amount}D",
                bucket_seconds=amount * 86400,
                direct_table=False,
            )

        if unit == "m":
            if amount < 60 or amount % 60 != 0:
                raise ValueError("1h source only supports 60-minute multiples.")
            amount //= 60
            unit = "h"

        if unit == "h":
            direct_table = amount == 1
            return HourlyTimeframeSpec(
                timeframe=f"{amount}H",
                pandas_rule=f"{amount}h",
                bucket_seconds=amount * 3600,
                direct_table=direct_table,
            )

        raise ValueError(f"Unsupported timeframe: {timeframe}")
