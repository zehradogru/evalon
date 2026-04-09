from __future__ import annotations

from dataclasses import dataclass
from time import time
from typing import Any, Optional

from stratejiler.blueprint_rules import (
    Candle,
    RuleMask,
    evaluate_adx_dmi_trend,
    evaluate_aroon_trend,
    clamp_int,
    clamp_number,
    create_empty_mask,
    evaluate_ascending_triangle,
    evaluate_bollinger_squeeze,
    evaluate_breakout,
    evaluate_bull_flag,
    evaluate_channel_trend,
    evaluate_compression,
    evaluate_donchian_breakout,
    evaluate_double_bottom,
    evaluate_ema_cross,
    evaluate_ema_stack,
    evaluate_falling_structure,
    evaluate_fib_bounce,
    evaluate_ichimoku_cloud_trend,
    evaluate_inside_breakout,
    evaluate_macd_cross,
    evaluate_macd_zero_bias,
    evaluate_ma_ribbon,
    evaluate_micro_breakout,
    evaluate_psar_trend,
    evaluate_pullback,
    evaluate_rectangle_breakout,
    evaluate_retest,
    evaluate_reversal_candle,
    evaluate_rising_structure,
    evaluate_rsi_reclaim,
    evaluate_rsi_regime,
    evaluate_sr_flip_retest,
    evaluate_stoch_rsi_cross,
    evaluate_supertrend_bias,
    evaluate_support_hold,
    evaluate_trend_slope,
    evaluate_volume_confirm,
    evaluate_vortex_trend,
    evaluate_vwap_reclaim,
    get_timeframe_seconds,
    round_number,
)


STAGE_KEYS = ("trend", "setup", "trigger")


@dataclass
class StageState:
    time: int
    long_pass: bool
    short_pass: bool
    long_required_hits: list[str]
    short_required_hits: list[str]
    long_optional_hits: list[str]
    short_optional_hits: list[str]


@dataclass
class StageEvaluation:
    stage_key: str
    timeframe: str
    bars: list[Candle]
    states: list[StageState]


@dataclass
class OpenTrade:
    id: str
    side: str
    entry_index: int
    entry_time: int
    entry_price: float
    stop_price: float
    target_price: float
    snapshots: dict[str, dict[str, Any]]
    score: int


def run_blueprint_backtest(
    blueprint: dict[str, Any],
    candles_by_timeframe: dict[str, list[Candle]],
    now_ts: Optional[int] = None,
) -> dict[str, Any]:
    test_window_days = clamp_int(blueprint.get("testWindowDays"), 365, 30, 3650)
    end_time = int(now_ts if now_ts is not None else time())
    core_start_time = end_time - test_window_days * 86400
    active_stage_keys = get_active_stage_keys(blueprint)
    if not active_stage_keys:
        raise ValueError("En az bir stage icin en az bir kural secmelisin.")

    execution_stage = get_execution_stage_key(blueprint, active_stage_keys)

    evaluations: dict[str, StageEvaluation] = {}
    for stage_key in STAGE_KEYS:
        stage = blueprint["stages"][stage_key]
        if stage_key not in active_stage_keys:
            evaluations[stage_key] = StageEvaluation(
                stage_key=stage_key,
                timeframe=str(stage["timeframe"]),
                bars=[],
                states=[],
            )
            continue

        bars = normalize_bars(candles_by_timeframe.get(str(stage["timeframe"]), []))
        evaluations[stage_key] = evaluate_stage(stage, bars)

    execution_evaluation = evaluations[execution_stage]
    if not execution_evaluation.bars:
        raise ValueError("Secilen sembol ve aktif timeframe kombinasyonu icin veri bulunamadi.")

    trades = simulate_trades(blueprint, evaluations, core_start_time, active_stage_keys, execution_stage)
    stage_stats = build_stage_stats(blueprint, evaluations, core_start_time, active_stage_keys)
    summary = build_summary(trades)
    range_payload = derive_range(execution_evaluation.bars, core_start_time, end_time)

    return {
        "context": {
            "symbol": blueprint["symbol"],
            "generatedAt": end_time,
            "timeframes": {
                "trend": blueprint["stages"]["trend"]["timeframe"],
                "setup": blueprint["stages"]["setup"]["timeframe"],
                "trigger": blueprint["stages"]["trigger"]["timeframe"],
            },
            "activeStages": active_stage_keys,
            "executionStage": execution_stage,
        },
        "summary": summary,
        "trades": trades,
        "stageStats": stage_stats,
        "notes": build_notes(blueprint, summary, stage_stats, test_window_days, active_stage_keys, execution_stage),
        "range": range_payload,
        "dataPoints": {
            "trend": len(evaluations["trend"].bars),
            "setup": len(evaluations["setup"].bars),
            "trigger": len(evaluations["trigger"].bars),
        },
    }


def evaluate_stage(stage: dict[str, Any], bars: list[Candle]) -> StageEvaluation:
    masks = [
        {
            "rule": rule,
            "mask": evaluate_rule(rule, bars),
        }
        for rule in stage["rules"]
    ]

    states: list[StageState] = []
    for index, bar in enumerate(bars):
        if not stage["rules"]:
            states.append(
                StageState(
                    time=int(bar["t"]),
                    long_pass=False,
                    short_pass=False,
                    long_required_hits=[],
                    short_required_hits=[],
                    long_optional_hits=[],
                    short_optional_hits=[],
                )
            )
            continue

        long_required_hits: list[str] = []
        short_required_hits: list[str] = []
        long_optional_hits: list[str] = []
        short_optional_hits: list[str] = []
        required_long_ok = True
        required_short_ok = True

        for item in masks:
            rule = item["rule"]
            mask: RuleMask = item["mask"]
            long_hit = bool(mask.long[index])
            short_hit = bool(mask.short[index])
            if rule["required"]:
                if long_hit:
                    long_required_hits.append(rule["id"])
                if short_hit:
                    short_required_hits.append(rule["id"])
                required_long_ok = required_long_ok and long_hit
                required_short_ok = required_short_ok and short_hit
            else:
                if long_hit:
                    long_optional_hits.append(rule["id"])
                if short_hit:
                    short_optional_hits.append(rule["id"])

        min_optional_matches = int(stage["minOptionalMatches"])
        long_pass = required_long_ok and len(long_optional_hits) >= min_optional_matches
        short_pass = required_short_ok and len(short_optional_hits) >= min_optional_matches
        states.append(
            StageState(
                time=int(bar["t"]),
                long_pass=long_pass,
                short_pass=short_pass,
                long_required_hits=long_required_hits,
                short_required_hits=short_required_hits,
                long_optional_hits=long_optional_hits,
                short_optional_hits=short_optional_hits,
            )
        )

    return StageEvaluation(
        stage_key=str(stage["key"]),
        timeframe=str(stage["timeframe"]),
        bars=bars,
        states=states,
    )


def evaluate_rule(rule: dict[str, Any], bars: list[Candle]) -> RuleMask:
    params = rule.get("params") or {}
    rule_id = str(rule["id"])

    if rule_id == "hhhl":
        return evaluate_rising_structure(bars, clamp_int(params.get("lookback"), 20, 5, 300))
    if rule_id == "lhll":
        return evaluate_falling_structure(bars, clamp_int(params.get("lookback"), 20, 5, 300))
    if rule_id == "ema-stack":
        return evaluate_ema_stack(
            bars,
            clamp_int(params.get("fast"), 20, 2, 200),
            clamp_int(params.get("slow"), 50, 5, 300),
        )
    if rule_id == "ema-cross":
        return evaluate_ema_cross(
            bars,
            clamp_int(params.get("fast"), 9, 2, 120),
            clamp_int(params.get("slow"), 21, 3, 240),
        )
    if rule_id == "ma-ribbon":
        return evaluate_ma_ribbon(
            bars,
            clamp_int(params.get("fast"), 8, 2, 120),
            clamp_int(params.get("mid"), 21, 3, 200),
            clamp_int(params.get("slow"), 55, 5, 300),
        )
    if rule_id == "rsi-regime":
        return evaluate_rsi_regime(
            bars,
            clamp_int(params.get("period"), 14, 2, 200),
            clamp_number(params.get("level"), 50, 1, 99),
        )
    if rule_id == "rsi-reclaim":
        return evaluate_rsi_reclaim(
            bars,
            clamp_int(params.get("period"), 14, 2, 200),
            clamp_number(params.get("lower"), 30, 1, 49),
            clamp_number(params.get("upper"), 70, 51, 99),
        )
    if rule_id == "breakout":
        return evaluate_breakout(
            bars,
            clamp_int(params.get("lookback"), 30, 5, 300),
            clamp_number(params.get("buffer"), 0.6, 0.1, 10),
        )
    if rule_id == "donchian-breakout":
        return evaluate_donchian_breakout(
            bars,
            clamp_int(params.get("lookback"), 20, 5, 300),
        )
    if rule_id == "pullback":
        return evaluate_pullback(
            bars,
            clamp_int(params.get("ema"), 20, 2, 200),
            clamp_number(params.get("tolerance"), 1, 0.1, 10),
        )
    if rule_id == "compression":
        return evaluate_compression(
            bars,
            clamp_int(params.get("bars"), 12, 3, 100),
            clamp_number(params.get("rangePct"), 2.5, 0.1, 20),
        )
    if rule_id == "bollinger-squeeze":
        return evaluate_bollinger_squeeze(
            bars,
            clamp_int(params.get("period"), 20, 5, 200),
            clamp_number(params.get("deviation"), 2, 1, 5),
            clamp_number(params.get("widthPct"), 6, 0.5, 25),
        )
    if rule_id == "fib-bounce":
        return evaluate_fib_bounce(
            bars,
            clamp_int(params.get("lookback"), 55, 20, 300),
            clamp_number(params.get("upperLevel"), 0.382, 0.2, 0.8),
            clamp_number(params.get("lowerLevel"), 0.618, 0.2, 0.9),
        )
    if rule_id == "fib-golden-pocket":
        return evaluate_fib_bounce(
            bars,
            clamp_int(params.get("lookback"), 55, 20, 300),
            clamp_number(params.get("upperLevel"), 0.618, 0.4, 0.75),
            clamp_number(params.get("lowerLevel"), 0.65, 0.5, 0.8),
        )
    if rule_id == "support-hold":
        return evaluate_support_hold(
            bars,
            clamp_int(params.get("lookback"), 30, 5, 250),
            clamp_number(params.get("tolerance"), 0.8, 0.1, 5),
        )
    if rule_id == "sr-flip-retest":
        return evaluate_sr_flip_retest(
            bars,
            clamp_int(params.get("lookback"), 25, 5, 250),
            clamp_number(params.get("tolerance"), 0.6, 0.1, 4),
        )
    if rule_id == "ascending-triangle":
        return evaluate_ascending_triangle(
            bars,
            clamp_int(params.get("bars"), 24, 8, 120),
            clamp_number(params.get("tolerance"), 0.8, 0.1, 5),
        )
    if rule_id == "double-bottom":
        return evaluate_double_bottom(
            bars,
            clamp_int(params.get("bars"), 30, 10, 160),
            clamp_number(params.get("tolerance"), 1.2, 0.2, 6),
        )
    if rule_id == "bull-flag":
        return evaluate_bull_flag(
            bars,
            clamp_int(params.get("impulseBars"), 8, 3, 40),
            clamp_int(params.get("pullbackBars"), 6, 3, 30),
            clamp_number(params.get("minMovePct"), 4, 0.5, 20),
        )
    if rule_id == "rectangle-breakout":
        return evaluate_rectangle_breakout(
            bars,
            clamp_int(params.get("bars"), 20, 5, 120),
            clamp_number(params.get("rangePct"), 4, 0.5, 20),
        )
    if rule_id == "trend-slope":
        return evaluate_trend_slope(
            bars,
            clamp_int(params.get("lookback"), 30, 5, 200),
            clamp_number(params.get("minMovePct"), 6, 0.5, 30),
        )
    if rule_id == "channel-trend":
        return evaluate_channel_trend(
            bars,
            clamp_int(params.get("lookback"), 40, 10, 250),
        )
    if rule_id == "adx-dmi-trend":
        return evaluate_adx_dmi_trend(
            bars,
            clamp_int(params.get("period"), 14, 5, 100),
            clamp_number(params.get("threshold"), 25, 5, 60),
            clamp_number(params.get("spread"), 5, 0.5, 40),
        )
    if rule_id == "aroon-trend":
        return evaluate_aroon_trend(
            bars,
            clamp_int(params.get("period"), 25, 5, 150),
            clamp_number(params.get("strongLevel"), 70, 50, 100),
            clamp_number(params.get("weakLevel"), 30, 0, 50),
        )
    if rule_id == "ichimoku-cloud-trend":
        return evaluate_ichimoku_cloud_trend(
            bars,
            clamp_int(params.get("conversion"), 9, 2, 60),
            clamp_int(params.get("base"), 26, 3, 120),
            clamp_int(params.get("spanB"), 52, 5, 240),
            clamp_int(params.get("displacement"), 26, 1, 120),
        )
    if rule_id == "vortex-trend":
        return evaluate_vortex_trend(
            bars,
            clamp_int(params.get("period"), 14, 5, 100),
            clamp_number(params.get("spread"), 0.08, 0.01, 1),
        )
    if rule_id == "supertrend-bias":
        return evaluate_supertrend_bias(
            bars,
            clamp_int(params.get("period"), 14, 5, 100),
            clamp_number(params.get("multiplier"), 3, 1, 10),
        )
    if rule_id == "psar-trend":
        return evaluate_psar_trend(
            bars,
            clamp_number(params.get("step"), 0.02, 0.001, 0.2),
            clamp_number(params.get("maxStep"), 0.2, 0.02, 1),
        )
    if rule_id == "macd-zero-bias":
        return evaluate_macd_zero_bias(
            bars,
            clamp_int(params.get("fast"), 12, 2, 200),
            clamp_int(params.get("slow"), 26, 3, 300),
            clamp_int(params.get("signal"), 9, 2, 120),
        )
    if rule_id == "macd-cross":
        return evaluate_macd_cross(
            bars,
            clamp_int(params.get("fast"), 12, 2, 200),
            clamp_int(params.get("slow"), 26, 3, 300),
            clamp_int(params.get("signal"), 9, 2, 120),
        )
    if rule_id == "retest":
        return evaluate_retest(
            bars,
            clamp_int(params.get("bars"), 4, 1, 50),
            clamp_number(params.get("tolerance"), 0.5, 0.1, 10),
        )
    if rule_id == "volume-confirm":
        return evaluate_volume_confirm(
            bars,
            clamp_number(params.get("factor"), 1.6, 1, 8),
            clamp_int(params.get("lookback"), 20, 5, 200),
        )
    if rule_id == "vwap-reclaim":
        return evaluate_vwap_reclaim(bars)
    if rule_id == "micro-breakout":
        return evaluate_micro_breakout(
            bars,
            clamp_int(params.get("bars"), 6, 2, 60),
        )
    if rule_id == "inside-breakout":
        return evaluate_inside_breakout(bars)
    if rule_id == "reversal-candle":
        return evaluate_reversal_candle(
            bars,
            clamp_number(params.get("bodyPct"), 60, 20, 100),
        )
    if rule_id == "stoch-rsi-cross":
        return evaluate_stoch_rsi_cross(
            bars,
            clamp_int(params.get("rsiPeriod"), 14, 2, 100),
            clamp_int(params.get("stochPeriod"), 14, 3, 100),
            clamp_int(params.get("signal"), 3, 2, 20),
            clamp_number(params.get("oversold"), 20, 1, 49),
            clamp_number(params.get("overbought"), 80, 51, 99),
        )
    return create_empty_mask(len(bars))


def simulate_trades(
    blueprint: dict[str, Any],
    evaluations: dict[str, StageEvaluation],
    core_start_time: int,
    active_stage_keys: list[str],
    execution_stage: str,
) -> list[dict[str, Any]]:
    execution_bars = evaluations[execution_stage].bars
    trades: list[dict[str, Any]] = []
    cursors = {"trend": -1, "setup": -1, "trigger": -1}
    open_trade: Optional[OpenTrade] = None
    previous_execution_long = False
    previous_execution_short = False

    for index, bar in enumerate(execution_bars):
        state = evaluations[execution_stage].states[index] if index < len(evaluations[execution_stage].states) else None
        if int(bar["t"]) < core_start_time:
            previous_execution_long = bool(state.long_pass) if state else False
            previous_execution_short = bool(state.short_pass) if state else False
            continue

        if open_trade is not None:
            closed_trade = maybe_close_trade(open_trade, bar, index, int(blueprint["risk"]["maxBars"]))
            if closed_trade is not None:
                trades.append(closed_trade)
                open_trade = None
                previous_execution_long = bool(state.long_pass) if state else False
                previous_execution_short = bool(state.short_pass) if state else False
                continue

        if open_trade is not None:
            previous_execution_long = bool(state.long_pass) if state else False
            previous_execution_short = bool(state.short_pass) if state else False
            continue

        snapshots = collect_snapshots(evaluations, int(bar["t"]), cursors)
        long_decision = build_direction_decision(blueprint, "long", snapshots, active_stage_keys, execution_stage)
        short_decision = build_direction_decision(blueprint, "short", snapshots, active_stage_keys, execution_stage)

        candidates: list[dict[str, Any]] = []
        if long_decision["eligible"] and not previous_execution_long:
            candidates.append(long_decision)
        if short_decision["eligible"] and not previous_execution_short:
            candidates.append(short_decision)

        selected = pick_candidate(candidates)
        if selected is not None:
            close = float(bar["c"])
            stop_price = close * (1 - float(blueprint["risk"]["stopPct"]) / 100) if selected["direction"] == "long" else close * (1 + float(blueprint["risk"]["stopPct"]) / 100)
            target_price = close * (1 + float(blueprint["risk"]["targetPct"]) / 100) if selected["direction"] == "long" else close * (1 - float(blueprint["risk"]["targetPct"]) / 100)
            open_trade = OpenTrade(
                id=f"bt_{str(len(trades) + 1).zfill(4)}",
                side=selected["direction"],
                entry_index=index,
                entry_time=int(bar["t"]),
                entry_price=close,
                stop_price=stop_price,
                target_price=target_price,
                snapshots=selected["snapshots"],
                score=int(selected["score"]),
            )

        previous_execution_long = bool(state.long_pass) if state else False
        previous_execution_short = bool(state.short_pass) if state else False

    if open_trade is not None:
        last_bar = execution_bars[-1]
        trades.append(finalize_trade(open_trade, last_bar, len(execution_bars) - 1, "end_of_data", float(last_bar["c"])))

    return trades


def maybe_close_trade(trade: OpenTrade, bar: Candle, current_index: int, max_bars: int) -> Optional[dict[str, Any]]:
    high = float(bar["h"])
    low = float(bar["l"])
    close = float(bar["c"])

    if trade.side == "long":
        if low <= trade.stop_price:
            return finalize_trade(trade, bar, current_index, "stop", trade.stop_price)
        if high >= trade.target_price:
            return finalize_trade(trade, bar, current_index, "target", trade.target_price)
    else:
        if high >= trade.stop_price:
            return finalize_trade(trade, bar, current_index, "stop", trade.stop_price)
        if low <= trade.target_price:
            return finalize_trade(trade, bar, current_index, "target", trade.target_price)

    if current_index - trade.entry_index >= max_bars:
        return finalize_trade(trade, bar, current_index, "timeout", close)

    return None


def finalize_trade(
    trade: OpenTrade,
    bar: Candle,
    current_index: int,
    exit_reason: str,
    exit_price: float,
) -> dict[str, Any]:
    if trade.side == "long":
        pnl_pct = ((exit_price - trade.entry_price) / trade.entry_price) * 100
    else:
        pnl_pct = ((trade.entry_price - exit_price) / trade.entry_price) * 100

    return {
        "id": trade.id,
        "side": trade.side,
        "entryTime": trade.entry_time,
        "exitTime": int(bar["t"]),
        "entryPrice": round_number(trade.entry_price, 4),
        "exitPrice": round_number(exit_price, 4),
        "pnlPct": round_number(pnl_pct, 2),
        "barsHeld": max(1, current_index - trade.entry_index),
        "exitReason": exit_reason,
        "score": trade.score,
        "stages": trade.snapshots,
    }


def collect_snapshots(
    evaluations: dict[str, StageEvaluation],
    time_value: int,
    cursors: dict[str, int],
) -> dict[str, Optional[StageState]]:
    return {
        "trend": lookup_state(evaluations["trend"], time_value, cursors, "trend"),
        "setup": lookup_state(evaluations["setup"], time_value, cursors, "setup"),
        "trigger": lookup_state(evaluations["trigger"], time_value, cursors, "trigger"),
    }


def lookup_state(
    evaluation: StageEvaluation,
    time_value: int,
    cursors: dict[str, int],
    stage_key: str,
) -> Optional[StageState]:
    cursor = cursors[stage_key]
    while cursor + 1 < len(evaluation.states) and evaluation.states[cursor + 1].time <= time_value:
        cursor += 1
    cursors[stage_key] = cursor
    return evaluation.states[cursor] if cursor >= 0 else None


def build_direction_decision(
    blueprint: dict[str, Any],
    direction: str,
    snapshots: dict[str, Optional[StageState]],
    active_stage_keys: list[str],
    execution_stage: str,
) -> dict[str, Any]:
    result_snapshots: dict[str, dict[str, Any]] = {}
    passed_stages = 0
    score = 0
    required_stages_ok = True

    for stage_key in STAGE_KEYS:
        stage = blueprint["stages"][stage_key]
        active = stage_key in active_stage_keys
        snapshot = snapshots[stage_key]
        passed = active and (snapshot.long_pass if direction == "long" and snapshot else snapshot.short_pass if snapshot else False)
        required_hits = (snapshot.long_required_hits if direction == "long" else snapshot.short_required_hits) if snapshot else []
        optional_hits = (snapshot.long_optional_hits if direction == "long" else snapshot.short_optional_hits) if snapshot else []

        result_snapshots[stage_key] = {
            "timeframe": stage["timeframe"],
            "passed": bool(passed),
            "requiredHits": required_hits,
            "optionalHits": optional_hits,
        }

        if not active:
            continue
        if passed:
            passed_stages += 1
        if stage["required"] and not passed:
            required_stages_ok = False
        score += len(required_hits) * 2 + len(optional_hits)

    direction_allowed = blueprint["direction"] == "both" or blueprint["direction"] == direction
    execution_passed = bool(result_snapshots[execution_stage]["passed"])
    eligible = (
        direction_allowed
        and execution_passed
        and required_stages_ok
        and passed_stages >= min(int(blueprint["stageThreshold"]), len(active_stage_keys))
    )

    return {
        "direction": direction,
        "eligible": eligible,
        "passedStages": passed_stages,
        "score": passed_stages * 100 + score,
        "snapshots": result_snapshots,
    }


def pick_candidate(candidates: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    sorted_candidates = sorted(candidates, key=lambda item: item["score"], reverse=True)
    if sorted_candidates[0]["score"] == sorted_candidates[1]["score"]:
        return None
    return sorted_candidates[0]


def build_stage_stats(
    blueprint: dict[str, Any],
    evaluations: dict[str, StageEvaluation],
    core_start_time: int,
    active_stage_keys: list[str],
) -> dict[str, dict[str, Any]]:
    payload: dict[str, dict[str, Any]] = {}
    for stage_key in STAGE_KEYS:
        evaluation = evaluations[stage_key]
        core_states = [state for state in evaluation.states if state.time >= core_start_time]
        passed_bars = len([state for state in core_states if state.long_pass or state.short_pass])
        pass_rate = (passed_bars / len(core_states)) if core_states else 0
        stage = blueprint["stages"][stage_key]
        active = stage_key in active_stage_keys
        payload[stage_key] = {
            "timeframe": stage["timeframe"],
            "passRate": pass_rate if active else 0,
            "passedBars": passed_bars if active else 0,
            "coreBars": len(core_states) if active else 0,
            "ruleCount": len(stage["rules"]),
            "requiredRuleCount": len([rule for rule in stage["rules"] if rule["required"]]),
        }
    return payload


def build_summary(trades: list[dict[str, Any]]) -> dict[str, Any]:
    if not trades:
        return {
            "totalTrades": 0,
            "winRate": 0,
            "totalPnlPct": 0,
            "averagePnlPct": 0,
            "profitFactor": 0,
            "maxDrawdownPct": 0,
            "averageBarsHeld": 0,
        }

    total_pnl = sum(float(trade["pnlPct"]) for trade in trades)
    wins = [trade for trade in trades if float(trade["pnlPct"]) > 0]
    losses = [trade for trade in trades if float(trade["pnlPct"]) < 0]
    gross_profit = sum(float(trade["pnlPct"]) for trade in wins)
    gross_loss = abs(sum(float(trade["pnlPct"]) for trade in losses))
    average_bars_held = sum(int(trade["barsHeld"]) for trade in trades) / len(trades)

    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    for trade in trades:
        equity += float(trade["pnlPct"])
        peak = max(peak, equity)
        max_drawdown = min(max_drawdown, equity - peak)

    return {
        "totalTrades": len(trades),
        "winRate": len(wins) / len(trades),
        "totalPnlPct": round_number(total_pnl, 2),
        "averagePnlPct": round_number(total_pnl / len(trades), 2),
        "profitFactor": round_number((gross_profit / gross_loss) if gross_loss > 0 else gross_profit, 2),
        "maxDrawdownPct": round_number(max_drawdown, 2),
        "averageBarsHeld": round_number(average_bars_held, 1),
    }


def derive_range(bars: list[Candle], core_start_time: int, fallback: int) -> dict[str, int]:
    core_bars = [bar for bar in bars if int(bar["t"]) >= core_start_time]
    if not core_bars:
        return {"from": fallback, "to": fallback}
    return {
        "from": int(core_bars[0]["t"]),
        "to": int(core_bars[-1]["t"]),
    }


def build_notes(
    blueprint: dict[str, Any],
    summary: dict[str, Any],
    stage_stats: dict[str, dict[str, Any]],
    test_window_days: int,
    active_stage_keys: list[str],
    execution_stage: str,
) -> list[str]:
    notes = [
        f"{test_window_days} gunluk pencere tarandi. Girisler aktif stage'ler icindeki en alt timeframe olan {execution_stage} stage'inin yeni aktif oldugu barda uretiliyor.",
        "Price action kurallari local heuristics ile calisiyor; bu ilk surumde broker-grade execution modeli yok.",
        f"Risk modeli sabit: %{round_number(float(blueprint['risk']['stopPct']), 1)} stop, %{round_number(float(blueprint['risk']['targetPct']), 1)} target, {int(blueprint['risk']['maxBars'])} bar timeout.",
        f"Aktif stage'ler: {', '.join(active_stage_keys)}. Kural olmayan stage'ler devre disi sayildi.",
    ]

    if int(summary["totalTrades"]) == 0 and active_stage_keys:
        tightest_stage = sorted(
            [{"stageKey": stage_key, "rate": stage_stats[stage_key]["passRate"]} for stage_key in active_stage_keys],
            key=lambda item: item["rate"],
        )[0]
        notes.append(
            f"{tightest_stage['stageKey']} stage'i en dar bogaz olarak gorunuyor. Pass rate su an %{round_number(stage_stats[tightest_stage['stageKey']]['passRate'] * 100, 1)}."
        )

    return notes


def derive_warmup_bars(blueprint: dict[str, Any]) -> int:
    max_param = 50
    for stage_key in STAGE_KEYS:
        stage = blueprint["stages"][stage_key]
        for rule in stage["rules"]:
            for value in (rule.get("params") or {}).values():
                try:
                    numeric = float(value)
                except (TypeError, ValueError):
                    continue
                max_param = max(max_param, int(numeric) + (0 if numeric.is_integer() else 1))
    return max(160, max_param * 3)


def get_active_stage_keys(blueprint: dict[str, Any]) -> list[str]:
    return [stage_key for stage_key in STAGE_KEYS if blueprint["stages"][stage_key]["rules"]]


def get_execution_stage_key(blueprint: dict[str, Any], active_stage_keys: list[str]) -> str:
    return sorted(active_stage_keys, key=lambda stage_key: get_timeframe_seconds(str(blueprint["stages"][stage_key]["timeframe"])))[0]


def normalize_bars(bars: list[Candle]) -> list[Candle]:
    normalized = [
        {
            "t": int(float(bar["t"])),
            "o": float(bar["o"]),
            "h": float(bar["h"]),
            "l": float(bar["l"]),
            "c": float(bar["c"]),
            "v": float(bar["v"]),
        }
        for bar in bars
        if all(key in bar for key in ("t", "o", "h", "l", "c", "v"))
    ]
    normalized.sort(key=lambda bar: int(bar["t"]))
    return normalized
