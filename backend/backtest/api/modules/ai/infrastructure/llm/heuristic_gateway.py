from __future__ import annotations

from typing import Any

from api.modules.ai.domain.models import (
    AiAssistantReply,
    AiDraftIndicator,
    AiDraftRule,
    AiDraftStrategy,
    AiExecutionPlan,
    AiRequestContext,
    AiSessionRecord,
    AiToolCall,
)


class HeuristicLlmGateway:
    def build_plan(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        context_snapshot: dict[str, Any],
        tools: list[dict[str, Any]],
    ) -> AiExecutionPlan:
        del session, context_snapshot, tools

        text = user_message.lower()
        plan = AiExecutionPlan(intent=self._detect_intent(text))

        if any(keyword in text for keyword in ("preset", "hazir strateji", "hazır strateji", "kombinasyon")):
            plan.tool_calls.append(AiToolCall(name="get_preset_catalog"))

        if any(keyword in text for keyword in ("rule", "kural")):
            plan.tool_calls.append(AiToolCall(name="get_rule_catalog"))

        if any(keyword in text for keyword in ("indikat", "indicator")):
            plan.tool_calls.append(AiToolCall(name="get_indicator_catalog"))

        if any(keyword in text for keyword in ("fiyat", "mum", "price", "veri", "ohlcv")) and request_context.ticker:
            plan.tool_calls.append(
                AiToolCall(
                    name="get_prices",
                    arguments={
                        "ticker": request_context.ticker,
                        "timeframe": request_context.timeframe or "1h",
                        "limit": 120,
                    },
                )
            )

        if any(keyword in text for keyword in ("indikat", "indicator", "rsi", "macd", "ema", "sma")) and request_context.ticker:
            indicator_id = request_context.indicator_id or self._guess_indicator_id(text)
            if indicator_id:
                plan.tool_calls.append(
                    AiToolCall(
                        name="get_indicators",
                        arguments={
                            "ticker": request_context.ticker,
                            "timeframe": request_context.timeframe or "1h",
                            "strategy": indicator_id,
                            "limit": 200,
                        },
                    )
                )

        if "backtest" in text:
            if request_context.active_blueprint:
                plan.tool_calls.append(
                    AiToolCall(
                        name="run_backtest",
                        arguments={
                            "blueprint": request_context.active_blueprint,
                            "async_mode": True,
                        },
                    )
                )
            else:
                plan.notes.append("Backtest calistirmak icin active_blueprint gerekli.")

        if any(keyword in text for keyword in ("strateji olustur", "strateji oluştur", "strategy build", "strateji yaz")):
            title = self._title_from_message(user_message, "Strategy Draft")
            plan.strategy_draft = AiDraftStrategy(
                title=title,
                description="Kullanici isteginden uretilen ilk strateji taslagi.",
                blueprint=request_context.active_blueprint,
            )

        if any(keyword in text for keyword in ("rule olustur", "rule oluştur", "kural olustur", "kural oluştur")):
            title = self._title_from_message(user_message, "Rule Draft")
            plan.rule_draft = AiDraftRule(
                title=title,
                description="Kullanici isteginden uretilen ilk rule taslagi.",
                expression=user_message.strip(),
                stages=["trend", "setup", "trigger"],
            )

        if any(keyword in text for keyword in ("indikatör oluştur", "indikatör olustur", "indicator create", "indicator build")):
            title = self._title_from_message(user_message, "Indicator Draft")
            plan.indicator_draft = AiDraftIndicator(
                title=title,
                description="Kullanici isteginden uretilen ilk indicator taslagi.",
                formula=user_message.strip(),
                inputs=["close"],
            )

        if any(keyword in text for keyword in ("kaydet", "save")):
            if plan.strategy_draft is not None:
                plan.tool_calls.append(AiToolCall(name="save_user_strategy", arguments=self._draft_arguments(plan.strategy_draft)))
            if plan.rule_draft is not None:
                plan.tool_calls.append(AiToolCall(name="save_user_rule", arguments=self._draft_arguments(plan.rule_draft)))
            if plan.indicator_draft is not None:
                plan.tool_calls.append(AiToolCall(name="save_user_indicator", arguments=self._draft_arguments(plan.indicator_draft)))

        return plan

    def compose_reply(
        self,
        *,
        user_message: str,
        session: AiSessionRecord,
        request_context: AiRequestContext,
        plan: AiExecutionPlan,
        tool_results: list[dict[str, Any]],
    ) -> AiAssistantReply:
        del session

        lines: list[str] = []
        needs_symbol_clarification = self._needs_symbol_clarification(plan, request_context, tool_results)
        needs_timeframe_clarification = self._needs_timeframe_clarification(plan, request_context, tool_results)

        if needs_symbol_clarification:
            lines.append("Hangi hisse veya hisselerde calismak istedigini yazar misin?")
            if plan.intent in {"analysis", "market_inspection"}:
                lines.append("Istersen sadece bir ticker yaz; sonra timeframe ve analiz turunu birlikte netlestirelim.")
            elif plan.intent == "backtest":
                lines.append("Birden fazla hisseyle ilerleyeceksen virgulle ayirabilirsin.")

        if needs_timeframe_clarification and not needs_symbol_clarification:
            lines.append("Hangi timeframe veya periyotla calismak istedigini de belirtir misin?")


        if tool_results:
            tool_summaries = [self._summarize_tool_result(result) for result in tool_results[:5]]
            lines.extend(tool_summaries)
        elif plan.tool_calls:
            lines.append("Planlandi fakat henuz tool sonucu olusmadi.")

        if plan.strategy_draft is not None:
            lines.append(f"Strateji taslagi hazir: {plan.strategy_draft.title}.")
        if plan.rule_draft is not None:
            lines.append(f"Rule taslagi hazir: {plan.rule_draft.title}.")
        if plan.indicator_draft is not None:
            lines.append(f"Indicator taslagi hazir: {plan.indicator_draft.title}.")

        if plan.notes:
            lines.extend(plan.notes)

        if not lines:
            lines.append(f"Mesaji aldim ve analiz icin hazirim: {user_message.strip()}")

        return AiAssistantReply(
            content=" ".join(lines),
            suggested_actions=self._suggest_actions(plan, tool_results, request_context, user_message),
        )

    @staticmethod
    def _detect_intent(text: str) -> str:
        if "backtest" in text:
            return "backtest"
        if "indikat" in text or "indicator" in text:
            return "indicator_design"
        if "rule" in text or "kural" in text:
            return "rule_design"
        if "strateji" in text or "strategy" in text:
            return "strategy_design"
        if "fiyat" in text or "veri" in text:
            return "market_inspection"
        return "analysis"

    @staticmethod
    def _title_from_message(message: str, fallback: str) -> str:
        clean = " ".join(message.strip().split())
        if not clean:
            return fallback
        return clean[:72]

    @staticmethod
    def _guess_indicator_id(text: str) -> str | None:
        for indicator_id in ("rsi", "macd", "ema", "sma", "bbands", "atr"):
            if indicator_id in text:
                return indicator_id
        return None

    @staticmethod
    def _draft_arguments(draft: Any) -> dict[str, Any]:
        payload = draft.model_dump(mode="python")
        return {
            "title": payload.get("title") or "Untitled",
            "description": payload.get("description") or "",
            "prompt": payload.get("description") or "",
            "spec": payload,
        }

    @staticmethod
    def _summarize_tool_result(result: dict[str, Any]) -> str:
        name = result.get("tool")
        payload = result.get("result") or {}
        if name == "run_backtest":
            run_id = payload.get("runId")
            return f"Backtest job'u baslatildi: {run_id}."
        if name == "get_prices":
            return HeuristicLlmGateway._summarize_price_payload(payload)
        if name == "get_indicators":
            return f"{payload.get('strategy')} indikatoru icin {payload.get('count')} seri parcasi hazir."
        if name == "get_rule_catalog":
            return f"Rule katalogu hazir: {payload.get('count')} kural."
        if name == "get_preset_catalog":
            return f"Preset katalogu hazir: {payload.get('count')} kombinasyon."
        if name == "save_user_strategy":
            return f"Strateji kaydedildi: {payload.get('title')}."
        if name == "save_user_rule":
            return f"Rule kaydedildi: {payload.get('title')}."
        if name == "save_user_indicator":
            return f"Indicator kaydedildi: {payload.get('title')}."
        return f"{name} tamamlandi."

    @staticmethod
    def _suggest_actions(
        plan: AiExecutionPlan,
        tool_results: list[dict[str, Any]],
        request_context: AiRequestContext,
        user_message: str,
    ) -> list[str]:
        actions: list[str] = []
        ticker = request_context.ticker or (request_context.selected_symbols[0] if request_context.selected_symbols else None)
        message = user_message.lower()

        if HeuristicLlmGateway._needs_symbol_clarification(plan, request_context, tool_results):
            return [
                "THYAO.IS icin teknik analiz yap",
                "AKBNK.IS icin backtest kur",
                "ASELS.IS icin en iyi presetleri oner",
                "Birden fazla hisse icin tarama yapmak istiyorum",
            ]

        if HeuristicLlmGateway._needs_timeframe_clarification(plan, request_context, tool_results):
            base = ticker or "Bu hisse"
            return [
                f"{base} icin 1h teknik analiz yap",
                f"{base} icin 4h trend analizi yap",
                f"{base} icin 1d destek direnc cikar",
                f"{base} icin en iyi timeframe'i oner",
            ]

        if any(result.get("tool") == "run_backtest" for result in tool_results):
            return [
                "Bu run'in durumunu tekrar kontrol et",
                "Portfoy egrisini getir",
                "Bu sonucu yorumla",
                "Bu stratejiyi iyilestir",
            ]

        if any(result.get("tool") == "get_indicators" for result in tool_results):
            base = ticker or "Bu hisse"
            return [
                f"{base} icin indikator sonucunu yorumla",
                f"{base} icin MACD analizi yap",
                f"{base} icin destek direnc belirle",
                f"{base} icin bu sinyalle strateji kur",
            ]

        if any(result.get("tool") == "get_prices" for result in tool_results):
            base = ticker or "Bu hisse"
            return [
                f"{base} icin RSI analizi yap",
                f"{base} icin MACD analizi yap",
                f"{base} icin destek direnc belirle",
                f"{base} icin hazir presetleri oner",
            ]

        if plan.strategy_draft is not None:
            return [
                "Bu stratejiyi kaydet",
                "Bu stratejiyi daha agresif yap",
                "Bu stratejiyi daha konservatif yap",
                "Bu stratejiyle backtest kur",
            ]

        if plan.rule_draft is not None:
            return [
                "Bu rule'u kaydet",
                "Bu rule'u trigger icin daralt",
                "Bu rule icin indicator oner",
                "Bu rule ile strateji kur",
            ]

        if plan.indicator_draft is not None:
            return [
                "Bu indicatoru kaydet",
                "Bu indicator icin kullanim kuralı yaz",
                "Bu indicatoru sadeleştir",
                "Bu indicator ile strateji kur",
            ]

        if "backtest" in message:
            base = ticker or "Bu hisse"
            return [
                f"{base} icin hazir presetleri karsilastir",
                f"{base} icin blueprint olustur",
                f"{base} icin komisyonlu backtest baslat",
                f"{base} icin max DD'yi dusur",
            ]

        if any(keyword in message for keyword in ("analiz", "teknik", "trend", "destek", "direnc", "fiyat")):
            base = ticker or "Bu hisse"
            return [
                f"{base} icin RSI analizi yap",
                f"{base} icin MACD analizi yap",
                f"{base} icin destek direnc belirle",
                f"{base} icin guclu trend rulerini cikar",
            ]

        return [
            "Teknik analiz yapmak istiyorum",
            "Bir backtest stratejisi kurmak istiyorum",
            "Yeni bir rule taslagi olustur",
            "Yeni bir indicator taslagi olustur",
        ]

    @staticmethod
    def _summarize_price_payload(payload: dict[str, Any]) -> str:
        bars = payload.get("bars") or []
        if not isinstance(bars, list) or len(bars) < 2:
            return f"{payload.get('ticker')} {payload.get('timeframe')} icin fiyat verisi hazir."

        try:
            first_close = float(bars[0]["c"])
            last_close = float(bars[-1]["c"])
            prev_close = float(bars[-2]["c"])
            highest = max(float(bar["h"]) for bar in bars)
            lowest = min(float(bar["l"]) for bar in bars)
            window_change = ((last_close - first_close) / first_close) * 100 if first_close else 0.0
            last_bar_change = ((last_close - prev_close) / prev_close) * 100 if prev_close else 0.0
        except Exception:
            return f"{payload.get('ticker')} {payload.get('timeframe')} icin {payload.get('rows')} bar bulundu."

        bias = "yukari"
        if window_change < -1.0:
            bias = "asagi"
        elif abs(window_change) <= 1.0:
            bias = "yatay"

        return (
            f"{payload.get('ticker')} {payload.get('timeframe')} icin son kapanis {last_close:.2f}. "
            f"Son bara gore %{last_bar_change:+.2f}, izlenen pencere genelinde %{window_change:+.2f}. "
            f"Kisa vadeli fiyat akisi {bias}; takip edilen bant {lowest:.2f} - {highest:.2f}."
        )

    @staticmethod
    def _needs_symbol_clarification(
        plan: AiExecutionPlan,
        request_context: AiRequestContext,
        tool_results: list[dict[str, Any]],
    ) -> bool:
        if request_context.ticker or request_context.selected_symbols:
            return False
        if plan.intent in {"analysis", "market_inspection", "backtest"}:
            return True
        if any(result.get("tool") in {"get_prices", "get_indicators", "run_backtest"} for result in tool_results):
            return False
        return False

    @staticmethod
    def _needs_timeframe_clarification(
        plan: AiExecutionPlan,
        request_context: AiRequestContext,
        tool_results: list[dict[str, Any]],
    ) -> bool:
        if request_context.timeframe:
            return False
        if any(result.get("tool") in {"get_prices", "get_indicators"} for result in tool_results):
            return False
        return plan.intent in {"analysis", "market_inspection"}
