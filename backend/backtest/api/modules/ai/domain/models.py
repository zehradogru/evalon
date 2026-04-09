from __future__ import annotations

from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


ChatRole = Literal["user", "assistant", "tool"]
AssetKind = Literal["strategy", "rule", "indicator"]


def utc_epoch_seconds() -> int:
    from time import time

    return int(time())


class AiToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class AiDraftStrategy(BaseModel):
    title: str
    description: str
    blueprint: dict[str, Any] | None = None
    status: str = "draft"


class AiDraftRule(BaseModel):
    title: str
    description: str
    expression: str
    stages: list[str] = Field(default_factory=list)
    status: str = "draft"


class AiDraftIndicator(BaseModel):
    title: str
    description: str
    formula: str
    inputs: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    status: str = "draft"


class AiExecutionPlan(BaseModel):
    intent: str = "analyze"
    tool_calls: list[AiToolCall] = Field(default_factory=list)
    strategy_draft: AiDraftStrategy | None = None
    rule_draft: AiDraftRule | None = None
    indicator_draft: AiDraftIndicator | None = None
    notes: list[str] = Field(default_factory=list)


class AiAssistantReply(BaseModel):
    content: str
    suggested_actions: list[str] = Field(default_factory=list)


class AiChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: f"msg_{uuid4().hex}")
    role: ChatRole
    content: str
    created_at: int = Field(default_factory=utc_epoch_seconds)
    name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AiSessionRecord(BaseModel):
    session_id: str
    user_id: str
    created_at: int = Field(default_factory=utc_epoch_seconds)
    updated_at: int = Field(default_factory=utc_epoch_seconds)
    title: str | None = None
    messages: list[AiChatMessage] = Field(default_factory=list)
    last_plan: AiExecutionPlan | None = None
    last_tool_results: list[dict[str, Any]] = Field(default_factory=list)
    working_context: dict[str, Any] = Field(default_factory=dict)
    last_backtest_run_id: str | None = None
    active_strategy_draft: AiDraftStrategy | None = None


class AiAssetRecord(BaseModel):
    asset_id: str = Field(default_factory=lambda: f"asset_{uuid4().hex}")
    user_id: str
    kind: AssetKind
    title: str
    description: str
    prompt: str | None = None
    spec: dict[str, Any] = Field(default_factory=dict)
    created_at: int = Field(default_factory=utc_epoch_seconds)
    updated_at: int = Field(default_factory=utc_epoch_seconds)


class AiRequestContext(BaseModel):
    user_id: str = "demo"
    ticker: str | None = None
    timeframe: str | None = None
    indicator_id: str | None = None
    active_blueprint: dict[str, Any] | None = None
    selected_symbols: list[str] = Field(default_factory=list)
    auto_save_drafts: bool = False


class AiGraphState(BaseModel):
    session: AiSessionRecord
    request_context: AiRequestContext
    user_message: str
    context_snapshot: dict[str, Any] = Field(default_factory=dict)
    plan: AiExecutionPlan | None = None
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    reply: AiAssistantReply | None = None
    errors: list[str] = Field(default_factory=list)
