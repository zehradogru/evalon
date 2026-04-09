from __future__ import annotations

from typing import Any

from api.modules.ai.application.context_resolver import resolve_request_context
from api.modules.ai.domain.contracts import AssetStore, SessionStore
from api.modules.ai.domain.models import AiChatMessage, AiGraphState, AiRequestContext


class StartAiSessionUseCase:
    def __init__(self, session_store: SessionStore) -> None:
        self._session_store = session_store

    def execute(self, *, user_id: str, title: str | None = None) -> dict[str, Any]:
        session = self._session_store.create(user_id=user_id, title=title)
        return {
            "sessionId": session.session_id,
            "userId": session.user_id,
            "createdAt": session.created_at,
            "title": session.title,
            "messages": [],
        }


class GetAiSessionUseCase:
    def __init__(self, session_store: SessionStore) -> None:
        self._session_store = session_store

    def execute(self, session_id: str) -> dict[str, Any] | None:
        session = self._session_store.get(session_id)
        if session is None:
            return None
        return session.model_dump(mode="python")


class ProcessAiMessageUseCase:
    def __init__(
        self,
        session_store: SessionStore,
        asset_store: AssetStore,
        workflow: Any,
    ) -> None:
        self._session_store = session_store
        self._asset_store = asset_store
        self._workflow = workflow

    def execute(
        self,
        *,
        session_id: str,
        content: str,
        request_context: AiRequestContext,
    ) -> dict[str, Any]:
        session = self._session_store.get(session_id)
        if session is None:
            raise ValueError(f"AI session not found: {session_id}")

        merged_request_context = resolve_request_context(
            session=session,
            incoming=request_context,
            user_message=content,
        )

        if session.active_strategy_draft and not merged_request_context.active_blueprint:
            merged_request_context.active_blueprint = session.active_strategy_draft.blueprint

        user_message = AiChatMessage(role="user", content=content)
        session.messages.append(user_message)
        session.updated_at = user_message.created_at

        graph_state = AiGraphState(
            session=session,
            request_context=merged_request_context,
            user_message=content,
        )
        next_state = self._workflow.invoke(graph_state)

        if next_state.plan and next_state.plan.strategy_draft:
            session.active_strategy_draft = next_state.plan.strategy_draft
        if next_state.plan and next_state.plan.strategy_draft and next_state.plan.strategy_draft.blueprint:
            merged_request_context.active_blueprint = next_state.plan.strategy_draft.blueprint
        
        for res in next_state.tool_results:
            if res.get("tool") == "run_backtest" and res.get("result", {}).get("runId"):
                session.last_backtest_run_id = res["result"]["runId"]

        saved_assets: list[dict[str, Any]] = []
        if merged_request_context.auto_save_drafts and next_state.plan is not None:
            saved_assets.extend(self._save_drafts(merged_request_context.user_id, next_state.plan, content))

        assistant = AiChatMessage(
            role="assistant",
            content=(next_state.reply.content if next_state.reply else "Hazir."),
            metadata={
                "toolResultsCount": len(next_state.tool_results),
                "suggestedActions": list(next_state.reply.suggested_actions if next_state.reply else []),
                "savedAssets": saved_assets,
            },
        )
        session.messages.append(assistant)
        session.updated_at = assistant.created_at
        session.last_plan = next_state.plan
        session.last_tool_results = next_state.tool_results
        session.working_context = merged_request_context.model_dump(mode="python")
        self._session_store.save(session)

        return {
            "sessionId": session.session_id,
            "message": assistant.model_dump(mode="python"),
            "plan": next_state.plan.model_dump(mode="python") if next_state.plan else None,
            "toolResults": next_state.tool_results,
            "savedAssets": saved_assets,
            "errors": next_state.errors,
            "drafts": self._draft_bundle(next_state),
            "resolvedContext": merged_request_context.model_dump(mode="python"),
        }

    def _save_drafts(self, user_id: str, plan: Any, prompt: str) -> list[dict[str, Any]]:
        saved: list[dict[str, Any]] = []
        if plan.strategy_draft is not None:
            saved.append(self._asset_store.save_asset(
                user_id=user_id,
                kind="strategy",
                title=plan.strategy_draft.title,
                description=plan.strategy_draft.description,
                prompt=prompt,
                spec=plan.strategy_draft.model_dump(mode="python"),
            ))
        if plan.rule_draft is not None:
            saved.append(self._asset_store.save_asset(
                user_id=user_id,
                kind="rule",
                title=plan.rule_draft.title,
                description=plan.rule_draft.description,
                prompt=prompt,
                spec=plan.rule_draft.model_dump(mode="python"),
            ))
        if plan.indicator_draft is not None:
            saved.append(self._asset_store.save_asset(
                user_id=user_id,
                kind="indicator",
                title=plan.indicator_draft.title,
                description=plan.indicator_draft.description,
                prompt=prompt,
                spec=plan.indicator_draft.model_dump(mode="python"),
            ))
        return saved

    @staticmethod
    def _draft_bundle(next_state: AiGraphState) -> dict[str, Any]:
        plan = next_state.plan
        if plan is None:
            return {}
        payload: dict[str, Any] = {}
        if plan.strategy_draft is not None:
            payload["strategy"] = plan.strategy_draft.model_dump(mode="python")
        if plan.rule_draft is not None:
            payload["rule"] = plan.rule_draft.model_dump(mode="python")
        if plan.indicator_draft is not None:
            payload["indicator"] = plan.indicator_draft.model_dump(mode="python")
        return payload


class ListAiAssetsUseCase:
    def __init__(self, asset_store: AssetStore) -> None:
        self._asset_store = asset_store

    def execute(self, *, user_id: str) -> dict[str, Any]:
        assets = self._asset_store.list_assets(user_id)
        return {
            "userId": user_id,
            "counts": {key: len(values) for key, values in assets.items()},
            "assets": assets,
        }


class SaveAiAssetUseCase:
    def __init__(self, asset_store: AssetStore, kind: str) -> None:
        self._asset_store = asset_store
        self._kind = kind

    def execute(
        self,
        *,
        user_id: str,
        title: str,
        description: str,
        prompt: str | None,
        spec: dict[str, Any],
    ) -> dict[str, Any]:
        return self._asset_store.save_asset(
            user_id=user_id,
            kind=self._kind,
            title=title,
            description=description,
            prompt=prompt,
            spec=spec,
        )
