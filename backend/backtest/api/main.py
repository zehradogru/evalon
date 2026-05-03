from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import tempfile
import time
import urllib.request
import zipfile
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.modules.ai.presentation.router import create_ai_router
from api.modules.backtests.infrastructure.run_store import InMemoryRunStore
from api.modules.backtests.presentation.router import create_backtest_router
from api.modules.co_movement.presentation.router import create_co_movement_router
from api.screener import create_screener_router, get_all_tickers
from api.calendar_router import create_calendar_router
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


@lru_cache(maxsize=1)
def _known_news_tickers() -> Tuple[str, ...]:
    tickers = {item["ticker"].upper() for item in get_all_tickers() if item.get("ticker")}
    return tuple(sorted(tickers, key=len, reverse=True))


@lru_cache(maxsize=1)
def _known_news_ticker_regex() -> Optional[re.Pattern[str]]:
    tickers = _known_news_tickers()
    if not tickers:
        return None
    alternation = "|".join(re.escape(ticker) for ticker in tickers)
    return re.compile(rf"(^|[^A-Z0-9#])#?({alternation})(?=[^A-Z0-9]|$)")


def _extract_news_tickers(text: str) -> set[str]:
    regex = _known_news_ticker_regex()
    if not regex or not text:
        return set()

    matches: set[str] = set()
    normalized_text = text.upper()
    for match in regex.finditer(normalized_text):
        matches.add(match.group(2))
        if len(matches) > 1:
            break
    return matches


def _normalize_news_text(text: Optional[str]) -> str:
    if not text:
        return ""
    normalized = re.sub(r"[^\w\s#]", " ", text.upper(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", normalized).strip()


def _content_has_enough_extra_words(title: Optional[str], content: Optional[str], min_extra_words: int = 6) -> bool:
    normalized_title = _normalize_news_text(title)
    normalized_content = _normalize_news_text(content)
    if not normalized_content:
        return False
    if not normalized_title:
        return len(normalized_content.split()) >= min_extra_words
    if normalized_content == normalized_title:
        return False
    if normalized_content.startswith(normalized_title):
        remainder = normalized_content[len(normalized_title):].strip()
        return len(remainder.split()) >= min_extra_words
    return True


def _should_include_news_item(symbol: Optional[str], title: Optional[str], summary: Optional[str], content: Optional[str]) -> bool:
    raw_content = (content or "").strip()
    if not _content_has_enough_extra_words(title, raw_content):
        return False

    text = " ".join(part for part in [title or "", summary or "", raw_content] if part).strip()
    matched_tickers = _extract_news_tickers(text)
    if not matched_tickers:
        return True

    normalized_symbol = (symbol or "").strip().upper()
    return len(matched_tickers) == 1 and normalized_symbol in matched_tickers


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


def _resolve_co_movement_store_path() -> Path:
    configured = (os.environ.get("CO_MOVEMENT_SNAPSHOT_STORE_PATH") or "").strip()
    if configured:
        return Path(configured)

    if _is_managed_runtime():
        return Path(tempfile.gettempdir()) / "evalon_co_movement"

    return Path(__file__).resolve().parent / "data" / "co_movement"


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


class MarketDataMeta(BaseModel):
    stale: bool = False
    warming: bool = False
    partial: bool = False
    hasUsableData: bool = False
    source: str = "empty"
    snapshotAgeMs: Optional[int] = None
    message: Optional[str] = None
    emptyReason: Optional[str] = None
    failedTickers: Optional[List[str]] = None


class BatchPricesRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=1, max_length=150)
    timeframe: str = Field("1d", min_length=1, max_length=16)
    limit: int = Field(2, ge=2, le=500)
    refresh: bool = False


class BatchTickerResult(BaseModel):
    ticker: str
    current: Optional[Bar] = None
    previous: Optional[Bar] = None
    error: Optional[str] = None


class BatchPricesResponse(BaseModel):
    count: int
    successCount: int
    failedCount: int
    data: List[BatchTickerResult]
    failedTickers: List[str]
    cached: bool = False
    stale: bool = False
    meta: MarketDataMeta


class MarketListItem(BaseModel):
    ticker: str
    name: str
    price: Optional[float] = None
    changePct: Optional[float] = None
    changeVal: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    vol: Optional[float] = None
    rating: str = "Neutral"
    marketCap: Optional[float] = None
    pe: Optional[float] = None
    eps: Optional[float] = None
    sector: Optional[str] = None


class MarketListResponse(BaseModel):
    items: List[MarketListItem]
    total: int
    nextCursor: Optional[str]
    hasMore: bool
    snapshotAt: str
    snapshotAgeMs: Optional[int]
    stale: bool
    warming: bool
    meta: MarketDataMeta


class MarketOverviewCard(BaseModel):
    id: str
    label: str
    value: Optional[float] = None
    changePct: Optional[float] = None
    currency: str
    source: str
    asOf: str
    stale: bool = False


class MarketOverviewResponse(BaseModel):
    cards: List[MarketOverviewCard]
    meta: MarketDataMeta


_BATCH_CACHE_TTL_SECONDS = 5 * 60
_BATCH_STALE_TTL_SECONDS = 30 * 60
_batch_price_cache: Dict[str, Tuple[float, BatchPricesResponse]] = {}

_TICKER_NAMES: Dict[str, str] = {
    "THYAO": "Turkish Airlines",
    "AKBNK": "Akbank",
    "GARAN": "Garanti BBVA",
    "ISCTR": "Turkiye Is Bankasi",
    "YKBNK": "Yapi ve Kredi Bankasi",
    "KCHOL": "Koc Holding",
    "SAHOL": "Sabanci Holding",
    "EREGL": "Erdemir",
    "ASELS": "Aselsan",
    "TUPRS": "Tupras",
    "BIMAS": "BIM",
    "SISE": "Sisecam",
    "FROTO": "Ford Otosan",
    "TOASO": "Tofas",
    "XU100": "BIST 100",
    "XU030": "BIST 30",
}


def _market_meta(
    *,
    source: str,
    has_data: bool,
    stale: bool = False,
    warming: bool = False,
    partial: bool = False,
    message: Optional[str] = None,
    empty_reason: Optional[str] = None,
    failed_tickers: Optional[List[str]] = None,
    snapshot_age_ms: Optional[int] = None,
) -> MarketDataMeta:
    return MarketDataMeta(
        stale=stale,
        warming=warming,
        partial=partial,
        hasUsableData=has_data,
        source=source,
        snapshotAgeMs=snapshot_age_ms,
        message=message,
        emptyReason=empty_reason,
        failedTickers=failed_tickers,
    )


def _bar_from_row(row: Any) -> Bar:
    ts = row.Index
    return Bar(
        t=ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts,
        o=float(row.open),
        h=float(row.high),
        l=float(row.low),
        c=float(row.close),
        v=int(row.volume),
    )


def _bars_from_dataframe(df: pd.DataFrame) -> List[Bar]:
    if df is None or df.empty:
        return []
    sorted_df = df.sort_index()
    return [_bar_from_row(row) for row in sorted_df.itertuples(index=True)]


def _fetch_price_bars(
    ticker: str,
    timeframe: str,
    limit: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Bar]:
    normalized = ticker.strip().upper()
    if normalized == "TEST":
        return _bars_from_dataframe(
            _load_test_ohlcv(
                timeframe=timeframe,
                start=start,
                end=end,
                limit=limit,
            )
        )

    cfg = _config_status()
    if not cfg["has_oracle_password"]:
        raise RuntimeError("Server is missing ORACLE_DB_PASSWORD env var.")
    if not (
        cfg["has_oracle_wallet_dir_env"]
        or cfg["has_oracle_wallet_zip_b64_env"]
        or cfg["default_wallet_dir_exists"]
        or cfg["default_1h_wallet_dir_exists"]
    ):
        raise RuntimeError("Oracle wallet not configured.")

    df = client.fetch_prices_timeframe(
        ticker=normalized,
        timeframe=timeframe,
        start=start,
        end=end,
        limit=limit,
        canonicalize=True,
    )
    return _bars_from_dataframe(df)


def _build_batch_cache_key(tickers: List[str], timeframe: str, limit: int) -> str:
    return f"{timeframe}:{limit}:{','.join(sorted(tickers))}"


def _copy_batch_response(
    response: BatchPricesResponse,
    *,
    cached: bool,
    stale: bool,
    source: str,
    message: Optional[str] = None,
) -> BatchPricesResponse:
    return BatchPricesResponse(
        count=response.count,
        successCount=response.successCount,
        failedCount=response.failedCount,
        data=response.data,
        failedTickers=response.failedTickers,
        cached=cached,
        stale=stale,
        meta=_market_meta(
            source=source,
            has_data=response.successCount > 0,
            stale=stale,
            partial=response.failedCount > 0,
            message=message,
            failed_tickers=response.failedTickers,
        ),
    )


def _build_prices_batch(
    tickers: List[str],
    timeframe: str,
    limit: int,
    refresh: bool = False,
) -> BatchPricesResponse:
    normalized_tickers = []
    for ticker in tickers:
        value = ticker.strip().upper()
        if value and value not in normalized_tickers:
            normalized_tickers.append(value)

    if not normalized_tickers:
        raise HTTPException(status_code=400, detail="No valid tickers provided.")
    if len(normalized_tickers) > 150:
        raise HTTPException(status_code=400, detail="Too many tickers (max 150).")

    safe_limit = max(2, min(limit, 500))
    cache_key = _build_batch_cache_key(normalized_tickers, timeframe, safe_limit)
    now = time.time()

    cached = _batch_price_cache.get(cache_key)
    if cached and not refresh:
        age_seconds = now - cached[0]
        if age_seconds < _BATCH_CACHE_TTL_SECONDS:
            return _copy_batch_response(cached[1], cached=True, stale=False, source="cache")

    results: List[BatchTickerResult] = []
    failed_tickers: List[str] = []

    for ticker in normalized_tickers:
        try:
            bars = _fetch_price_bars(ticker=ticker, timeframe=timeframe, limit=safe_limit)
            current = bars[-1] if bars else None
            previous = bars[-2] if len(bars) > 1 else None
            if current is None:
                failed_tickers.append(ticker)
                results.append(BatchTickerResult(ticker=ticker, error="No price rows returned."))
            else:
                results.append(BatchTickerResult(ticker=ticker, current=current, previous=previous))
        except Exception as exc:
            failed_tickers.append(ticker)
            results.append(BatchTickerResult(ticker=ticker, error=str(exc)))

    successful = [item for item in results if item.current is not None]
    live_response = BatchPricesResponse(
        count=len(normalized_tickers),
        successCount=len(successful),
        failedCount=len(normalized_tickers) - len(successful),
        data=successful,
        failedTickers=failed_tickers,
        cached=False,
        stale=False,
        meta=_market_meta(
            source="live" if successful else "error",
            has_data=bool(successful),
            partial=bool(failed_tickers),
            empty_reason=None if successful else "unavailable",
            message="Bazi ticker fiyatlari gecici olarak eksik." if failed_tickers and successful else None,
            failed_tickers=failed_tickers,
        ),
    )

    if successful:
        _batch_price_cache[cache_key] = (now, live_response)

    if cached and live_response.successCount < cached[1].successCount:
        age_seconds = now - cached[0]
        if age_seconds < _BATCH_STALE_TTL_SECONDS:
            return _copy_batch_response(
                cached[1],
                cached=True,
                stale=True,
                source="stale-cache",
                message="Son basarili fiyatlar gosteriliyor.",
            )

    return live_response


def _get_rating(change_pct: Optional[float]) -> str:
    if change_pct is None:
        return "Neutral"
    if change_pct > 2:
        return "Strong Buy"
    if change_pct > 0.5:
        return "Buy"
    if change_pct < -2:
        return "Strong Sell"
    if change_pct < -0.5:
        return "Sell"
    return "Neutral"


def _empty_market_item(ticker: str, sector: Optional[str]) -> MarketListItem:
    return MarketListItem(
        ticker=ticker,
        name=_TICKER_NAMES.get(ticker, ticker),
        sector=sector,
    )


def _market_item_from_bars(ticker: str, sector: Optional[str], bars: List[Bar]) -> MarketListItem:
    if not bars:
        return _empty_market_item(ticker, sector)

    current = bars[-1]
    previous = bars[-2] if len(bars) > 1 else None
    change_val = round(current.c - previous.c, 2) if previous else None
    change_pct = round(((current.c - previous.c) / previous.c) * 100, 2) if previous and previous.c else None

    return MarketListItem(
        ticker=ticker,
        name=_TICKER_NAMES.get(ticker, ticker),
        price=round(current.c, 2),
        changePct=change_pct,
        changeVal=change_val,
        high=current.h,
        low=current.l,
        vol=float(current.v),
        rating=_get_rating(change_pct),
        sector=sector,
    )


def _numeric_sort_value(item: MarketListItem, field: str) -> Optional[float]:
    return {
        "price": item.price,
        "changePct": item.changePct,
        "changeVal": item.changeVal,
        "high": item.high,
        "low": item.low,
        "vol": item.vol,
        "marketCap": item.marketCap,
        "pe": item.pe,
        "eps": item.eps,
    }.get(field)


def _sort_market_items(items: List[MarketListItem], sort_by: str, sort_dir: str) -> List[MarketListItem]:
    reverse = sort_dir != "asc"
    if sort_by in {"ticker", "sector", "rating"}:
        return sorted(items, key=lambda item: (getattr(item, sort_by, "") or ""), reverse=reverse)

    def key(item: MarketListItem) -> Tuple[int, float]:
        value = _numeric_sort_value(item, sort_by)
        if value is None:
            return (1, 0.0)
        return (0, -value if reverse else value)

    return sorted(items, key=key)


def _query_json(url: str, timeout: int = 8) -> Dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 EvalonMobile/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _yahoo_chart_card(card_id: str, label: str, symbol: str, currency: str) -> MarketOverviewCard:
    payload = _query_json(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1mo"
    )
    result = payload.get("chart", {}).get("result", [{}])[0]
    timestamps = result.get("timestamp") or []
    closes = result.get("indicators", {}).get("quote", [{}])[0].get("close") or []
    series = [
        (timestamps[index], close)
        for index, close in enumerate(closes)
        if index < len(timestamps) and isinstance(close, (int, float))
    ]
    if not series:
        raise RuntimeError(f"No Yahoo series for {symbol}")

    last_ts, last_close = series[-1]
    _, prev_close = series[-2] if len(series) > 1 else series[-1]
    change_pct = ((last_close - prev_close) / prev_close) * 100 if prev_close else None
    return MarketOverviewCard(
        id=card_id,
        label=label,
        value=round(float(last_close), 4),
        changePct=round(float(change_pct), 2) if change_pct is not None else None,
        currency=currency,
        source="yahoo",
        asOf=datetime.utcfromtimestamp(int(last_ts)).isoformat() + "Z",
        stale=False,
    )


def _unavailable_overview_card(card_id: str, label: str, currency: str, source: str = "error") -> MarketOverviewCard:
    return MarketOverviewCard(
        id=card_id,
        label=label,
        value=None,
        changePct=None,
        currency=currency,
        source=source,
        asOf=datetime.utcnow().isoformat() + "Z",
        stale=True,
    )


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
app.include_router(
    create_co_movement_router(
        client=client,
        snapshot_store_path=str(_resolve_co_movement_store_path()),
    )
)
app.include_router(create_screener_router(price_client=client))
app.include_router(create_calendar_router(db_client=client))


@app.get("/")
def index() -> Dict[str, Any]:
    # Simple landing payload so the root URL isn't a confusing 404 on Vercel.
    return {
        "name": "BIST Prices API",
        "health": "/health",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "prices": "/v1/prices?ticker=THYAO&timeframe=5m&limit=10",
        "coMovement": "/v1/co-movement/analyze",
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


@app.get("/v1/prices/batch", response_model=BatchPricesResponse)
def get_prices_batch_get(
    tickers: str = Query(..., min_length=1, description="Comma-separated ticker list"),
    timeframe: str = Query("1d", min_length=1, max_length=16),
    limit: int = Query(2, ge=2, le=500),
    refresh: bool = Query(False),
) -> BatchPricesResponse:
    return _build_prices_batch(
        tickers=[ticker.strip() for ticker in tickers.split(",")],
        timeframe=timeframe,
        limit=limit,
        refresh=refresh,
    )


@app.post("/v1/prices/batch", response_model=BatchPricesResponse)
def get_prices_batch_post(body: BatchPricesRequest) -> BatchPricesResponse:
    return _build_prices_batch(
        tickers=body.tickers,
        timeframe=body.timeframe,
        limit=body.limit,
        refresh=body.refresh,
    )


@app.get("/v1/markets/list", response_model=MarketListResponse)
def get_markets_list(
    view: str = Query("markets", pattern="^(markets|screener)$"),
    limit: int = Query(10, ge=1, le=200),
    cursor: Optional[str] = Query(None),
    sortBy: str = Query("changePct"),
    sortDir: str = Query("desc", pattern="^(asc|desc)$"),
    q: Optional[str] = Query(None, max_length=120),
) -> MarketListResponse:
    del view
    valid_sort_fields = {
        "ticker",
        "price",
        "changePct",
        "changeVal",
        "high",
        "low",
        "vol",
        "rating",
        "marketCap",
        "pe",
        "eps",
        "sector",
    }
    if sortBy not in valid_sort_fields:
        raise HTTPException(status_code=400, detail="Invalid sortBy parameter.")

    started_at = time.time()
    now_iso = datetime.utcnow().isoformat() + "Z"
    cursor_value = 0
    if cursor:
        try:
            cursor_value = max(0, int(cursor))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor parameter.")

    catalog = get_all_tickers()
    if not catalog:
        catalog = [{"ticker": ticker, "sector": None} for ticker in _TICKER_NAMES.keys()]

    if q:
        query = q.strip().lower()
        catalog = [
            item for item in catalog
            if query in item["ticker"].lower()
            or query in _TICKER_NAMES.get(item["ticker"], item["ticker"]).lower()
        ]

    fetch_window = min(len(catalog), max(cursor_value + limit, 60))
    live_tickers = {item["ticker"] for item in catalog[:fetch_window]}
    rows: List[MarketListItem] = []
    failed: List[str] = []

    for item in catalog:
        ticker = item["ticker"].strip().upper()
        sector = item.get("sector")
        if ticker in live_tickers:
            try:
                rows.append(_market_item_from_bars(ticker, sector, _fetch_price_bars(ticker, "1d", 2)))
            except Exception:
                failed.append(ticker)
                rows.append(_empty_market_item(ticker, sector))
        else:
            rows.append(_empty_market_item(ticker, sector))

    sorted_rows = _sort_market_items(rows, sortBy, sortDir)
    page_items = sorted_rows[cursor_value: cursor_value + limit]
    next_offset = cursor_value + len(page_items)
    has_more = next_offset < len(sorted_rows)
    has_prices = any(item.price is not None for item in rows)

    return MarketListResponse(
        items=page_items,
        total=len(sorted_rows),
        nextCursor=str(next_offset) if has_more else None,
        hasMore=has_more,
        snapshotAt=now_iso,
        snapshotAgeMs=int((time.time() - started_at) * 1000),
        stale=not has_prices,
        warming=False,
        meta=_market_meta(
            source="live" if has_prices else "static-catalog",
            has_data=bool(sorted_rows),
            stale=not has_prices,
            partial=bool(failed),
            message="Canli fiyat alinamayan satirlar katalog verisiyle gosteriliyor." if failed else None,
            empty_reason=None if sorted_rows else "no-data",
            failed_tickers=failed,
            snapshot_age_ms=int((time.time() - started_at) * 1000),
        ),
    )


@app.get("/v1/market-overview", response_model=MarketOverviewResponse)
def get_market_overview() -> MarketOverviewResponse:
    cards: List[MarketOverviewCard] = []
    failures: List[str] = []

    specs = [
        ("bist100", "BIST 100", "XU100.IS", "TRY"),
        ("bist30", "BIST 30", "XU030.IS", "TRY"),
        ("xauusd", "Ons Altın / USD", "GC=F", "USD"),
        ("usdtry", "USD / TRY", "TRY=X", "TRY"),
    ]

    for card_id, label, symbol, currency in specs:
        try:
            cards.append(_yahoo_chart_card(card_id, label, symbol, currency))
        except Exception:
            failures.append(card_id)
            cards.append(_unavailable_overview_card(card_id, label, currency))

    return MarketOverviewResponse(
        cards=cards,
        meta=_market_meta(
            source="yahoo" if not failures else ("partial-yahoo" if len(failures) < len(specs) else "error"),
            has_data=any(card.value is not None for card in cards),
            stale=bool(failures),
            partial=bool(failures),
            failed_tickers=failures,
            message="Bazi overview kartlari gecici olarak alinamadi." if failures else None,
            empty_reason="unavailable" if len(failures) == len(specs) else None,
        ),
    )


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


class NewsItem(BaseModel):
    id: int
    symbol: Optional[str] = None
    news_source: Optional[str] = None
    title: str
    summary: Optional[str] = None
    content: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    news_url: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None


class NewsResponse(BaseModel):
    items: List[NewsItem]
    total: int
    page: int
    limit: int


@app.get("/v1/news", response_model=NewsResponse)
def get_news(
    symbol: Optional[str] = Query(None, max_length=20),
    symbols: Optional[str] = Query(None, max_length=1000),
    sentiment: Optional[str] = Query(None, max_length=20),
    q: Optional[str] = Query(None, max_length=200, description="Başlık/özet metin araması"),
    published_after: Optional[datetime] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
) -> NewsResponse:
    cfg = _config_status()
    if not cfg["has_oracle_password"]:
        raise HTTPException(status_code=500, detail="Oracle DB yapılandırılmamış (ORACLE_DB_PASSWORD eksik).")

    offset = (page - 1) * limit

    where_clauses: List[str] = ["CONTENT IS NOT NULL"]
    bind_params: Dict[str, Any] = {}

    symbol_values: List[str] = []
    if symbols:
        for raw_symbol in symbols.split(","):
            normalized_symbol = raw_symbol.strip().upper()
            if normalized_symbol and normalized_symbol not in symbol_values:
                symbol_values.append(normalized_symbol)

    if symbol:
        normalized_symbol = symbol.strip().upper()
        if normalized_symbol and normalized_symbol not in symbol_values:
            symbol_values.append(normalized_symbol)

    if len(symbol_values) == 1:
        where_clauses.append("UPPER(SYMBOL) = :symbol")
        bind_params["symbol"] = symbol_values[0]
    elif symbol_values:
        placeholders: List[str] = []
        for index, symbol_value in enumerate(symbol_values):
            bind_key = f"symbol_{index}"
            placeholders.append(f":{bind_key}")
            bind_params[bind_key] = symbol_value
        where_clauses.append(f"UPPER(SYMBOL) IN ({', '.join(placeholders)})")

    if sentiment:
        upper_sent = sentiment.strip().upper()
        if upper_sent == "NOTR":
            upper_sent = "NÖTR"
        where_clauses.append("UPPER(SENTIMENT) = :sentiment")
        bind_params["sentiment"] = upper_sent

    if q:
        where_clauses.append("(UPPER(TITLE) LIKE :q OR UPPER(SUMMARY) LIKE :q)")
        bind_params["q"] = f"%{q.strip().upper()}%"

    if published_after:
        where_clauses.append("PUBLISHED_AT >= :published_after")
        bind_params["published_after"] = published_after

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    select_sql = f"""
        SELECT ID, SYMBOL, NEWS_SOURCE, TITLE, SUMMARY, CONTENT,
               SENTIMENT, SENTIMENT_SCORE, NEWS_URL, AUTHOR, PUBLISHED_AT
        FROM BIST_NEWS
        {where_sql}
        ORDER BY PUBLISHED_AT DESC NULLS LAST
    """

    def _run_news_query(batch_offset: int, batch_limit: int) -> tuple:
        conn = client._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"{select_sql}\nOFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY",
                    {**bind_params, "offset": batch_offset, "limit": batch_limit},
                )
                rows = cur.fetchall()
            return rows
        finally:
            conn.close()

    def _lob(v):
        """Oracle LOB objesini string'e Ã§evirir, None'Ä± korur."""
        if v is None:
            return None
        return v.read() if hasattr(v, "read") else v

    def _build_news_item(row: tuple) -> Optional[NewsItem]:
        symbol_value = _lob(row[1])
        title_value = _lob(row[3]) or ""
        summary_value = _lob(row[4])
        content_value = _lob(row[5])

        if not _should_include_news_item(symbol_value, title_value, summary_value, content_value):
            return None

        return NewsItem(
            id=int(row[0]),
            symbol=symbol_value,
            news_source=_lob(row[2]),
            title=title_value,
            summary=summary_value,
            content=content_value,
            sentiment=_lob(row[6]),
            sentiment_score=float(row[7]) if row[7] is not None else None,
            news_url=_lob(row[8]),
            author=_lob(row[9]),
            published_at=row[10],
        )

    def _collect_filtered_items() -> List[NewsItem]:
        filtered_items: List[NewsItem] = []
        batch_size = max(limit * 5, 100)
        scan_target = offset + limit
        batch_offset = 0

        while len(filtered_items) < scan_target:
            rows = list(_run_news_query(batch_offset, batch_size))
            if not rows:
                break

            for row in rows:
                item = _build_news_item(row)
                if item is None:
                    continue
                filtered_items.append(item)
                if len(filtered_items) >= scan_target:
                    break

            if len(rows) < batch_size:
                break
            batch_offset += batch_size

        return filtered_items

    try:
        filtered_items = _collect_filtered_items()
    except Exception as first_err:
        # Broken pipe / stale connection — reset pool and retry once
        import errno
        is_pipe = (
            isinstance(first_err, OSError) and getattr(first_err, "errno", None) == errno.EPIPE
        ) or "Broken pipe" in str(first_err) or "DPY-" in str(first_err)
        if is_pipe:
            try:
                client.close_pool()
            except Exception:
                pass
            try:
                filtered_items = _collect_filtered_items()
            except Exception as retry_err:
                raise HTTPException(status_code=500, detail=f"Haber verisi alınamadı: {retry_err}")
        else:
            raise HTTPException(status_code=500, detail=f"Haber verisi alınamadı: {first_err}")

    def _lob(v):
        """Oracle LOB objesini string'e çevirir, None'ı korur."""
        if v is None:
            return None
        return v.read() if hasattr(v, "read") else v

    def _build_news_item(row: tuple) -> Optional[NewsItem]:
        symbol_value = _lob(row[1])
        title_value = _lob(row[3]) or ""
        summary_value = _lob(row[4])
        content_value = _lob(row[5])

        if not _should_include_news_item(symbol_value, title_value, summary_value, content_value):
            return None

        return NewsItem(
            id=int(row[0]),
            symbol=symbol_value,
            news_source=_lob(row[2]),
            title=title_value,
            summary=summary_value,
            content=content_value,
            sentiment=_lob(row[6]),
            sentiment_score=float(row[7]) if row[7] is not None else None,
            news_url=_lob(row[8]),
            author=_lob(row[9]),
            published_at=row[10],
        )

    def _collect_filtered_items() -> List[NewsItem]:
        filtered_items: List[NewsItem] = []
        batch_size = max(limit * 5, 100)
        scan_target = offset + limit
        batch_offset = 0

        while len(filtered_items) < scan_target:
            rows = list(_run_news_query(batch_offset, batch_size))
            if not rows:
                break

            for row in rows:
                item = _build_news_item(row)
                if item is None:
                    continue
                filtered_items.append(item)
                if len(filtered_items) >= scan_target:
                    break

            if len(rows) < batch_size:
                break
            batch_offset += batch_size

        return filtered_items

    items = filtered_items[offset: offset + limit]
    return NewsResponse(items=items, total=len(items), page=page, limit=limit)


@app.on_event("shutdown")
def _shutdown() -> None:
    try:
        client.close_pool()
    except Exception:
        pass
