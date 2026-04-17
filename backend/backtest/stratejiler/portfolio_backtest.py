from __future__ import annotations

from time import time
from typing import Dict, List,  Union, Optional, Any, Optional

from stratejiler.blueprint_rules import get_timeframe_seconds, round_number
from stratejiler.multi_timeframe_backtest import run_blueprint_backtest


STAGE_KEYS = ("trend", "setup", "trigger")


def run_portfolio_blueprint_backtest(
    blueprint: Dict[str, Any],
    candles_by_symbol: Dict[str, Dict[str, List[Dict[str, Union[float, int]]]]],
    now_ts: Optional[int] = None,
    symbol_errors: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    test_window_days = clamp_int(blueprint.get("testWindowDays"), 365, 30, 3650)
    end_time = int(now_ts if now_ts is not None else time())
    active_stage_keys = get_active_stage_keys(blueprint)
    if not active_stage_keys:
        raise ValueError("En az bir stage icin en az bir kural secmelisin.")

    execution_stage = get_execution_stage_key(blueprint, active_stage_keys)
    portfolio = normalize_portfolio_config(blueprint.get("portfolio"))
    symbols = normalize_symbols(blueprint)
    merged_symbol_errors = list(symbol_errors or [])
    symbol_runs: List[Dict[str, Any]] = []

    for symbol in symbols:
        symbol_candles = candles_by_symbol.get(symbol)
        if not symbol_candles:
            merged_symbol_errors.append({"symbol": symbol, "message": "Veri bulunamadi."})
            continue

        symbol_blueprint = dict(blueprint)
        symbol_blueprint["symbol"] = symbol
        try:
            symbol_runs.append(
                run_blueprint_backtest(
                    blueprint=symbol_blueprint,
                    candles_by_timeframe=symbol_candles,
                    now_ts=end_time,
                )
            )
        except Exception as exc:
            merged_symbol_errors.append({"symbol": symbol, "message": str(exc)})

    if not symbol_runs:
        raise ValueError(merged_symbol_errors[0]["message"] if merged_symbol_errors else "Secilen semboller icin veri bulunamadi.")

    range_payload = aggregate_range(symbol_runs)
    portfolio_run = simulate_portfolio(
        symbol_runs,
        portfolio,
        curve_start_time=int(range_payload["from"]),
    )
    summary = build_portfolio_summary(portfolio_run, portfolio)
    stage_stats = aggregate_stage_stats(blueprint, symbol_runs)
    data_points = aggregate_data_points(symbol_runs)

    return {
        "context": {
            "symbol": symbols[0],
            "symbols": symbols,
            "generatedAt": end_time,
            "timeframes": {
                "trend": blueprint["stages"]["trend"]["timeframe"],
                "setup": blueprint["stages"]["setup"]["timeframe"],
                "trigger": blueprint["stages"]["trigger"]["timeframe"],
            },
            "activeStages": active_stage_keys,
            "executionStage": execution_stage,
            "portfolioMode": len(symbols) > 1,
        },
        "portfolio": portfolio,
        "summary": summary,
        "portfolioCurve": portfolio_run["portfolioCurve"],
        "trades": portfolio_run["executedTrades"],
        "skippedTrades": portfolio_run["skippedTrades"],
        "symbolStats": build_symbol_stats(portfolio_run, symbols, float(portfolio["initialCapital"])),
        "stageStats": stage_stats,
        "notes": build_portfolio_notes(
            summary=summary,
            stage_stats=stage_stats,
            test_window_days=test_window_days,
            active_stage_keys=active_stage_keys,
            execution_stage=execution_stage,
            symbol_runs=symbol_runs,
            portfolio=portfolio,
            symbol_errors=merged_symbol_errors,
        ),
        "range": range_payload,
        "dataPoints": data_points,
        "symbolErrors": merged_symbol_errors,
    }


def simulate_portfolio(
    symbol_runs: List[Dict[str, Any]],
    portfolio: Dict[str, float],
    curve_start_time: Optional[int] = None,
) -> Dict[str, Any]:
    candidate_trades: List[Dict[str, Any]] = []
    for run in symbol_runs:
        symbol = str((run.get("context") or {}).get("symbol") or "")
        symbol_key = sanitize_symbol(symbol)
        for trade in run.get("trades", []):
            candidate = dict(trade)
            candidate["symbol"] = symbol
            candidate["id"] = f"{symbol_key}_{trade['id']}"
            candidate_trades.append(candidate)

    candidate_trades.sort(
        key=lambda trade: (
            int(trade["entryTime"]),
            -int(trade.get("score", 0)),
            str(trade.get("symbol") or ""),
        )
    )

    executed_trades: List[Dict[str, Any]] = []
    skipped_trades: List[Dict[str, Any]] = []
    open_positions: List[Dict[str, Any]] = []
    cash = float(portfolio["initialCapital"])
    max_concurrent_positions = 0
    curve_points: List[Dict[str, Any]] = []
    peak_balance = cash
    max_drawdown_pct = 0.0

    if curve_start_time is None:
        curve_start_time = int(candidate_trades[0]["entryTime"]) if candidate_trades else int(time())
    curve_points.append(
        {
            "time": int(curve_start_time),
            "balance": round_number(cash, 2),
            "drawdownPct": 0.0,
            "netPnlAmount": 0.0,
            "symbol": None,
            "tradeId": None,
            "openPositions": 0,
            "event": "start",
        }
    )

    def release_closed_positions(entry_time: float) -> None:
        nonlocal cash, peak_balance, max_drawdown_pct
        open_positions.sort(key=lambda position: int(position["trade"]["exitTime"]))
        while open_positions and int(open_positions[0]["trade"]["exitTime"]) <= entry_time:
            position = open_positions.pop(0)
            trade = position["trade"]
            allocated_capital = float(position["allocatedCapital"])
            entry_commission_amount = float(position["entryCommissionAmount"])
            gross_pnl_amount = round_number((allocated_capital * float(trade["pnlPct"])) / 100, 2)
            exit_notional = max(0.0, allocated_capital + gross_pnl_amount)
            exit_commission_amount = round_number(exit_notional * (float(portfolio["commissionPct"]) / 100), 2)
            cash += allocated_capital + gross_pnl_amount - exit_commission_amount
            peak_balance = max(peak_balance, cash)
            drawdown_pct = ((cash - peak_balance) / max(1e-9, peak_balance)) * 100
            max_drawdown_pct = min(max_drawdown_pct, drawdown_pct)
            executed_trades.append(
                {
                    **trade,
                    "quantity": round_number(allocated_capital / max(1e-9, float(trade["entryPrice"])), 6),
                    "allocatedCapital": round_number(allocated_capital, 2),
                    "grossPnlAmount": gross_pnl_amount,
                    "netPnlAmount": round_number(gross_pnl_amount - entry_commission_amount - exit_commission_amount, 2),
                    "entryCommissionAmount": round_number(entry_commission_amount, 2),
                    "exitCommissionAmount": exit_commission_amount,
                    "endingBalance": round_number(cash, 2),
                }
            )
            curve_points.append(
                {
                    "time": int(trade["exitTime"]),
                    "balance": round_number(cash, 2),
                    "drawdownPct": round_number(drawdown_pct, 2),
                    "netPnlAmount": round_number(gross_pnl_amount - entry_commission_amount - exit_commission_amount, 2),
                    "symbol": trade["symbol"],
                    "tradeId": trade["id"],
                    "openPositions": len(open_positions),
                    "event": "close",
                }
            )

    for trade in candidate_trades:
        release_closed_positions(int(trade["entryTime"]))

        allocated_capital = float(portfolio["positionSize"])
        entry_commission_amount = round_number(allocated_capital * (float(portfolio["commissionPct"]) / 100), 2)
        required_cash = allocated_capital + entry_commission_amount
        if cash + 1e-9 < required_cash:
            skipped_trades.append(
                {
                    "id": f"{trade['id']}_skipped",
                    "symbol": trade["symbol"],
                    "side": trade["side"],
                    "entryTime": trade["entryTime"],
                    "entryPrice": trade["entryPrice"],
                    "requiredCash": round_number(required_cash, 2),
                    "availableCash": round_number(cash, 2),
                    "score": trade["score"],
                    "reason": "insufficient_cash",
                }
            )
            continue

        cash -= required_cash
        open_positions.append(
            {
                "trade": trade,
                "allocatedCapital": allocated_capital,
                "entryCommissionAmount": entry_commission_amount,
            }
        )
        max_concurrent_positions = max(max_concurrent_positions, len(open_positions))

    release_closed_positions(float("inf"))
    executed_trades.sort(key=lambda trade: (int(trade["entryTime"]), str(trade.get("symbol") or "")))

    return {
        "executedTrades": executed_trades,
        "skippedTrades": skipped_trades,
        "maxConcurrentPositions": max_concurrent_positions,
        "maxDrawdownPct": round_number(max_drawdown_pct, 2),
        "portfolioCurve": build_portfolio_curve_payload(curve_points, portfolio),
    }


def build_portfolio_summary(
    portfolio_run: Dict[str, Any],
    portfolio: Dict[str, float],
) -> Dict[str, Any]:
    trades = portfolio_run["executedTrades"]
    initial_capital = float(portfolio["initialCapital"])
    if not trades:
        return {
            "totalTrades": 0,
            "winRate": 0,
            "totalPnlPct": 0,
            "averagePnlPct": 0,
            "profitFactor": 0,
            "maxDrawdownPct": 0,
            "averageBarsHeld": 0,
            "initialCapital": round_number(initial_capital, 2),
            "finalBalance": round_number(initial_capital, 2),
            "totalGrossPnlAmount": 0,
            "totalNetPnlAmount": 0,
            "totalCommissionAmount": 0,
            "skippedTrades": len(portfolio_run["skippedTrades"]),
            "maxConcurrentPositions": portfolio_run["maxConcurrentPositions"],
        }

    total_gross_pnl_amount = sum(float(trade["grossPnlAmount"]) for trade in trades)
    total_commission_amount = sum(
        float(trade["entryCommissionAmount"]) + float(trade["exitCommissionAmount"])
        for trade in trades
    )
    final_balance = initial_capital + sum(float(trade["netPnlAmount"]) for trade in trades)
    wins = [trade for trade in trades if float(trade["netPnlAmount"]) > 0]
    losses = [trade for trade in trades if float(trade["netPnlAmount"]) < 0]
    gross_profit = sum(float(trade["netPnlAmount"]) for trade in wins)
    gross_loss = abs(sum(float(trade["netPnlAmount"]) for trade in losses))
    average_bars_held = sum(int(trade["barsHeld"]) for trade in trades) / len(trades)
    total_pnl_pct = ((final_balance - initial_capital) / max(1e-9, initial_capital)) * 100

    return {
        "totalTrades": len(trades),
        "winRate": len(wins) / len(trades),
        "totalPnlPct": round_number(total_pnl_pct, 2),
        "averagePnlPct": round_number(sum(float(trade["pnlPct"]) for trade in trades) / len(trades), 2),
        "profitFactor": round_number((gross_profit / gross_loss) if gross_loss > 0 else gross_profit, 2),
        "maxDrawdownPct": round_number(float(portfolio_run.get("maxDrawdownPct") or 0), 2),
        "averageBarsHeld": round_number(average_bars_held, 1),
        "initialCapital": round_number(initial_capital, 2),
        "finalBalance": round_number(final_balance, 2),
        "totalGrossPnlAmount": round_number(total_gross_pnl_amount, 2),
        "totalNetPnlAmount": round_number(final_balance - initial_capital, 2),
        "totalCommissionAmount": round_number(total_commission_amount, 2),
        "skippedTrades": len(portfolio_run["skippedTrades"]),
        "maxConcurrentPositions": portfolio_run["maxConcurrentPositions"],
    }


def build_portfolio_curve_payload(
    points: List[Dict[str, Any]],
    portfolio: Dict[str, float],
) -> Dict[str, Any]:
    normalized_points = sorted(points, key=lambda item: (int(item["time"]), 0 if str(item.get("event")) == "start" else 1))
    balances = [float(point["balance"]) for point in normalized_points] or [float(portfolio["initialCapital"])]
    return {
        "mode": "closed_balance",
        "initialBalance": round_number(float(portfolio["initialCapital"]), 2),
        "finalBalance": round_number(balances[-1], 2),
        "peakBalance": round_number(max(balances), 2),
        "lowBalance": round_number(min(balances), 2),
        "maxDrawdownPct": round_number(min(float(point.get("drawdownPct") or 0) for point in normalized_points), 2) if normalized_points else 0.0,
        "points": normalized_points,
    }


def aggregate_stage_stats(
    blueprint: Dict[str, Any],
    symbol_runs: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    payload: Dict[str, Dict[str, Any]] = {}
    for stage_key in STAGE_KEYS:
        passed_bars = sum(int(run["stageStats"][stage_key]["passedBars"]) for run in symbol_runs)
        core_bars = sum(int(run["stageStats"][stage_key]["coreBars"]) for run in symbol_runs)
        pass_rate = (passed_bars / core_bars) if core_bars > 0 else 0
        stage = blueprint["stages"][stage_key]
        payload[stage_key] = {
            "timeframe": stage["timeframe"],
            "passRate": pass_rate,
            "passedBars": passed_bars,
            "coreBars": core_bars,
            "ruleCount": len(stage["rules"]),
            "requiredRuleCount": len([rule for rule in stage["rules"] if rule["required"]]),
        }
    return payload


def aggregate_range(symbol_runs: List[Dict[str, Any]]) -> Dict[str, int]:
    from_value = min(int(run["range"]["from"]) for run in symbol_runs)
    to_value = max(int(run["range"]["to"]) for run in symbol_runs)
    return {"from": from_value, "to": to_value}


def aggregate_data_points(symbol_runs: List[Dict[str, Any]]) -> Dict[str, int]:
    return {
        "trend": sum(int(run["dataPoints"]["trend"]) for run in symbol_runs),
        "setup": sum(int(run["dataPoints"]["setup"]) for run in symbol_runs),
        "trigger": sum(int(run["dataPoints"]["trigger"]) for run in symbol_runs),
    }


def build_symbol_stats(
    portfolio_run: Dict[str, Any],
    symbols: List[str],
    initial_capital: float,
) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for symbol in symbols:
        executed = [trade for trade in portfolio_run["executedTrades"] if trade["symbol"] == symbol]
        skipped = [trade for trade in portfolio_run["skippedTrades"] if trade["symbol"] == symbol]
        net_pnl_amount = sum(float(trade["netPnlAmount"]) for trade in executed)
        commission_amount = sum(
            float(trade["entryCommissionAmount"]) + float(trade["exitCommissionAmount"])
            for trade in executed
        )
        wins = len([trade for trade in executed if float(trade["netPnlAmount"]) > 0])
        payload.append(
            {
                "symbol": symbol,
                "totalTrades": len(executed),
                "skippedTrades": len(skipped),
                "winRate": (wins / len(executed)) if executed else 0,
                "returnPct": round_number((net_pnl_amount / initial_capital) * 100, 2) if initial_capital > 0 else 0,
                "netPnlAmount": round_number(net_pnl_amount, 2),
                "totalCommissionAmount": round_number(commission_amount, 2),
            }
        )
    payload.sort(key=lambda item: float(item["netPnlAmount"]), reverse=True)
    return payload


def build_portfolio_notes(
    summary: Dict[str, Any],
    stage_stats: Dict[str, Dict[str, Any]],
    test_window_days: int,
    active_stage_keys: List[str],
    execution_stage: str,
    symbol_runs: List[Dict[str, Any]],
    portfolio: Dict[str, float],
    symbol_errors: List[Dict[str, str]],
) -> List[str]:
    notes = [
        f"{len(symbol_runs)} sembol {test_window_days} gunluk pencerede tarandi. Girisler aktif stage'ler icindeki en alt timeframe olan {execution_stage} stage'inin yeni aktif oldugu barda uretildi.",
        f"Portfoy modeli: baslangic bakiye {format_money(float(portfolio['initialCapital']))} TL, islem basi {format_money(float(portfolio['positionSize']))} TL, komisyon %{round_number(float(portfolio['commissionPct']), 3)} her giris ve cikista dusuldu.",
        f"Aktif stage'ler: {', '.join(active_stage_keys)}. Kural olmayan stage'ler devre disi sayildi.",
        f"Son bakiye {format_money(float(summary['finalBalance']))} TL. Toplam komisyon {format_money(float(summary['totalCommissionAmount']))} TL, yetersiz bakiye nedeniyle {int(summary['skippedTrades'])} trade atlandi.",
    ]

    if int(summary["totalTrades"]) == 0 and active_stage_keys:
        tightest_stage = sorted(
            ({"stageKey": stage_key, "rate": stage_stats[stage_key]["passRate"]} for stage_key in active_stage_keys),
            key=lambda item: item["rate"],
        )[0]
        notes.append(
            f"{tightest_stage['stageKey']} stage'i en dar bogaz olarak gorunuyor. Agregede pass rate %{round_number(float(stage_stats[tightest_stage['stageKey']]['passRate']) * 100, 1)}."
        )

    if symbol_errors:
        notes.append(f"{len(symbol_errors)} sembol veri hatasi nedeniyle kosuya dahil edilmedi.")

    return notes


def get_active_stage_keys(blueprint: Dict[str, Any]) -> List[str]:
    return [stage_key for stage_key in STAGE_KEYS if (blueprint["stages"].get(stage_key) or {}).get("rules")]


def get_execution_stage_key(blueprint: Dict[str, Any], active_stage_keys: List[str]) -> str:
    return sorted(
        active_stage_keys,
        key=lambda stage_key: get_timeframe_seconds(str(blueprint["stages"][stage_key]["timeframe"])),
    )[0]


def normalize_symbols(blueprint: Dict[str, Any]) -> List[str]:
    raw_symbols = [
        *(str(symbol).strip().upper() for symbol in (blueprint.get("symbols") or [])),
        str(blueprint.get("symbol") or "").strip().upper(),
    ]
    ordered: List[str] = []
    seen: set[str] = set()
    for symbol in raw_symbols:
        if not symbol or symbol in seen:
            continue
        ordered.append(symbol)
        seen.add(symbol)
    if not ordered:
        raise ValueError("En az bir sembol secmelisin.")
    return ordered


def normalize_portfolio_config(input_payload: Optional[Dict[str, Any]]) -> Dict[str, float]:
    initial_capital = clamp_number((input_payload or {}).get("initialCapital"), 100000, 1000, 1_000_000_000)
    position_size = clamp_number((input_payload or {}).get("positionSize"), min(initial_capital, 10000), 100, initial_capital)
    commission_pct = clamp_number((input_payload or {}).get("commissionPct"), 0.1, 0, 10)
    return {
        "initialCapital": round_number(initial_capital, 2),
        "positionSize": round_number(position_size, 2),
        "commissionPct": round_number(commission_pct, 4),
    }


def sanitize_symbol(symbol: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in symbol.upper()) or "SYMBOL"


def clamp_int(value: Any, fallback: int, minimum: int, maximum: int) -> int:
    try:
        number_value = round(float(value))
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, int(number_value)))


def clamp_number(value: Any, fallback: float, minimum: float, maximum: float) -> float:
    try:
        number_value = float(value)
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, number_value))


def format_money(value: float) -> str:
    return f"{round_number(value, 2):.2f}"
