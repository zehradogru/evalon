from __future__ import annotations

from typing import Any, TypedDict

from api.modules.ai.application.strategy_support import (
    message_requests_save,
)
from api.modules.ai.domain.contracts import LlmGateway, ToolGateway
from api.modules.ai.domain.models import AiAssistantReply, AiDraftStrategy, AiExecutionPlan, AiGraphState, AiRequestContext, AiToolCall


class _State(TypedDict, total=False):
    session: dict[str, Any]
    request_context: dict[str, Any]
    user_message: str
    context_snapshot: dict[str, Any]
    plan: dict[str, Any]
    tool_results: list[dict[str, Any]]
    reply: dict[str, Any]
    errors: list[str]


class AiLangGraphWorkflow:
    def __init__(self, *, tool_gateway: ToolGateway, llm_gateway: LlmGateway) -> None:
        self._tool_gateway = tool_gateway
        self._llm_gateway = llm_gateway
        self._graph = self._build_graph()

    def invoke(self, state: AiGraphState) -> AiGraphState:
        raw = self._graph.invoke(state.model_dump(mode="python"))
        return AiGraphState.model_validate(raw)

    def _build_graph(self) -> Any:
        from langgraph.graph import END, StateGraph

        graph = StateGraph(_State)
        graph.add_node("load_context", self._load_context_node)
        graph.add_node("build_plan", self._build_plan_node)
        graph.add_node("execute_tools", self._execute_tools_node)
        graph.add_node("compose_reply", self._compose_reply_node)
        graph.set_entry_point("load_context")
        graph.add_edge("load_context", "build_plan")
        graph.add_edge("build_plan", "execute_tools")
        graph.add_edge("execute_tools", "compose_reply")
        graph.add_edge("compose_reply", END)
        return graph.compile()

    def _load_context_node(self, state: _State) -> dict[str, Any]:
        request_context = state["request_context"]
        return {
            "context_snapshot": self._tool_gateway.build_context_snapshot(user_id=str(request_context["user_id"])),
            "errors": list(state.get("errors") or []),
        }

    def _build_plan_node(self, state: _State) -> dict[str, Any]:
        session = state["session"]
        request_context = state["request_context"]
        context_snapshot = state.get("context_snapshot") or {}
        model_state = AiGraphState.model_validate(state)
        plan = self._llm_gateway.build_plan(
            user_message=state["user_message"],
            session=model_state.session,
            request_context=model_state.request_context,
            context_snapshot=context_snapshot,
            tools=self._tool_gateway.describe_tools(),
        )
        plan = self._normalize_plan(
            plan=plan,
            session=model_state.session,
            request_context=model_state.request_context,
            user_message=state["user_message"],
        )
        return {
            "plan": plan.model_dump(mode="python"),
            "errors": list(state.get("errors") or []),
            "session": session,
            "request_context": request_context,
        }

    def _execute_tools_node(self, state: _State) -> dict[str, Any]:
        plan = AiExecutionPlan.model_validate(state.get("plan") or {})
        request_context = state["request_context"]
        results: list[dict[str, Any]] = []
        errors = list(state.get("errors") or [])
        for tool_call in plan.tool_calls:
            try:
                result = self._tool_gateway.execute(
                    user_id=str(request_context["user_id"]),
                    name=tool_call.name,
                    arguments=tool_call.arguments,
                )
                results.append({"tool": tool_call.name, "arguments": tool_call.arguments, "result": result})
            except Exception as exc:
                errors.append(f"{tool_call.name}: {exc}")
                results.append({"tool": tool_call.name, "arguments": tool_call.arguments, "error": str(exc)})
        return {
            "tool_results": results,
            "errors": errors,
        }

    def _compose_reply_node(self, state: _State) -> dict[str, Any]:
        model_state = AiGraphState.model_validate(state)
        plan = model_state.plan or AiExecutionPlan()
        reply = self._llm_gateway.compose_reply(
            user_message=model_state.user_message,
            session=model_state.session,
            request_context=model_state.request_context,
            plan=plan,
            tool_results=model_state.tool_results,
        )
        return {
            "reply": reply.model_dump(mode="python"),
            "errors": model_state.errors,
        }

    @staticmethod
    def _normalize_plan(
        *,
        plan: AiExecutionPlan,
        session: Any,
        request_context: AiRequestContext,
        user_message: str,
    ) -> AiExecutionPlan:
        normalized = plan.model_copy(deep=True)
        
        # Sadece eksik tool'ları tamamla (güvenlik ağı). LLM kendi yazdıysa dokunma.
        
        # Eğer aktif drafting devam ediyorsa, önceki draft'ı koru.
        if normalized.strategy_draft is None and request_context.active_blueprint:
             normalized.strategy_draft = AiDraftStrategy(
                 title="Active Blueprint",
                 description="Şu anki aktif blueprint bağlamı",
                 blueprint=request_context.active_blueprint
             )
             
        if message_requests_save(user_message) and normalized.strategy_draft is not None:
            if not AiLangGraphWorkflow._has_tool(normalized, "save_user_strategy"):
                normalized.tool_calls.append(AiToolCall(
                    name="save_user_strategy",
                    arguments={
                        "title": normalized.strategy_draft.title,
                        "description": normalized.strategy_draft.description,
                        "prompt": user_message,
                        "spec": normalized.strategy_draft.model_dump(mode="python"),
                    },
                ))
        # "backtest" aracını çağırmış ama argüman göndermeyi unutmuşsa vs.
        for tool in normalized.tool_calls:
            if tool.name == "run_backtest":
                if not tool.arguments.get("blueprint"):
                    if normalized.strategy_draft and normalized.strategy_draft.blueprint:
                        tool.arguments["blueprint"] = normalized.strategy_draft.blueprint
                    elif request_context.active_blueprint:
                        tool.arguments["blueprint"] = request_context.active_blueprint
                    else:
                        normalized.notes.append("Backtest çalıştırabilmek için önce bir strateji (blueprint) belirlemeliyiz.")
                        # Geçersiz tool'u kaldır
                        normalized.tool_calls.remove(tool)
            elif tool.name == "get_backtest_status":
                if not tool.arguments.get("run_id") and session.last_backtest_run_id:
                    tool.arguments["run_id"] = session.last_backtest_run_id

        normalized.notes = list(dict.fromkeys(normalized.notes))
        return normalized

    @staticmethod
    def _has_tool(plan: AiExecutionPlan, tool_name: str) -> bool:
        return any(tool_call.name == tool_name for tool_call in plan.tool_calls)
