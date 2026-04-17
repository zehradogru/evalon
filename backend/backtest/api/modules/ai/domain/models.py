from __future__ import annotations

from typing import Dict, List,  Union, Optional, Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


ChatRole = Literal["user", "assistant", "tool"]
AssetKind = Literal["strategy", "rule", "indicator"]


def utc_epoch_seconds() -> int:
    from time import time

    return int(time())


class AiToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class AiDraftStrategy(BaseModel):
    title: str
    description: str
    blueprint: Dict[str, Any] | None = None
    status: str = "draft"


class AiDraftRule(BaseModel):
    title: str
    description: str
    expression: str
    stages: List[str] = Field(default_factory=list)
    status: str = "draft"


class AiDraftIndicator(BaseModel):
    title: str
    description: str
    formula: str
    inputs: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    status: str = "draft"


class AiExecutionPlan(BaseModel):
    intent: str = "analyze"
    tool_calls: List[AiToolCall] = Field(default_factory=list)
    strategy_draft: Optional[AiDraftStrategy] = None
    rule_draft: Optional[AiDraftRule] = None
    indicator_draft: Optional[AiDraftIndicator] = None
    notes: List[str] = Field(default_factory=list)


class AiAssistantReply(BaseModel):
    content: str
    suggested_actions: List[str] = Field(default_factory=list)


class AiChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: f"msg_{uuid4().hex}")
    role: ChatRole
    content: str
    created_at: int = Field(default_factory=utc_epoch_seconds)
    name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AiSessionRecord(BaseModel):
    session_id: str
    user_id: str
    created_at: int = Field(default_factory=utc_epoch_seconds)
    updated_at: int = Field(default_factory=utc_epoch_seconds)
    title: Optional[str] = None
    messages: List[AiChatMessage] = Field(default_factory=list)
    last_plan: Optional[AiExecutionPlan] = None
    last_tool_results: List[Dict[str, Any]] = Field(default_factory=list)
    working_context: Dict[str, Any] = Field(default_factory=dict)
    last_backtest_run_id: Optional[str] = None
    active_strategy_draft: Optional[AiDraftStrategy] = None


class AiAssetRecord(BaseModel):
    asset_id: str = Field(default_factory=lambda: f"asset_{uuid4().hex}")
    user_id: str
    kind: AssetKind
    title: str
    description: str
    prompt: Optional[str] = None
    spec: Dict[str, Any] = Field(default_factory=dict)
    created_at: int = Field(default_factory=utc_epoch_seconds)
    updated_at: int = Field(default_factory=utc_epoch_seconds)


class AiRequestContext(BaseModel):
    user_id: str = "demo"
    ticker: Optional[str] = None
    timeframe: Optional[str] = None
    indicator_id: Optional[str] = None
    active_blueprint: Dict[str, Any] | None = None
    selected_symbols: List[str] = Field(default_factory=list)
    auto_save_drafts: bool = False


class AiGraphState(BaseModel):
    session: AiSessionRecord
    request_context: AiRequestContext
    user_message: str
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)
    plan: Optional[AiExecutionPlan] = None
    tool_results: List[Dict[str, Any]] = Field(default_factory=list)
    reply: Optional[AiAssistantReply] = None
    errors: List[str] = Field(default_factory=list)
