from __future__ import annotations

import json
import os
from typing import Dict, List,  Union, Optional, Any

from api.modules.ai.domain.models import AiAssistantReply, AiExecutionPlan, AiRequestContext, AiSessionRecord
from api.modules.ai.infrastructure.llm.heuristic_gateway import HeuristicLlmGateway


from api.modules.ai.infrastructure.llm.system_prompts import PLANNING_SYSTEM_PROMPT, COMPOSE_SYSTEM_PROMPT


class GeminiLlmGateway:
    def __init__(self) -> None:
        self._fallback = HeuristicLlmGateway()
        self._planning_model = os.environ.get("AI_AGENT_MODEL", "gemini-2.5-flash")
        self._summary_model = os.environ.get("AI_SUMMARY_MODEL", "gemini-2.5-flash")
        self._project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        self._location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

    def build_plan(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        context_snapshot: Dict[str, Any],
        tools: List[Dict[str, Any]],
    ) -> AiExecutionPlan:
        client = self._build_client()
        if client is None:
            return self._fallback.build_plan(
                user_message=user_message,
                session=session,
                request_context=request_context,
                context_snapshot=context_snapshot,
                tools=tools,
            )

        prompt = (
            f"SYSTEM PROMPT:\n{PLANNING_SYSTEM_PROMPT}\n\n"
            f"Request context: {json.dumps(request_context.model_dump(mode='python'), ensure_ascii=True, default=str)}\n"
            f"Session messages (last 12): {json.dumps([message.model_dump(mode='python') for message in session.messages[-12:]], ensure_ascii=True, default=str)}\n"
            f"Last tool results: {json.dumps(session.last_tool_results, ensure_ascii=True, default=str)}\n"
            f"Context snapshot (available catalogs and rules): {json.dumps(context_snapshot, ensure_ascii=True, default=str)}\n"
            f"Available Tools: {json.dumps(tools, ensure_ascii=True, default=str)}\n\n"
            f"User message: {user_message}\n"
        )
        text = self._generate_text(client=client, model=self._planning_model, prompt=prompt, is_planning=True)
        if not text:
            return self._fallback.build_plan(
                user_message=user_message,
                session=session,
                request_context=request_context,
                context_snapshot=context_snapshot,
                tools=tools,
            )
        try:
            return AiExecutionPlan.model_validate(self._extract_json_payload(text))
        except Exception:
            return self._fallback.build_plan(
                user_message=user_message,
                session=session,
                request_context=request_context,
                context_snapshot=context_snapshot,
                tools=tools,
            )

    def compose_reply(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        plan: AiExecutionPlan,
        tool_results: List[Dict[str, Any]],
    ) -> AiAssistantReply:
        client = self._build_client()
        fallback_reply = self._fallback.compose_reply(
            user_message=user_message,
            session=session,
            request_context=request_context,
            plan=plan,
            tool_results=tool_results,
        )
        if client is None:
            return fallback_reply

        prompt = (
            f"SYSTEM PROMPT:\n{COMPOSE_SYSTEM_PROMPT}\n\n"
            f"Request context: {json.dumps(request_context.model_dump(mode='python'), ensure_ascii=True, default=str)}\n"
            f"Plan executed: {plan.model_dump_json()}\n"
            f"Tool results (Very Important! Analyze these): {json.dumps(tool_results, ensure_ascii=True, default=str)}\n"
            f"Recent session (last 12 messages): {json.dumps([message.model_dump(mode='python') for message in session.messages[-12:]], ensure_ascii=True, default=str)}\n\n"
            f"User message: {user_message}\n"
        )
        text = self._generate_text(client=client, model=self._summary_model, prompt=prompt, is_planning=False)
        if not text:
            return fallback_reply
        try:
            reply = AiAssistantReply.model_validate(self._extract_json_payload(text))
            if not reply.suggested_actions:
                reply.suggested_actions = fallback_reply.suggested_actions[:4]
            else:
                reply.suggested_actions = reply.suggested_actions[:4]
            return reply
        except Exception:
            return fallback_reply

    def _build_client(self) -> Optional[Any]:
        try:
            from google import genai
        except Exception:
            return None

        # Standard API Key support
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                return genai.Client(api_key=api_key)
            except Exception:
                pass

        # Vertex AI support
        if not self._project:
            return None
        try:
            return genai.Client(vertexai=True, project=self._project, location=self._location)
        except Exception:
            return None

    @staticmethod
    def _generate_text(*, client: Any, model: str, prompt: str, is_planning: bool = False) -> str:
        try:
            from google.genai import types

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2 if is_planning else 0.4,
                    max_output_tokens=4096 if is_planning else 2048,
                ),
            )
            text = getattr(response, "text", None)
            return text.strip() if isinstance(text, str) else ""
        except Exception:
            return ""

    @staticmethod
    def _extract_json_payload(text: str) -> Dict[str, Any]:
        value = text.strip()
        if "```" in value:
            segments = [segment.strip() for segment in value.split("```") if segment.strip()]
            for segment in segments:
                cleaned = segment.removeprefix("json").strip()
                if cleaned.startswith("{") and cleaned.endswith("}"):
                    return json.loads(cleaned)
        if value.startswith("{") and value.endswith("}"):
            return json.loads(value)
        start = value.find("{")
        end = value.rfind("}")
        if start >= 0 and end > start:
            return json.loads(value[start:end + 1])
        raise ValueError("JSON payload parse edilemedi.")


