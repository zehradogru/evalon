from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Optional

import pandas as pd

from data_clients.bist_prices_client import BistPricesClient
from api.modules.ai.domain.contracts import AssetStore
from api.modules.backtests.application.use_cases import (
    BacktestCatalogUseCases,
    GetRunEventsUseCase,
    GetRunPortfolioCurveUseCase,
    GetRunStatusUseCase,
    RunBlueprintBacktestUseCase,
    StartBlueprintBacktestUseCase,
)
from api.modules.backtests.infrastructure.market_data import MarketDataGateway
from api.modules.backtests.infrastructure.run_store import InMemoryRunStore
from api.talib_indicators import (
    INDICATOR_CATALOG,
    build_indicator_series,
    normalize_indicator_key,
    supported_indicator_ids,
)


class AiToolGateway:
    def __init__(
        self,
        *,
        client: BistPricesClient,
        test_loader: Callable[[str, Optional[datetime], Optional[datetime], Optional[int]], pd.DataFrame],
        run_store: InMemoryRunStore,
        asset_store: AssetStore,
    ) -> None:
        self._client = client
        self._test_loader = test_loader
        self._run_store = run_store
        self._asset_store = asset_store
        self._market_data_gateway = MarketDataGateway(client=client, test_loader=test_loader)
        self._run_backtest_use_case = RunBlueprintBacktestUseCase(self._market_data_gateway, run_store)
        self._start_backtest_use_case = StartBlueprintBacktestUseCase(self._market_data_gateway, run_store)
        self._get_status_use_case = GetRunStatusUseCase(run_store)
        self._get_events_use_case = GetRunEventsUseCase(run_store)
        self._get_curve_use_case = GetRunPortfolioCurveUseCase(run_store)

    def describe_tools(self) -> list[dict[str, Any]]:
        return [
            {"name": "get_rule_catalog", "description": "Hazir rule katalogunu getirir.", "args": {}},
            {"name": "get_preset_catalog", "description": "Hazir preset/strateji kombinasyonlarini getirir.", "args": {}},
            {"name": "get_prices", "description": "Ticker ve timeframe icin fiyat/mum verisi getirir.", "args": {"ticker": "THYAO.IS", "timeframe": "1h", "limit": 120}},
            {"name": "get_indicator_catalog", "description": "Desteklenen indikator katalogunu getirir.", "args": {}},
            {"name": "get_indicators", "description": "Ticker/timeframe uzerinde indikator serisi hesaplar.", "args": {"ticker": "THYAO.IS", "timeframe": "1h", "strategy": "rsi", "period": 14, "limit": 200}},
            {"name": "run_backtest", "description": "Blueprint ile gercek backtest calistirir.", "args": {"blueprint": "<blueprint-json>", "async_mode": True}},
            {"name": "get_backtest_status", "description": "Calisan bir backtest job durumunu doner.", "args": {"run_id": "<run-id>"}},
            {"name": "get_backtest_events", "description": "Backtest event listesini getirir.", "args": {"run_id": "<run-id>", "page": 1, "limit": 100}},
            {"name": "get_portfolio_curve", "description": "Backtest portfoy egri verisini getirir.", "args": {"run_id": "<run-id>"}},
            {"name": "list_user_assets", "description": "Kullanicinin kayitli strateji/rule/indicator varliklarini listeler.", "args": {}},
            {"name": "save_user_strategy", "description": "Kullaniciya ait strateji taslagini kaydeder.", "args": {"title": "Trend Builder", "description": "Draft strategy", "prompt": "..." , "spec": {}}},
            {"name": "save_user_rule", "description": "Kullaniciya ait rule taslagini kaydeder.", "args": {"title": "RSI Gate", "description": "Draft rule", "prompt": "...", "spec": {}}},
            {"name": "save_user_indicator", "description": "Kullaniciya ait indicator taslagini kaydeder.", "args": {"title": "Momentum Blend", "description": "Draft indicator", "prompt": "...", "spec": {}}},
        ]

    def build_context_snapshot(self, *, user_id: str) -> dict[str, Any]:
        preset_catalog = BacktestCatalogUseCases.list_presets()
        rule_catalog = BacktestCatalogUseCases.list_rules()
        assets = self._asset_store.list_assets(user_id)
        return {
            "ruleCatalog": {
                "count": rule_catalog["count"],
                "families": rule_catalog["families"],
                "rules": rule_catalog["rules"],
            },
            "presetCatalog": {
                "count": preset_catalog["count"],
                "presets": preset_catalog["presets"],
            },
            "indicatorCatalog": {
                "count": len(INDICATOR_CATALOG),
                "sample": INDICATOR_CATALOG[:12],
            },
            "userAssets": {key: len(values) for key, values in assets.items()},
        }

    def execute(self, *, user_id: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "get_rule_catalog":
            return BacktestCatalogUseCases.list_rules()
        if name == "get_preset_catalog":
            return BacktestCatalogUseCases.list_presets()
        if name == "get_prices":
            return self._execute_get_prices(arguments)
        if name == "get_indicator_catalog":
            return {"count": len(INDICATOR_CATALOG), "indicators": INDICATOR_CATALOG}
        if name == "get_indicators":
            return self._execute_get_indicators(arguments)
        if name == "run_backtest":
            blueprint = arguments.get("blueprint")
            if not isinstance(blueprint, dict):
                raise ValueError("run_backtest icin blueprint object zorunlu.")
            async_mode = bool(arguments.get("async_mode", True))
            return self._start_backtest_use_case.execute(blueprint) if async_mode else self._run_backtest_use_case.execute(blueprint)
        if name == "get_backtest_status":
            run_id = str(arguments.get("run_id") or "").strip()
            if not run_id:
                raise ValueError("get_backtest_status icin run_id zorunlu.")
            payload = self._get_status_use_case.execute(run_id)
            if payload is None:
                raise ValueError(f"Backtest run not found: {run_id}")
            return payload
        if name == "get_backtest_events":
            run_id = str(arguments.get("run_id") or "").strip()
            if not run_id:
                raise ValueError("get_backtest_events icin run_id zorunlu.")
            payload = self._get_events_use_case.execute(run_id, int(arguments.get("page") or 1), int(arguments.get("limit") or 100))
            if payload is None:
                raise ValueError(f"Backtest run not found: {run_id}")
            return payload
        if name == "get_portfolio_curve":
            run_id = str(arguments.get("run_id") or "").strip()
            if not run_id:
                raise ValueError("get_portfolio_curve icin run_id zorunlu.")
            payload = self._get_curve_use_case.execute(run_id)
            if payload is None:
                raise ValueError(f"Backtest run not found: {run_id}")
            return payload
        if name == "list_user_assets":
            return self._asset_store.list_assets(user_id)
        if name in {"save_user_strategy", "save_user_rule", "save_user_indicator"}:
            kind = name.removeprefix("save_user_")
            return self._asset_store.save_asset(
                user_id=user_id,
                kind="indicator" if kind == "indicator" else ("rule" if kind == "rule" else "strategy"),
                title=str(arguments.get("title") or "Untitled"),
                description=str(arguments.get("description") or ""),
                prompt=str(arguments.get("prompt") or "") or None,
                spec=dict(arguments.get("spec") or {}),
            )
        raise ValueError(f"Bilinmeyen AI tool: {name}")

    def _execute_get_prices(self, arguments: dict[str, Any]) -> dict[str, Any]:
        ticker = str(arguments.get("ticker") or "").strip()
        timeframe = str(arguments.get("timeframe") or "1h").strip()
        limit = int(arguments.get("limit") or 120)
        start = self._parse_datetime(arguments.get("start"))
        end = self._parse_datetime(arguments.get("end"))
        df = self._load_prices_dataframe(ticker=ticker, timeframe=timeframe, start=start, end=end, limit=limit)
        return self._frame_to_price_payload(ticker=ticker, timeframe=timeframe, df=df)

    def _execute_get_indicators(self, arguments: dict[str, Any]) -> dict[str, Any]:
        ticker = str(arguments.get("ticker") or "").strip()
        timeframe = str(arguments.get("timeframe") or "1h").strip()
        strategy = normalize_indicator_key(str(arguments.get("strategy") or "").strip())
        if not strategy:
            raise ValueError("get_indicators icin strategy zorunlu.")
        limit = int(arguments.get("limit") or 240)
        start = self._parse_datetime(arguments.get("start"))
        end = self._parse_datetime(arguments.get("end"))
        df = self._load_prices_dataframe(ticker=ticker, timeframe=timeframe, start=start, end=end, limit=limit)
        query_params = {str(key): str(value) for key, value in arguments.items() if key not in {"ticker", "timeframe", "strategy", "start", "end", "limit"}}
        indicators = build_indicator_series(df, strategy, query_params)
        return {
            "ticker": ticker,
            "timeframe": timeframe,
            "strategy": strategy,
            "count": len(indicators),
            "supportedIndicators": supported_indicator_ids(),
            "indicators": indicators[:12],
        }

    def _load_prices_dataframe(
        self,
        *,
        ticker: str,
        timeframe: str,
        start: datetime | None,
        end: datetime | None,
        limit: int | None,
    ) -> pd.DataFrame:
        if not ticker:
            raise ValueError("Ticker zorunlu.")
        if ticker == "TEST":
            return self._test_loader(timeframe=timeframe, start=start, end=end, limit=limit)
        return self._client.fetch_prices_timeframe(
            ticker=ticker,
            timeframe=timeframe,
            start=start,
            end=end,
            limit=limit,
            canonicalize=True,
        )

    @staticmethod
    def _frame_to_price_payload(*, ticker: str, timeframe: str, df: pd.DataFrame) -> dict[str, Any]:
        if df.empty:
            return {"ticker": ticker, "timeframe": timeframe, "rows": 0, "range": None, "bars": []}
        ordered = df.sort_index()
        bars = [
            {
                "t": (row.Index.isoformat() if hasattr(row.Index, "isoformat") else str(row.Index)),
                "o": float(row.open),
                "h": float(row.high),
                "l": float(row.low),
                "c": float(row.close),
                "v": int(row.volume),
            }
            for row in ordered.tail(24).itertuples(index=True)
        ]
        return {
            "ticker": ticker,
            "timeframe": timeframe,
            "rows": int(len(ordered)),
            "range": {
                "from": ordered.index.min().isoformat(),
                "to": ordered.index.max().isoformat(),
            },
            "bars": bars,
        }

    @staticmethod
    def _parse_datetime(raw: Any) -> datetime | None:
        if raw in (None, "", 0):
            return None
        return pd.Timestamp(raw).to_pydatetime()
