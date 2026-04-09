import os
from datetime import datetime
from typing import Optional

import oracledb
import pandas as pd
from dotenv import load_dotenv


class BistPricesClient:
    def __init__(
        self,
        user: Optional[str] = None,
        password: Optional[str] = None,
        dsn: Optional[str] = None,
        wallet_dir: Optional[str] = None,
        wallet_password: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> None:
        load_dotenv()
        default_wallet_dir = os.path.join(os.path.dirname(__file__), "wallet")
        self._user = user or os.environ.get("ORACLE_DB_USER", "ADMIN")
        self._password = password or os.environ.get("ORACLE_DB_PASSWORD", "")
        self._dsn = dsn or os.environ.get("ORACLE_DB_DSN", "evalondb_high")
        self._wallet_dir = wallet_dir or default_wallet_dir
        self._wallet_password = wallet_password or os.environ.get("ORACLE_WALLET_PASSWORD") or None
        self._debug = debug if debug is not None else os.environ.get("BIST_DEBUG") == "1"
        self._pool = None

    def _log(self, message: str) -> None:
        if self._debug:
            print(message, flush=True)

    def init_pool(self, min: int = 1, max: int = 4, increment: int = 1) -> None:
        """
        Create a connection pool for API workloads.

        Safe to call multiple times.
        """
        if self._pool is not None:
            return

        self._log("Creating Oracle pool...")
        kwargs = {
            "user": self._user,
            "password": self._password,
            "dsn": self._dsn,
            "config_dir": self._wallet_dir,
            "wallet_location": self._wallet_dir,
        }
        if self._wallet_password:
            kwargs["wallet_password"] = self._wallet_password

        self._pool = oracledb.create_pool(min=min, max=max, increment=increment, **kwargs)
        self._log("Oracle pool ready.")

    def close_pool(self) -> None:
        pool = self._pool
        self._pool = None
        if pool is not None:
            try:
                pool.close()
            except Exception:
                pass

    def _connect(self):
        # Thin mode with mTLS wallet
        if self._pool is not None:
            self._log("Acquiring Oracle connection from pool...")
            conn = self._pool.acquire()
            self._log("Acquired.")
            return conn

        self._log("Connecting to Oracle...")
        kwargs = {
            "user": self._user,
            "password": self._password,
            "dsn": self._dsn,
            "config_dir": self._wallet_dir,
            "wallet_location": self._wallet_dir,
        }
        if self._wallet_password:
            kwargs["wallet_password"] = self._wallet_password
        conn = oracledb.connect(**kwargs)
        self._log("Connected.")
        return conn

    def fetch_prices(
        self,
        ticker: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
        canonicalize: bool = True,
    ) -> pd.DataFrame:
        sql = [
            "SELECT TICKER, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME",
            "FROM BIST_PRICES",
            "WHERE TICKER = :ticker",
        ]
        params = {"ticker": ticker}

        if start is not None:
            sql.append("AND PRICE_DATETIME >= :start_dt")
            params["start_dt"] = start
        if end is not None:
            sql.append("AND PRICE_DATETIME <= :end_dt")
            params["end_dt"] = end

        sql.append("ORDER BY PRICE_DATETIME")

        # Not: Bazı Oracle kurulumlarında FETCH FIRST bind param ile sorun çıkabiliyor.
        # Sende hata verirse aşağıdaki satırları yorumlayıp, string'e gömülü limit kullan:
        if limit is not None:
            sql.append("FETCH FIRST :limit_rows ROWS ONLY")
            params["limit_rows"] = int(limit)

            # Alternatif (bind sorun çıkarırsa):
            # sql.append(f"FETCH FIRST {int(limit)} ROWS ONLY")

        query = "\n".join(sql)

        with self._connect() as conn:
            with conn.cursor() as cur:
                self._log("Executing query...")
                cur.execute(query, params)
                columns = [col[0].lower() for col in cur.description]
                rows = cur.fetchall()

        df = pd.DataFrame(rows, columns=columns)

        if not canonicalize:
            return df

        # ---- Canonicalization: backtest için ideal format ----
        # 1) datetime dönüşümü + sıralama
        if "price_datetime" not in df.columns:
            raise ValueError("Expected column 'price_datetime' in query result.")

        df["price_datetime"] = pd.to_datetime(df["price_datetime"], errors="coerce")
        df = df.dropna(subset=["price_datetime"]).sort_values("price_datetime")

        # 2) kolon isimlerini sadeleştir
        rename_map = {
            "open_price": "open",
            "high_price": "high",
            "low_price": "low",
            "close_price": "close",
        }
        df = df.rename(columns=rename_map)

        # 3) seçili kolonları tut (ticker kalsın)
        keep_cols = ["ticker", "price_datetime", "open", "high", "low", "close", "volume"]
        missing = [c for c in keep_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Missing expected columns: {missing}")

        df = df[keep_cols]

        # 4) index = datetime (ticker kolonu kalır)
        df = df.set_index("price_datetime")

        # 5) duplicate timestamp varsa son kaydı tut
        # (tek ticker'da genelde yeterli)
        df = df[~df.index.duplicated(keep="last")]

        # 6) dtype dönüşümleri (hız/sağlamlık)
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")

        # float NaN oluştuysa temizle (isteğe göre forward-fill de yapabilirsin)
        df = df.dropna(subset=["open", "high", "low", "close"])

        return df

    def fetch_prices_timeframe(
        self,
        ticker: str,
        timeframe: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: Optional[int] = None,
        canonicalize: bool = True,
    ) -> pd.DataFrame:
        """
        DB'deki 1 dakikalik OHLCV verisini Oracle tarafinda timeframe'e (candle) aggregate eder.

        Örnek timeframe'ler:
          - Dakika: "5m", "15m", "30m", "45m"
          - Saat:   "1h", "2h", "4h"
          - Gün:    "1d" veya "1g"
          - Hafta:  "1w" (ISO week, Pazartesi başlangıç)
          - Ay:     "1M" veya "1mo"

        Not: Bu yöntem Python'a tüm 1 dakikalık datayı çekip resample etmek yerine,
        aggregation'ı DB tarafında yapar (network yükünü ciddi azaltır). Yine de DB,
        seçilen aralıktaki 1 dakikalık satırları okur; çok sık kullanımda materialized
        view / pre-aggregation daha da hızlı olur.
        """
        tf = str(timeframe).strip()
        if not tf:
            raise ValueError("timeframe cannot be empty")

        bucket_expr, extra_params, tf_kind, bucket_minutes = self._time_bucket_expr(tf)

        # 1 dakikalik isteklerde mevcut hızlı path'i kullan
        if tf_kind == "minutes" and bucket_minutes == 1:
            return self.fetch_prices(
                ticker=ticker,
                start=start,
                end=end,
                limit=limit,
                canonicalize=canonicalize,
            )

        sql = [
            "SELECT",
            "  p.TICKER,",
            f"  {bucket_expr} AS PRICE_DATETIME,",
            "  MIN(p.OPEN_PRICE) KEEP (DENSE_RANK FIRST ORDER BY p.PRICE_DATETIME) AS OPEN_PRICE,",
            "  MAX(p.HIGH_PRICE) AS HIGH_PRICE,",
            "  MIN(p.LOW_PRICE) AS LOW_PRICE,",
            "  MAX(p.CLOSE_PRICE) KEEP (DENSE_RANK LAST ORDER BY p.PRICE_DATETIME) AS CLOSE_PRICE,",
            "  SUM(p.VOLUME) AS VOLUME",
            "FROM BIST_PRICES p",
            "WHERE p.TICKER = :ticker",
        ]

        params: dict = {"ticker": ticker}
        params.update(extra_params)

        if start is not None:
            sql.append("AND p.PRICE_DATETIME >= :start_dt")
            params["start_dt"] = start
        if end is not None:
            sql.append("AND p.PRICE_DATETIME <= :end_dt")
            params["end_dt"] = end

        sql.append(f"GROUP BY p.TICKER, {bucket_expr}")
        sql.append("ORDER BY 2")

        if limit is not None:
            # Not: Bazı Oracle kurulumlarında FETCH FIRST bind param ile sorun çıkabiliyor.
            # Sende hata verirse aşağıdaki satırları yorumlayıp string'e gömülü limit kullan:
            sql.append("FETCH FIRST :limit_rows ROWS ONLY")
            params["limit_rows"] = int(limit)
            # Alternatif:
            # sql.append(f"FETCH FIRST {int(limit)} ROWS ONLY")

        query = "\n".join(sql)

        with self._connect() as conn:
            with conn.cursor() as cur:
                self._log("Executing timeframe query...")
                cur.execute(query, params)
                columns = [col[0].lower() for col in cur.description]
                rows = cur.fetchall()

        df = pd.DataFrame(rows, columns=columns)

        if not canonicalize:
            return df

        # ---- Canonicalization: backtest için ideal format ----
        if "price_datetime" not in df.columns:
            raise ValueError("Expected column 'price_datetime' in query result.")

        df["price_datetime"] = pd.to_datetime(df["price_datetime"], errors="coerce")
        df = df.dropna(subset=["price_datetime"]).sort_values("price_datetime")

        rename_map = {
            "open_price": "open",
            "high_price": "high",
            "low_price": "low",
            "close_price": "close",
        }
        df = df.rename(columns=rename_map)

        keep_cols = ["ticker", "price_datetime", "open", "high", "low", "close", "volume"]
        missing = [c for c in keep_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Missing expected columns: {missing}")

        df = df[keep_cols]
        df = df.set_index("price_datetime")
        df = df[~df.index.duplicated(keep="last")]

        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")
        df = df.dropna(subset=["open", "high", "low", "close"])

        return df

    def _time_bucket_expr(self, timeframe: str) -> tuple[str, dict, str, int]:
        """
        Returns:
          bucket_expr_sql: Oracle expression that evaluates to bucket start datetime
          extra_params: bind params required by bucket expr (e.g. bucket_minutes)
          tf_kind: "minutes" | "weekly" | "monthly"
          bucket_minutes: only meaningful when tf_kind == "minutes"
        """
        import re

        raw = str(timeframe).strip().replace(" ", "")
        if not raw:
            raise ValueError("timeframe cannot be empty")

        # "1M" (uppercase M) => month. Lowercase 'm' => minutes.
        if re.fullmatch(r"\d+M", raw):
            n = int(raw[:-1])
            if n != 1:
                raise ValueError("Only '1M' (monthly) is supported for now.")
            dt = "CAST(p.PRICE_DATETIME AS DATE)"
            return f"TRUNC({dt}, 'MM')", {}, "monthly", 0

        s = raw.lower()

        m = re.fullmatch(r"(\d+)([a-z]+)?", s)
        if not m:
            raise ValueError(
                "Invalid timeframe format. Examples: 5m, 15m, 1h, 4h, 1d/1g, 1w, 1M/1mo"
            )
        n = int(m.group(1))
        unit_raw = (m.group(2) or "m").lower()

        unit_map = {
            # minute
            "m": "m",
            "min": "m",
            "mins": "m",
            "minute": "m",
            "minutes": "m",
            "dk": "m",
            "dakika": "m",
            # hour
            "h": "h",
            "hr": "h",
            "hrs": "h",
            "hour": "h",
            "hours": "h",
            "sa": "h",
            "saat": "h",
            # day
            "d": "d",
            "day": "d",
            "days": "d",
            "g": "d",
            "gun": "d",
            # week
            "w": "w",
            "wk": "w",
            "week": "w",
            "weeks": "w",
            "hafta": "w",
            # month
            "mo": "mo",
            "mon": "mo",
            "month": "mo",
            "months": "mo",
            "ay": "mo",
        }
        unit = unit_map.get(unit_raw)
        if unit is None:
            raise ValueError(f"Unsupported timeframe unit: {unit_raw!r}")

        if n <= 0:
            raise ValueError("timeframe must be a positive duration")

        # Monthly (case-insensitive alternatives)
        if unit == "mo":
            if n != 1:
                raise ValueError("Only '1mo' (monthly) is supported for now.")
            dt = "CAST(p.PRICE_DATETIME AS DATE)"
            return f"TRUNC({dt}, 'MM')", {}, "monthly", 0

        # Weekly (ISO week starts Monday)
        if unit == "w":
            if n != 1:
                raise ValueError("Only '1w' (weekly) is supported for now.")
            dt = "CAST(p.PRICE_DATETIME AS DATE)"
            return f"TRUNC({dt}, 'IW')", {}, "weekly", 0

        # Minutes-based buckets (includes hours/days converted to minutes)
        if unit == "m":
            minutes = n
        elif unit == "h":
            minutes = n * 60
        elif unit == "d":
            minutes = n * 1440

        # Robust bucketing in Oracle without floating point edge-cases at exact boundaries.
        # We compute integer minutes since a fixed anchor using Julian day + minute-of-day,
        # then floor-divide by bucket size, then convert back to DATE.
        anchor_date = "DATE '1970-01-01'"
        dt = "CAST(p.PRICE_DATETIME AS DATE)"
        anchor_jul = "TO_NUMBER(TO_CHAR(DATE '1970-01-01', 'J'))"
        jul = f"TO_NUMBER(TO_CHAR({dt}, 'J'))"
        min_of_day = f"(TO_NUMBER(TO_CHAR({dt}, 'HH24')) * 60 + TO_NUMBER(TO_CHAR({dt}, 'MI')))"
        total_min = f"(({jul} - {anchor_jul}) * 1440 + {min_of_day})"
        bucket_total_min = f"(FLOOR({total_min} / :bucket_minutes) * :bucket_minutes)"
        bucket_expr = (
            f"CAST(({anchor_date} + FLOOR({bucket_total_min} / 1440))"
            f" + NUMTODSINTERVAL(MOD({bucket_total_min}, 1440), 'MINUTE') AS DATE)"
        )
        return bucket_expr, {"bucket_minutes": int(minutes)}, "minutes", int(minutes)


if __name__ == "__main__":
    client = BistPricesClient()

    df = client.fetch_prices("THYAO", limit=100)
    print(df.head())
    print(df.dtypes)
