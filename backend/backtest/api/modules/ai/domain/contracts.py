from __future__ import annotations

from typing import Dict, List,  Union, Optional, Any, Protocol

from api.modules.ai.domain.models import (
    AiAssistantReply,
    AiExecutionPlan,
    AiRequestContext,
    AiSessionRecord,
)


class SessionStore(Protocol):
    def create(self, user_id: str, title: Optional[str] = None) -> AiSessionRecord:
        ...

    def save(self, session: AiSessionRecord) -> None:
        ...

    def get(self, session_id: str) -> Optional[AiSessionRecord]:
        ...


class AssetStore(Protocol):
    def list_assets(self, user_id: str) -> Dict[str, List[Dict[str, Any]]]:
        ...

    def save_asset(
        self,
        *,
        user_id: str,
        kind: str,
        title: str,
        description: str,
        prompt: Optional[str],
        spec: Dict[str, Any],
    ) -> Dict[str, Any]:
        ...


class ToolGateway(Protocol):
    def describe_tools(self) -> List[Dict[str, Any]]:
        ...

    def build_context_snapshot(self, *, user_id: str) -> Dict[str, Any]:
        ...

    def execute(self, *, user_id: str, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ...


class LlmGateway(Protocol):
    def build_plan(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        context_snapshot: Dict[str, Any],
        tools: List[Dict[str, Any]],
    ) -> AiExecutionPlan:
        ...

    def compose_reply(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        plan: AiExecutionPlan,
        tool_results: List[Dict[str, Any]],
    ) -> AiAssistantReply:
        ...
