from __future__ import annotations

from typing import Any, Protocol

from api.modules.ai.domain.models import (
    AiAssistantReply,
    AiExecutionPlan,
    AiRequestContext,
    AiSessionRecord,
)


class SessionStore(Protocol):
    def create(self, user_id: str, title: str | None = None) -> AiSessionRecord:
        ...

    def save(self, session: AiSessionRecord) -> None:
        ...

    def get(self, session_id: str) -> AiSessionRecord | None:
        ...


class AssetStore(Protocol):
    def list_assets(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        ...

    def save_asset(
        self,
        *,
        user_id: str,
        kind: str,
        title: str,
        description: str,
        prompt: str | None,
        spec: dict[str, Any],
    ) -> dict[str, Any]:
        ...


class ToolGateway(Protocol):
    def describe_tools(self) -> list[dict[str, Any]]:
        ...

    def build_context_snapshot(self, *, user_id: str) -> dict[str, Any]:
        ...

    def execute(self, *, user_id: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        ...


class LlmGateway(Protocol):
    def build_plan(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        context_snapshot: dict[str, Any],
        tools: list[dict[str, Any]],
    ) -> AiExecutionPlan:
        ...

    def compose_reply(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        plan: AiExecutionPlan,
        tool_results: list[dict[str, Any]],
    ) -> AiAssistantReply:
        ...
