from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.modules.ai.presentation.router import create_ai_router
from api.modules.backtests.infrastructure.run_store import InMemoryRunStore
from api.modules.backtests.presentation.router import create_backtest_router
from api.screener import create_screener_router
from api.talib_indicators import (
    INDICATOR_CATALOG,
    TalibUnavailableError,
    build_indicator_series,
    normalize_indicator_key,
    supported_indicator_ids,
)
from data_clients.bist_prices_1h_client import DEFAULT_1H_WALLET_DIR
from data_clients.bist_prices_client import BistPricesClient
from data_clients.hybrid_bist_prices_client import HybridBistPricesClient


LOCAL_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]


def _bool_env(name: str) -> bool:
    v = os.environ.get(name)
    return bool(v and v.strip())


def _list_env(name: str) -> List[str]:
    raw = os.environ.get(name, "")
    return [value.strip() for value in raw.split(",") if value.strip()]


def _is_managed_runtime() -> bool:
    return _bool_env("K_SERVICE") or os.environ.get("VERCEL") == "1"


def _cors_options() -> Dict[str, Any]:
    allow_origins = _list_env("ALLOWED_ORIGINS")
    allow_origin_regex = (os.environ.get("ALLOWED_ORIGIN_REGEX") or "").strip()

    if not allow_origins and not allow_origin_regex and not _is_managed_runtime():
        allow_origins = LOCAL_DEV_ORIGINS

    options: Dict[str, Any] = {
        "allow_origins": allow_origins,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if allow_origin_regex:
        options["allow_origin_regex"] = allow_origin_regex
    return options


def _prepare_wallet_dir() -> Optional[str]:
    """
    Wallet handling (deployment-friendly):
      1) If ORACLE_WALLET_DIR is set -> use it.
      2) Else if ORACLE_WALLET_ZIP_B64 is set -> unzip into a temp dir and use that.
      3) Else -> return None (BistPricesClient will use its default ./wallet).
    """
    wallet_dir = (os.environ.get("ORACLE_WALLET_DIR") or "").strip()
    if wallet_dir:
        return wallet_dir

    wallet_zip_b64 = (os.environ.get("ORACLE_WALLET_ZIP_B64") or "").strip()
    if not wallet_zip_b64:
        for candidate in [DEFAULT_1H_WALLET_DIR, str(Path(__file__).resolve().parents[1] / "wallet")]:
            if Path(candidate).is_dir():
                return candidate
        return None

    try:
        raw = base64.b64decode(wallet_zip_b64)
    except Exception as e:  # pragma: no cover
        raise RuntimeError("Invalid ORACLE_WALLET_ZIP_B64 (base64 decode failed)") from e

    tmp_dir = Path(tempfile.mkdtemp(prefix="oracle_wallet_"))
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            zf.extractall(tmp_dir)
    except Exception as e:  # pragma: no cover
        raise RuntimeError("Invalid ORACLE_WALLET_ZIP_B64 (zip extract failed)") from e

    # Wallet zip might contain files directly, or a single top-level folder (e.g. "wallet/").
    # Find the actual directory that contains tnsnames.ora.
    if (tmp_dir / "tnsnames.ora").is_file():
        return str(tmp_dir)

    children = [p for p in tmp_dir.iterdir() if p.is_dir()]
    if len(children) == 1 and (children[0] / "tnsnames.ora").is_file():
        return str(children[0])

    tns_candidates = list(tmp_dir.rglob("tnsnames.ora"))
    if tns_candidates:
        # Prefer the shallowest match (closest to the extraction root).
        tns_candidates.sort(key=lambda p: len(p.parts))
        return str(tns_candidates[0].parent)

    return str(tmp_dir)


def _build_client() -> BistPricesClient:
    wallet_dir = _prepare_wallet_dir()

    client = HybridBistPricesClient(
        wallet_dir=wallet_dir,
        debug=os.environ.get("BIST_DEBUG") == "1",
    )

    # Optional: enable pooling for API workloads
    if os.environ.get("ORACLE_USE_POOL", "1") == "1":
        try:
            pool_min = int(os.environ.get("ORACLE_POOL_MIN", "1"))
            pool_max = int(os.environ.get("ORACLE_POOL_MAX", "8"))
            pool_inc = int(os.environ.get("ORACLE_POOL_INC", "1"))
            client.init_pool(min=pool_min, max=pool_max, increment=pool_inc)
        except Exception:
            # Pool is an optimization; fall back to per-request connections.
            pass

    return client


def _resolve_ai_asset_store_path() -> Path:
    configured = (os.environ.get("AI_ASSET_STORE_PATH") or "").strip()
    if configured:
        return Path(configured)

    if _is_managed_runtime():
        return Path(tempfile.gettempdir()) / "evalon_ai_assets.json"

    return Path(__file__).resolve().parent / "data" / "ai_assets.json"


client = _build_client()
backtest_run_store = InMemoryRunStore()
app = FastAPI(title="BIST Prices API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    **_cors_options(),
)


class Bar(BaseModel):
    t: datetime = Field(..., description="Bucket start datetime")
    o: float
    h: float
    l: float
    c: float
    v: int


class PricesResponse(BaseModel):
    ticker: str
    timeframe: str
    rows: int
    data: List[Bar]


def _config_status() -> Dict[str, Any]:
    default_wallet_dir = Path(__file__).resolve().parents[1] / "wallet"
    default_1h_wallet_dir = Path(DEFAULT_1H_WALLET_DIR)
    return {
        "has_oracle_user": _bool_env("ORACLE_DB_USER"),
        "has_oracle_password": _bool_env("ORACLE_DB_PASSWORD"),
        "has_oracle_dsn": _bool_env("ORACLE_DB_DSN"),
        "has_oracle_wallet_dir_env": _bool_env("ORACLE_WALLET_DIR"),
        "has_oracle_wallet_zip_b64_env": _bool_env("ORACLE_WALLET_ZIP_B64"),
        "default_wallet_dir_exists": default_wallet_dir.is_dir(),
        "default_1h_wallet_dir_exists": default_1h_wallet_dir.is_dir(),
        "pool_enabled": os.environ.get("ORACLE_USE_POOL", "1") == "1",
        "allowed_origins_count": len(_list_env("ALLOWED_ORIGINS")),
        "has_allowed_origin_regex": _bool_env("ALLOWED_ORIGIN_REGEX"),
    }


TEST_OHLCV_PATH = os.environ.get(
    "TEST_OHLCV_PATH",
    str(Path(__file__).resolve().parent / "fixtures" / "test_ohlcv.csv"),
)


def _to_utc_timestamp(value: Optional[datetime]) -> Optional[pd.Timestamp]:
    if value is None:
        return None
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        return ts.tz_localize("UTC")
    return ts.tz_convert("UTC")


def _timeframe_to_rule(timeframe: str) -> str:
    raw = timeframe.strip().replace(" ", "")
    if raw == "1M":
        return "1MS"

    key = raw.lower()
    mapping = {
        "1m": "1min",
        "3m": "3min",
        "5m": "5min",
        "15m": "15min",
        "30m": "30min",
        "1h": "1h",
        "2h": "2h",
        "4h": "4h",
        "6h": "6h",
        "12h": "12h",
        "1d": "1d",
        "1g": "1d",
        "1w": "1w",
        "1mo": "1MS",
        "1month": "1MS",
    }
    rule = mapping.get(key)
    if not rule:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    return rule


def _load_test_ohlcv(
    timeframe: str,
    start: Optional[datetime],
    end: Optional[datetime],
    limit: Optional[int],
) -> pd.DataFrame:
    source_path = Path(TEST_OHLCV_PATH)
    if not source_path.is_file():
        raise FileNotFoundError(f"TEST_OHLCV_PATH not found: {source_path}")

    compression = "zstd" if source_path.suffix == ".zst" else "infer"
    df = pd.read_csv(source_path, compression=compression)

    if "ts_event" in df.columns:
        df["t"] = pd.to_datetime(df["ts_event"], unit="ns", utc=True, errors="coerce")
    else:
        df["t"] = pd.to_datetime(df.iloc[:, 0], utc=True, errors="coerce")

    rename_map = {
        "open_price": "open",
        "high_price": "high",
        "low_price": "low",
        "close_price": "close",
    }
    df = df.rename(columns=rename_map).dropna(subset=["t"]).sort_values("t").set_index("t")

    required_cols = ["open", "high", "low", "close", "volume"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"TEST file missing required columns: {missing}")

    df = df[required_cols].copy()
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["open", "high", "low", "close"])
    df["volume"] = df["volume"].fillna(0)

    start_ts = _to_utc_timestamp(start)
    end_ts = _to_utc_timestamp(end)
    if start_ts is not None:
        df = df[df.index >= start_ts]
    if end_ts is not None:
        df = df[df.index <= end_ts]

    rule = _timeframe_to_rule(timeframe)
    if rule != "1min":
        df = (
            df.resample(rule)
            .agg(
                {
                    "open": "first",
                    "high": "max",
                    "low": "min",
                    "close": "last",
                    "volume": "sum",
                }
            )
            .dropna(subset=["open", "high", "low", "close"])
        )

    if limit:
        df = df.tail(limit)

    return df


app.include_router(
    create_backtest_router(
        client=client,
        test_loader=_load_test_ohlcv,
        run_store=backtest_run_store,
    )
)
app.include_router(
    create_ai_router(
        client=client,
        test_loader=_load_test_ohlcv,
        run_store=backtest_run_store,
        asset_store_path=_resolve_ai_asset_store_path(),
    )
)
app.include_router(create_screener_router(price_client=client))


@app.get("/")
def index() -> Dict[str, Any]:
    # Simple landing payload so the root URL isn't a confusing 404 on Vercel.
    return {
        "name": "BIST Prices API",
        "health": "/health",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "prices": "/v1/prices?ticker=THYAO&timeframe=5m&limit=10",
        "config": _config_status(),
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/prices", response_model=PricesResponse)
def get_prices(
    ticker: str = Query(..., min_length=1, max_length=32),
    timeframe: str = Query("1m", min_length=1, max_length=16, description="e.g. 1m, 5m, 1h, 1d, 1w, 1M"),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=200_000),
) -> PricesResponse:
    # Fast, explicit checks to avoid confusing 500s on deployments.
    cfg = _config_status()
    if ticker == "TEST":
        try:
            df = _load_test_ohlcv(
                timeframe=timeframe,
                start=start,
                end=end,
                limit=limit,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read test file: {e}")

        if df.empty:
            return PricesResponse(ticker=ticker, timeframe=timeframe, rows=0, data=[])

        bars: List[Bar] = []
        for row in df.itertuples(index=True):
            ts = row.Index
            bars.append(
                Bar(
                    t=ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts,
                    o=float(row.open),
                    h=float(row.high),
                    l=float(row.low),
                    c=float(row.close),
                    v=int(row.volume),
                )
            )

        return PricesResponse(ticker=ticker, timeframe=timeframe, rows=len(bars), data=bars)

    if not cfg["has_oracle_password"]:
        raise HTTPException(
            status_code=500,
            detail="Server is missing ORACLE_DB_PASSWORD env var.",
        )
    # If no wallet is present in the deployment and DSN is likely a TNS alias, Oracle connect will fail.
    if not (
        cfg["has_oracle_wallet_dir_env"]
        or cfg["has_oracle_wallet_zip_b64_env"]
        or cfg["default_wallet_dir_exists"]
        or cfg["default_1h_wallet_dir_exists"]
    ):
        raise HTTPException(
            status_code=500,
            detail="Oracle wallet not configured. Set ORACLE_WALLET_ZIP_B64 (base64 zip) or ORACLE_WALLET_DIR.",
        )

    try:
        df = client.fetch_prices_timeframe(
            ticker=ticker,
            timeframe=timeframe,
            start=start,
            end=end,
            limit=limit,
            canonicalize=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        if os.environ.get("BIST_DEBUG") == "1":
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch prices: {type(e).__name__}: {e}",
            ) from e
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch prices. Check Oracle env vars and wallet configuration.",
        ) from e

    if df.empty:
        return PricesResponse(ticker=ticker, timeframe=timeframe, rows=0, data=[])

    # df index is price_datetime
    out: List[Dict[str, Any]] = []
    for row in df.itertuples(index=True):
        ts = row.Index
        out.append(
            {
                "t": ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts,
                "o": float(row.open),
                "h": float(row.high),
                "l": float(row.low),
                "c": float(row.close),
                "v": int(row.volume),
            }
        )

    return PricesResponse(ticker=ticker, timeframe=timeframe, rows=len(out), data=out)


class IndicatorResponse(BaseModel):
    ticker: str
    timeframe: str
    strategy: str
    indicators: List[Dict[str, Any]]


class IndicatorCatalogResponse(BaseModel):
    count: int
    indicators: List[Dict[str, str]]


@app.get("/v1/indicators/catalog", response_model=IndicatorCatalogResponse)
def get_indicator_catalog() -> IndicatorCatalogResponse:
    return IndicatorCatalogResponse(
        count=len(INDICATOR_CATALOG),
        indicators=INDICATOR_CATALOG,
    )


@app.get("/v1/indicators", response_model=IndicatorResponse)
def get_indicators(
    request: Request,
    ticker: str = Query(..., min_length=1, max_length=32),
    timeframe: str = Query("1m", min_length=1, max_length=16),
    strategy: str = Query(..., description="indicator slug, e.g. rsi, macd, sma, ema, bbands"),
    period: Optional[int] = Query(14, description="RSI period"),
    fast: Optional[int] = Query(12, description="MACD fast"),
    slow: Optional[int] = Query(26, description="MACD slow"),
    signal: Optional[int] = Query(9, description="MACD signal"),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=200_000),
) -> IndicatorResponse:
    # 1. Veri Çek
    try:
        if ticker == "TEST":
            df = _load_test_ohlcv(
                timeframe=timeframe,
                start=start,
                end=end,
                limit=limit,
            )
        else:
            df = client.fetch_prices_timeframe(
                ticker=ticker,
                timeframe=timeframe,
                start=start,
                end=end,
                limit=limit,
                canonicalize=True,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if df.empty:
        return IndicatorResponse(
            ticker=ticker, timeframe=timeframe, strategy=strategy, indicators=[]
        )

    # 2. TA-Lib ile indikatörleri üret
    query_params = dict(request.query_params)
    if period is not None:
        query_params.setdefault("period", str(period))
    if fast is not None:
        query_params.setdefault("fast", str(fast))
    if slow is not None:
        query_params.setdefault("slow", str(slow))
    if signal is not None:
        query_params.setdefault("signal", str(signal))

    try:
        strat_key = normalize_indicator_key(strategy)
        indicators = build_indicator_series(df, strat_key, query_params)
    except TalibUnavailableError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except ValueError as e:
        allowed = ", ".join(supported_indicator_ids())
        raise HTTPException(
            status_code=400,
            detail=f"{e}. Supported indicators: {allowed}",
        ) from e
    
    return IndicatorResponse(
        ticker=ticker,
        timeframe=timeframe,
        strategy=strat_key,
        indicators=indicators
    )


@app.on_event("shutdown")
def _shutdown() -> None:
    try:
        client.close_pool()
    except Exception:
        pass
