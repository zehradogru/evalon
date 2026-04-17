from __future__ import annotations

from typing import Dict, List,  Union, Optional, Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from data_clients.bist_prices_client import BistPricesClient
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


class BacktestRuleSelection(BaseModel):
    id: str
    required: bool
    params: Dict[str, float] = Field(default_factory=dict)


class BacktestStageConfig(BaseModel):
    key: str
    timeframe: str
    required: bool
    minOptionalMatches: int
    rules: List[BacktestRuleSelection] = Field(default_factory=list)


class BacktestRiskConfig(BaseModel):
    stopPct: float
    targetPct: float
    maxBars: int


class BacktestPortfolioConfig(BaseModel):
    initialCapital: Optional[float] = None
    positionSize: Optional[float] = None
    commissionPct: Optional[float] = None


class BacktestBlueprintRequest(BaseModel):
    symbol: Optional[str] = None
    symbols: List[str] = Field(default_factory=list)
    stageThreshold: int
    direction: str
    testWindowDays: int = 365
    portfolio: Optional[BacktestPortfolioConfig] = None
    risk: BacktestRiskConfig
    stages: Dict[str, BacktestStageConfig]


def create_backtest_router(
    client: BistPricesClient,
    test_loader: Any,
    run_store: Optional[InMemoryRunStore] = None,
) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["backtests"])
    market_data_gateway = MarketDataGateway(client=client, test_loader=test_loader)
    run_store = run_store or InMemoryRunStore()
    run_backtest_use_case = RunBlueprintBacktestUseCase(market_data_gateway, run_store)
    start_backtest_use_case = StartBlueprintBacktestUseCase(market_data_gateway, run_store)
    get_run_events_use_case = GetRunEventsUseCase(run_store)
    get_run_portfolio_curve_use_case = GetRunPortfolioCurveUseCase(run_store)
    get_run_status_use_case = GetRunStatusUseCase(run_store)

    @router.get("/backtests/catalog/rules")
    def get_backtest_rule_catalog() -> Dict[str, Any]:
        return BacktestCatalogUseCases.list_rules()

    @router.get("/backtests/catalog/presets")
    def get_backtest_preset_catalog() -> Dict[str, Any]:
        return BacktestCatalogUseCases.list_presets()

    @router.post("/backtests/run")
    def run_backtest(body: BacktestBlueprintRequest) -> Dict[str, Any]:
        try:
            return run_backtest_use_case.execute(body.model_dump(exclude_none=True))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/backtests/start")
    def start_backtest(body: BacktestBlueprintRequest) -> Dict[str, Any]:
        try:
            return start_backtest_use_case.execute(body.model_dump(exclude_none=True))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/backtests/{run_id}/status")
    def get_backtest_status(run_id: str) -> Dict[str, Any]:
        payload = get_run_status_use_case.execute(run_id)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Backtest run not found: {run_id}")
        return payload

    @router.get("/backtests/{run_id}/events")
    def get_backtest_events(
        run_id: str,
        page: int = Query(1, ge=1),
        limit: int = Query(200, ge=1, le=500),
    ) -> Dict[str, Any]:
        payload = get_run_events_use_case.execute(run_id, page, limit)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Backtest run not found: {run_id}")
        return payload

    @router.get("/backtests/{run_id}/portfolio-curve")
    def get_backtest_portfolio_curve(run_id: str) -> Dict[str, Any]:
        payload = get_run_portfolio_curve_use_case.execute(run_id)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Backtest run not found: {run_id}")
        return payload

    return router
