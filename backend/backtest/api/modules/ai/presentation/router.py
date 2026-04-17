from __future__ import annotations

from pathlib import Path
from typing import Dict, List,  Union, Optional, Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from data_clients.bist_prices_client import BistPricesClient
from api.modules.ai.application.use_cases import (
    GetAiSessionUseCase,
    ListAiAssetsUseCase,
    ProcessAiMessageUseCase,
    SaveAiAssetUseCase,
    StartAiSessionUseCase,
)
from api.modules.ai.domain.models import AiRequestContext
from api.modules.ai.infrastructure.langgraph.graph import AiLangGraphWorkflow
from api.modules.ai.infrastructure.llm.gemini_gateway import GeminiLlmGateway
from api.modules.ai.infrastructure.stores import InMemoryAiSessionStore, JsonFileAiAssetStore
from api.modules.ai.infrastructure.tool_gateway import AiToolGateway
from api.modules.backtests.infrastructure.run_store import InMemoryRunStore


class CreateAiSessionRequest(BaseModel):
    userId: str = "demo"
    title: Optional[str] = None


class AiMessageRequest(BaseModel):
    content: str
    context: AiRequestContext = Field(default_factory=AiRequestContext)


class SaveAiAssetRequest(BaseModel):
    userId: str = "demo"
    title: str
    description: str = ""
    prompt: Optional[str] = None
    spec: Dict[str, Any] = Field(default_factory=dict)


def create_ai_router(
    *,
    client: BistPricesClient,
    test_loader: Any,
    run_store: InMemoryRunStore,
    asset_store_path: Union[str, Path],
) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["ai"])
    session_store = InMemoryAiSessionStore()
    asset_store = JsonFileAiAssetStore(asset_store_path)
    tool_gateway = AiToolGateway(
        client=client,
        test_loader=test_loader,
        run_store=run_store,
        asset_store=asset_store,
    )
    llm_gateway = GeminiLlmGateway()
    workflow = AiLangGraphWorkflow(tool_gateway=tool_gateway, llm_gateway=llm_gateway)

    start_session_use_case = StartAiSessionUseCase(session_store)
    get_session_use_case = GetAiSessionUseCase(session_store)
    process_message_use_case = ProcessAiMessageUseCase(session_store, asset_store, workflow)
    list_assets_use_case = ListAiAssetsUseCase(asset_store)
    save_strategy_use_case = SaveAiAssetUseCase(asset_store, "strategy")
    save_rule_use_case = SaveAiAssetUseCase(asset_store, "rule")
    save_indicator_use_case = SaveAiAssetUseCase(asset_store, "indicator")

    @router.get("/ai/tools")
    def get_ai_tool_catalog() -> Dict[str, Any]:
        return {
            "count": len(tool_gateway.describe_tools()),
            "tools": tool_gateway.describe_tools(),
        }

    @router.post("/ai/sessions")
    def create_ai_session(body: CreateAiSessionRequest) -> Dict[str, Any]:
        try:
            return start_session_use_case.execute(user_id=body.userId, title=body.title)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/ai/sessions/{session_id}")
    def get_ai_session(session_id: str) -> Dict[str, Any]:
        payload = get_session_use_case.execute(session_id)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"AI session not found: {session_id}")
        return payload

    @router.post("/ai/sessions/{session_id}/messages")
    def post_ai_message(session_id: str, body: AiMessageRequest) -> Dict[str, Any]:
        try:
            return process_message_use_case.execute(
                session_id=session_id,
                content=body.content,
                request_context=body.context,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/ai/assets")
    def list_ai_assets(user_id: str = Query("demo", alias="userId")) -> Dict[str, Any]:
        return list_assets_use_case.execute(user_id=user_id)

    @router.post("/ai/strategies")
    def save_ai_strategy(body: SaveAiAssetRequest) -> Dict[str, Any]:
        return save_strategy_use_case.execute(
            user_id=body.userId,
            title=body.title,
            description=body.description,
            prompt=body.prompt,
            spec=body.spec,
        )

    @router.post("/ai/rules")
    def save_ai_rule(body: SaveAiAssetRequest) -> Dict[str, Any]:
        return save_rule_use_case.execute(
            user_id=body.userId,
            title=body.title,
            description=body.description,
            prompt=body.prompt,
            spec=body.spec,
        )

    @router.post("/ai/indicators")
    def save_ai_indicator(body: SaveAiAssetRequest) -> Dict[str, Any]:
        return save_indicator_use_case.execute(
            user_id=body.userId,
            title=body.title,
            description=body.description,
            prompt=body.prompt,
            spec=body.spec,
        )

    return router
