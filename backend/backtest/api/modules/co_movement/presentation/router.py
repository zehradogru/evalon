from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from api.modules.co_movement.application.use_cases import AnalyzeCoMovementUseCase, ExplainCoMovementUseCase
from api.modules.co_movement.application.use_cases import (
    GetCoMovementSnapshotUseCase,
    GetLatestCoMovementMatrixUseCase,
    GetLatestCoMovementSnapshotUseCase,
    ListCoMovementSnapshotsUseCase,
)
from api.modules.co_movement.domain.models import CoMovementAnalyzeInput, CoMovementExplainInput
from api.modules.co_movement.infrastructure.explainer import CoMovementExplainer
from api.modules.co_movement.infrastructure.market_data import CoMovementMarketDataGateway
from api.modules.co_movement.infrastructure.snapshot_store import CoMovementSnapshotStore
from data_clients.bist_prices_client import BistPricesClient


class AnalyzeCoMovementRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=2, max_length=60)
    start_date: date
    end_date: date
    top_k: int = Field(3, ge=1, le=10)
    min_similarity: float = Field(0.60, ge=0.0, le=1.0)
    rolling_window: int = Field(90, ge=20, le=365)
    rolling_step: int = Field(20, ge=1, le=180)
    max_missing_ratio: float = Field(0.15, ge=0.0, le=0.8)
    min_history_rows: int = Field(60, ge=20, le=1000)
    timeframe: str = Field("1d", min_length=2, max_length=8)


class ExplainCoMovementRequest(BaseModel):
    top_pairs: list[dict[str, Any]] = Field(default_factory=list)
    communities: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    language: str = Field("tr", min_length=2, max_length=16)
    symbols: list[str] = Field(default_factory=list)
    date_range: dict[str, Any] = Field(default_factory=dict)


def create_co_movement_router(
    client: BistPricesClient,
    *,
    snapshot_store_path: str,
) -> APIRouter:
    router = APIRouter(prefix="/v1/co-movement", tags=["co-movement"])
    data_gateway = CoMovementMarketDataGateway(client)
    analyze_use_case = AnalyzeCoMovementUseCase(data_gateway)
    explain_use_case = ExplainCoMovementUseCase(CoMovementExplainer())
    snapshot_store = CoMovementSnapshotStore(snapshot_store_path)
    list_snapshots_use_case = ListCoMovementSnapshotsUseCase(snapshot_store)
    latest_snapshot_use_case = GetLatestCoMovementSnapshotUseCase(snapshot_store)
    snapshot_use_case = GetCoMovementSnapshotUseCase(snapshot_store)
    latest_matrix_use_case = GetLatestCoMovementMatrixUseCase(snapshot_store)

    @router.get("/symbols")
    def list_symbols(
        search: str = Query("", min_length=0, max_length=32),
        limit: int = Query(100, ge=1, le=500),
    ) -> dict[str, Any]:
        try:
            return data_gateway.search_symbols(search=search, limit=limit)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/snapshots")
    def list_snapshots() -> dict[str, Any]:
        try:
            snapshots = list_snapshots_use_case.execute()
            return {"count": len(snapshots), "snapshots": snapshots}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/snapshots/latest")
    def get_latest_snapshot() -> dict[str, Any]:
        try:
            return latest_snapshot_use_case.execute()
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/snapshots/{snapshot_id}")
    def get_snapshot(snapshot_id: str) -> dict[str, Any]:
        try:
            return snapshot_use_case.execute(snapshot_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/snapshots/latest/matrices/{matrix_name}")
    def get_latest_matrix(
        matrix_name: str,
        symbols: str = Query("", description="Comma separated ticker subset"),
    ) -> dict[str, Any]:
        try:
            selected_symbols = [item.strip().upper() for item in symbols.split(",") if item.strip()]
            return latest_matrix_use_case.execute(
                matrix_name,
                symbols=selected_symbols or None,
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post("/analyze")
    def analyze_co_movement(body: AnalyzeCoMovementRequest) -> dict[str, Any]:
        try:
            request = CoMovementAnalyzeInput(
                symbols=body.symbols,
                start_date=body.start_date,
                end_date=body.end_date,
                top_k=body.top_k,
                min_similarity=body.min_similarity,
                rolling_window=body.rolling_window,
                rolling_step=body.rolling_step,
                max_missing_ratio=body.max_missing_ratio,
                min_history_rows=body.min_history_rows,
                timeframe=body.timeframe,
            )
            return analyze_use_case.execute(request)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post("/explain")
    def explain_co_movement(body: ExplainCoMovementRequest) -> dict[str, Any]:
        try:
            request = CoMovementExplainInput(
                top_pairs=body.top_pairs,
                communities=body.communities,
                metrics=body.metrics,
                language=body.language,
                symbols=body.symbols,
                date_range=body.date_range,
            )
            return explain_use_case.execute(request)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return router
