from __future__ import annotations

from typing import Any

from api.modules.ai.domain.models import AiDraftStrategy, AiRequestContext, AiSessionRecord


def message_requests_strategy(message: str) -> bool:
    text = message.lower()
    return any(
        keyword in text
        for keyword in (
            "strateji olustur",
            "strateji oluştur",
            "strateji kur",
            "strateji yaz",
            "strategy build",
            "strategy create",
            "strategy draft",
            "bu sinyallerle bir strateji",
        )
    )


def message_requests_backtest(message: str) -> bool:
    text = message.lower()
    return any(keyword in text for keyword in ("backtest", "geri test", "geritest", "back test"))


def message_requests_save(message: str) -> bool:
    text = message.lower()
    return any(keyword in text for keyword in ("kaydet", "save", "sakla"))


def message_requests_activation(message: str) -> bool:
    text = message.lower()
    return any(
        keyword in text
        for keyword in (
            "aktif blueprint",
            "blueprint'i sec",
            "blueprinti sec",
            "blueprint sec",
            "aktif hale getir",
            "activate blueprint",
        )
    )


def resolve_existing_strategy_draft(
    session: AiSessionRecord,
    fallback: AiDraftStrategy | None = None,
) -> AiDraftStrategy | None:
    if fallback is not None:
        return fallback
    if session.last_plan and session.last_plan.strategy_draft is not None:
        return session.last_plan.strategy_draft.model_copy(deep=True)
    return None


def build_strategy_draft(
    *,
    user_message: str,
    request_context: AiRequestContext,
    session: AiSessionRecord,
    fallback_title: str | None = None,
) -> AiDraftStrategy | None:
    symbols = list(request_context.selected_symbols or ([] if not request_context.ticker else [request_context.ticker]))
    if not symbols and request_context.ticker:
        symbols = [request_context.ticker]
    if not symbols:
        return None

    timeframe = request_context.timeframe or _infer_timeframe_from_session(session) or "1h"
    indicator_key = _resolve_strategy_focus(user_message=user_message, request_context=request_context, session=session)
    blueprint = _build_blueprint(
        symbols=symbols,
        timeframe=timeframe,
        focus=indicator_key,
    )

    primary_symbol = symbols[0]
    title = fallback_title or _build_title(primary_symbol=primary_symbol, focus=indicator_key, symbols=symbols)
    description = (
        f"{primary_symbol} icin {timeframe} tabanli {indicator_key} odakli strateji taslagi. "
        "Aktif sohbet baglamindan otomatik uretildi."
    )
    return AiDraftStrategy(
        title=title,
        description=description,
        blueprint=blueprint,
        status="draft",
    )


def _resolve_strategy_focus(
    *,
    user_message: str,
    request_context: AiRequestContext,
    session: AiSessionRecord,
) -> str:
    text = user_message.lower()

    if request_context.indicator_id:
        return str(request_context.indicator_id).lower()

    for key, keywords in (
        ("rsi", ("rsi",)),
        ("macd", ("macd",)),
        ("ema", ("ema", "sma", "hareketli ortalama", "moving average")),
        ("fib", ("fib", "fibonacci", "golden pocket")),
        ("support", ("destek", "direnc", "direnç", "support", "resistance", "s/r")),
        ("breakout", ("kirilim", "kırılım", "breakout")),
        ("volume", ("hacim", "vwap", "volume")),
    ):
        if any(keyword in text for keyword in keywords):
            return key

    for result in reversed(session.last_tool_results or []):
        if result.get("tool") != "get_indicators":
            continue
        payload = result.get("result") or {}
        strategy = str(payload.get("strategy") or "").strip().lower()
        if strategy:
            return strategy

    return "support"


def _infer_timeframe_from_session(session: AiSessionRecord) -> str | None:
    for result in reversed(session.last_tool_results or []):
        payload = result.get("result") or {}
        timeframe = payload.get("timeframe")
        if isinstance(timeframe, str) and timeframe.strip():
            return timeframe.strip()
    return None


def _build_title(*, primary_symbol: str, focus: str, symbols: list[str]) -> str:
    focus_label = {
        "rsi": "RSI Reclaim Blueprint",
        "macd": "MACD Cross Blueprint",
        "ema": "EMA Momentum Blueprint",
        "fib": "Fibonacci Reaction Blueprint",
        "support": "Support Reversal Blueprint",
        "breakout": "Breakout Continuation Blueprint",
        "volume": "VWAP Volume Blueprint",
    }.get(focus, "Custom Blueprint")
    if len(symbols) > 1:
        return f"{len(symbols)} hisse icin {focus_label}"
    return f"{primary_symbol} {focus_label}"


def _build_blueprint(*, symbols: list[str], timeframe: str, focus: str) -> dict[str, Any]:
    frames = _frames_for(timeframe)
    primary_symbol = symbols[0]
    direction = "both"
    stage_threshold = 2
    risk = {"stopPct": 1.8, "targetPct": 4.0, "maxBars": 12}

    trend_rules: list[dict[str, Any]] = []
    setup_rules: list[dict[str, Any]] = []
    trigger_rules: list[dict[str, Any]] = []

    if focus == "rsi":
        setup_rules = [_rule("rsi-reclaim", True, {"period": 14, "lower": 35, "upper": 65})]
        trigger_rules = [_rule("reversal-candle", True, {"bodyPct": 55})]
        risk = {"stopPct": 1.5, "targetPct": 3.8, "maxBars": 10}
        direction = "both"
    elif focus == "macd":
        setup_rules = [_rule("macd-cross", True, {"fast": 12, "slow": 26, "signal": 9})]
        trigger_rules = [_rule("micro-breakout", True, {"bars": 4})]
        risk = {"stopPct": 1.8, "targetPct": 4.2, "maxBars": 12}
        direction = "both"
    elif focus == "ema":
        setup_rules = [_rule("ema-cross", True, {"fast": 9, "slow": 21})]
        trigger_rules = [_rule("micro-breakout", True, {"bars": 4})]
        risk = {"stopPct": 1.8, "targetPct": 4.6, "maxBars": 12}
        direction = "both"
    elif focus == "fib":
        setup_rules = [_rule("fib-golden-pocket", True, {"lookback": 34, "upperLevel": 0.618, "lowerLevel": 0.65})]
        trigger_rules = [_rule("reversal-candle", True, {"bodyPct": 55})]
        risk = {"stopPct": 1.9, "targetPct": 5.2, "maxBars": 12}
        direction = "long"
    elif focus == "volume":
        setup_rules = [_rule("vwap-reclaim", True, {})]
        trigger_rules = [_rule("volume-confirm", True, {"multiplier": 1.2})]
        risk = {"stopPct": 1.6, "targetPct": 4.2, "maxBars": 10}
        direction = "both"
    elif focus == "breakout":
        setup_rules = [_rule("breakout", True, {"lookback": 20, "buffer": 0.2})]
        trigger_rules = [_rule("micro-breakout", True, {"bars": 4})]
        risk = {"stopPct": 1.8, "targetPct": 5.0, "maxBars": 12}
        direction = "long"
    else:
        setup_rules = [_rule("support-hold", True, {"lookback": 25, "tolerance": 1.0})]
        trigger_rules = [_rule("reversal-candle", True, {"bodyPct": 55})]
        risk = {"stopPct": 1.9, "targetPct": 4.6, "maxBars": 10}
        direction = "long"

    if not setup_rules and trigger_rules:
        stage_threshold = 1

    return {
        "symbol": primary_symbol,
        "symbols": symbols,
        "stageThreshold": stage_threshold,
        "direction": direction,
        "testWindowDays": 365,
        "portfolio": {
            "initialCapital": 100000,
            "positionSize": 10000,
            "commissionPct": 0.1,
        },
        "risk": risk,
        "stages": {
            "trend": {
                "key": "trend",
                "timeframe": frames["trend"],
                "required": False,
                "minOptionalMatches": 0,
                "rules": trend_rules,
            },
            "setup": {
                "key": "setup",
                "timeframe": frames["setup"],
                "required": bool(setup_rules),
                "minOptionalMatches": 0,
                "rules": setup_rules,
            },
            "trigger": {
                "key": "trigger",
                "timeframe": frames["trigger"],
                "required": True,
                "minOptionalMatches": 0,
                "rules": trigger_rules,
            },
        },
    }


def _frames_for(timeframe: str) -> dict[str, str]:
    normalized = timeframe.strip() or "1h"
    mapping = {
        "1m": {"trend": "1h", "setup": "15m", "trigger": "1m"},
        "5m": {"trend": "1h", "setup": "15m", "trigger": "5m"},
        "15m": {"trend": "4h", "setup": "1h", "trigger": "15m"},
        "1h": {"trend": "1d", "setup": "4h", "trigger": "1h"},
        "4h": {"trend": "1w", "setup": "1d", "trigger": "4h"},
        "1d": {"trend": "1w", "setup": "1d", "trigger": "1d"},
        "1w": {"trend": "1M", "setup": "1w", "trigger": "1w"},
        "1M": {"trend": "1M", "setup": "1M", "trigger": "1M"},
    }
    return mapping.get(normalized, {"trend": normalized, "setup": normalized, "trigger": normalized})


def _rule(rule_id: str, required: bool, params: dict[str, float | int]) -> dict[str, Any]:
    return {
        "id": rule_id,
        "required": required,
        "params": params,
    }
