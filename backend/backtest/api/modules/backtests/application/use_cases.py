from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from dataclasses import dataclass
from math import ceil
from threading import Thread
from time import time
from typing import Any, Callable
from uuid import uuid4

from stratejiler.multi_timeframe_backtest import derive_warmup_bars
from stratejiler.portfolio_backtest import run_portfolio_blueprint_backtest
from api.modules.backtests.domain.models import (
    BacktestRunRecord,
    build_preset_catalog,
    build_rule_catalog,
    validate_blueprint_payload,
)
from api.modules.backtests.infrastructure.market_data import MarketDataGateway, get_timeframe_seconds, utc_now
from api.modules.backtests.infrastructure.run_store import InMemoryRunStore


class BacktestCatalogUseCases:
    @staticmethod
    def list_rules() -> dict[str, Any]:
        return build_rule_catalog()

    @staticmethod
    def list_presets() -> dict[str, Any]:
        return build_preset_catalog()


@dataclass
class BacktestExecutionArtifacts:
    run_id: str
    result: dict[str, Any]
    events: list[dict[str, Any]]


class RunBlueprintBacktestUseCase:
    def __init__(
        self,
        market_data_gateway: MarketDataGateway,
        run_store: InMemoryRunStore,
    ) -> None:
        self._market_data_gateway = market_data_gateway
        self._run_store = run_store

    def execute(self, blueprint: dict[str, Any]) -> dict[str, Any]:
        started_at = int(time())
        run_id = f"btrun_{uuid4()}"
        execution = self._execute_blueprint(run_id=run_id, blueprint=blueprint)
        completed_at = int(time())
        self._run_store.save(
            BacktestRunRecord(
                run_id=run_id,
                status="completed",
                created_at=started_at,
                started_at=started_at,
                finished_at=completed_at,
                progress=build_progress_payload(
                    phase="completed",
                    progress_pct=100,
                    total_symbols=len(get_requested_symbols(blueprint)),
                    processed_symbols=len(get_requested_symbols(blueprint)),
                    message="Backtest tamamlandi.",
                ),
                result=execution.result,
                events=execution.events,
            )
        )
        return build_run_response(run_id, execution.result, execution.events)

    def _execute_blueprint(
        self,
        run_id: str,
        blueprint: dict[str, Any],
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> BacktestExecutionArtifacts:
        validate_blueprint_payload(blueprint)

        now_dt = utc_now()
        now_ts = int(now_dt.timestamp())
        test_window_days = clamp_int(blueprint.get("testWindowDays"), 365, 30, 3650)
        warmup_bars = derive_warmup_bars(blueprint)
        active_timeframes = get_active_timeframes(blueprint)
        symbols = get_requested_symbols(blueprint)
        total_symbols = len(symbols)

        candles_by_symbol: dict[str, dict[str, list[dict[str, float | int]]]] = {}
        symbol_errors: list[dict[str, str]] = []
        worker_count = get_symbol_worker_count(total_symbols)

        if progress_callback:
            progress_callback(
                build_progress_payload(
                    phase="loading_market_data",
                    progress_pct=4,
                    total_symbols=total_symbols,
                    processed_symbols=0,
                    message=f"Mum verileri yukleniyor. {worker_count} paralel worker aktif.",
                )
            )

        def load_symbol(symbol: str) -> dict[str, list[dict[str, float | int]]]:
            return self._market_data_gateway.load_candles_by_timeframe(
                symbol=symbol,
                timeframes=active_timeframes,
                test_window_days=test_window_days,
                warmup_bars=warmup_bars,
                now_utc=now_dt,
            )

        if can_use_symbol_batch_loading(self._market_data_gateway, active_timeframes, symbols):
            batch_size = get_symbol_batch_size(total_symbols)
            batches = chunk_symbols(symbols, batch_size)
            batch_workers = min(worker_count, len(batches))

            with ThreadPoolExecutor(max_workers=batch_workers, thread_name_prefix="bt-batch") as executor:
                futures = {
                    executor.submit(
                        self._market_data_gateway.load_candles_for_symbols,
                        batch,
                        active_timeframes,
                        test_window_days,
                        warmup_bars,
                        now_dt,
                    ): batch
                    for batch in batches
                }
                processed_symbols = 0
                for future in as_completed(futures):
                    batch = futures[future]
                    try:
                        candles_by_symbol.update(future.result())
                    except Exception as exc:
                        for symbol in batch:
                            symbol_errors.append({"symbol": symbol, "message": str(exc)})

                    processed_symbols += len(batch)
                    if progress_callback:
                        progress_callback(
                            build_progress_payload(
                                phase="loading_market_data",
                                progress_pct=4 + int((processed_symbols / max(total_symbols, 1)) * 76),
                                total_symbols=total_symbols,
                                processed_symbols=min(total_symbols, processed_symbols),
                                current_symbol=batch[-1] if batch else None,
                                message=f"{min(total_symbols, processed_symbols)} hisse tarandi. Batch size {batch_size}, {batch_workers} paralel batch worker aktif.",
                            )
                        )

        elif worker_count <= 1:
            for index, symbol in enumerate(symbols, start=1):
                try:
                    candles_by_symbol[symbol] = load_symbol(symbol)
                except Exception as exc:
                    symbol_errors.append({"symbol": symbol, "message": str(exc)})

                if progress_callback:
                    progress_callback(
                        build_progress_payload(
                            phase="loading_market_data",
                            progress_pct=4 + int((index / max(total_symbols, 1)) * 76),
                            total_symbols=total_symbols,
                            processed_symbols=index,
                            current_symbol=symbol,
                            message=f"{symbol} tarandi.",
                        )
                    )
        else:
            processed_symbols = 0
            with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="bt-load") as executor:
                futures = {
                    executor.submit(load_symbol, symbol): symbol
                    for symbol in symbols
                }
                for future in as_completed(futures):
                    symbol = futures[future]
                    try:
                        candles_by_symbol[symbol] = future.result()
                    except Exception as exc:
                        symbol_errors.append({"symbol": symbol, "message": str(exc)})

                    processed_symbols += 1
                    if progress_callback:
                        progress_callback(
                            build_progress_payload(
                                phase="loading_market_data",
                                progress_pct=4 + int((processed_symbols / max(total_symbols, 1)) * 76),
                                total_symbols=total_symbols,
                                processed_symbols=processed_symbols,
                                current_symbol=symbol,
                                message=f"{symbol} tarandi. {worker_count} worker ile toplu veri yukleniyor.",
                            )
                        )

        if progress_callback:
            progress_callback(
                build_progress_payload(
                    phase="simulating_portfolio",
                    progress_pct=86,
                    total_symbols=total_symbols,
                    processed_symbols=total_symbols,
                    message="Trade adaylari ortak cuzdanla simule ediliyor.",
                )
            )

        result = run_portfolio_blueprint_backtest(
            blueprint=blueprint,
            candles_by_symbol=candles_by_symbol,
            now_ts=now_ts,
            symbol_errors=symbol_errors,
        )

        if progress_callback:
            progress_callback(
                build_progress_payload(
                    phase="finalizing",
                    progress_pct=97,
                    total_symbols=total_symbols,
                    processed_symbols=total_symbols,
                    message="Sonuclar ve event kaydi hazirlaniyor.",
                )
            )

        events = flatten_trade_events(run_id, result)
        return BacktestExecutionArtifacts(run_id=run_id, result=result, events=events)


class StartBlueprintBacktestUseCase:
    def __init__(
        self,
        market_data_gateway: MarketDataGateway,
        run_store: InMemoryRunStore,
    ) -> None:
        self._run_store = run_store
        self._runner = RunBlueprintBacktestUseCase(market_data_gateway, run_store)

    def execute(self, blueprint: dict[str, Any]) -> dict[str, Any]:
        validate_blueprint_payload(blueprint)
        symbols = get_requested_symbols(blueprint)
        run_id = f"btrun_{uuid4()}"
        created_at = int(time())
        queued_progress = build_progress_payload(
            phase="queued",
            progress_pct=0,
            total_symbols=len(symbols),
            processed_symbols=0,
            message="Backtest kuyruga alindi.",
        )
        self._run_store.save(
            BacktestRunRecord(
                run_id=run_id,
                status="queued",
                created_at=created_at,
                progress=queued_progress,
            )
        )

        worker = Thread(
            target=self._run_in_background,
            args=(run_id, deepcopy(blueprint), len(symbols)),
            daemon=True,
            name=f"backtest-{run_id}",
        )
        worker.start()

        return {
            "runId": run_id,
            "status": "queued",
            "progress": queued_progress,
        }

    def _run_in_background(self, run_id: str, blueprint: dict[str, Any], total_symbols: int) -> None:
        started_at = int(time())
        self._run_store.update(
            run_id,
            status="running",
            started_at=started_at,
            progress=build_progress_payload(
                phase="loading_market_data",
                progress_pct=1,
                total_symbols=total_symbols,
                processed_symbols=0,
                message="Backtest basladi.",
            ),
        )

        try:
            execution = self._runner._execute_blueprint(
                run_id=run_id,
                blueprint=blueprint,
                progress_callback=lambda payload: self._run_store.update(
                    run_id,
                    status="running",
                    progress=payload,
                ),
            )
            finished_at = int(time())
            self._run_store.update(
                run_id,
                status="completed",
                finished_at=finished_at,
                progress=build_progress_payload(
                    phase="completed",
                    progress_pct=100,
                    total_symbols=total_symbols,
                    processed_symbols=total_symbols,
                    message="Backtest tamamlandi.",
                ),
                result=execution.result,
                events=execution.events,
            )
        except Exception as exc:
            finished_at = int(time())
            current_progress = self._run_store.get(run_id)
            total = total_symbols
            processed = 0
            if current_progress and current_progress.progress:
                total = int(current_progress.progress.get("totalSymbols") or total_symbols or 0)
                processed = int(current_progress.progress.get("processedSymbols") or 0)
            self._run_store.update(
                run_id,
                status="failed",
                finished_at=finished_at,
                error=str(exc),
                progress=build_progress_payload(
                    phase="failed",
                    progress_pct=min(99, int((processed / max(total, 1)) * 100)),
                    total_symbols=total,
                    processed_symbols=processed,
                    message=f"Backtest basarisiz: {exc}",
                ),
            )


class GetRunStatusUseCase:
    def __init__(self, run_store: InMemoryRunStore) -> None:
        self._run_store = run_store

    def execute(self, run_id: str) -> dict[str, Any] | None:
        record = self._run_store.get(run_id)
        if record is None:
            return None

        payload: dict[str, Any] = {
            "runId": run_id,
            "status": record.status,
            "createdAt": record.created_at,
            "startedAt": record.started_at,
            "finishedAt": record.finished_at,
            "progress": record.progress,
            "eventsCount": len(record.events),
        }
        if record.error:
            payload["error"] = record.error
        if record.result:
            payload["result"] = record.result
            payload["summary"] = build_result_summary(record.result)
        return payload


class GetRunEventsUseCase:
    def __init__(self, run_store: InMemoryRunStore) -> None:
        self._run_store = run_store

    def execute(self, run_id: str, page: int, limit: int) -> dict[str, Any] | None:
        record = self._run_store.get(run_id)
        if record is None:
            return None

        page_num = max(int(page or 1), 1)
        page_size = min(max(int(limit or 200), 1), 500)
        start = (page_num - 1) * page_size
        events = record.events[start:start + page_size]

        return {
            "runId": run_id,
            "events": events,
            "summary": build_result_summary(record.result) if record.result else None,
            "page": page_num,
            "totalPages": max(1, ceil(len(record.events) / page_size)),
            "totalEvents": len(record.events),
        }


class GetRunPortfolioCurveUseCase:
    def __init__(self, run_store: InMemoryRunStore) -> None:
        self._run_store = run_store

    def execute(self, run_id: str) -> dict[str, Any] | None:
        record = self._run_store.get(run_id)
        if record is None:
            return None

        payload: dict[str, Any] = {
            "runId": run_id,
            "status": record.status,
            "createdAt": record.created_at,
            "startedAt": record.started_at,
            "finishedAt": record.finished_at,
            "progress": record.progress,
        }
        if record.error:
            payload["error"] = record.error
        if record.result:
            payload["summary"] = build_result_summary(record.result)
            payload["curve"] = record.result.get("portfolioCurve")
        return payload


def build_run_response(run_id: str, result: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "runId": run_id,
        "result": result,
        "summary": build_result_summary(result),
        "eventsCount": len(events),
    }


def build_result_summary(result: dict[str, Any]) -> dict[str, Any]:
    summary = result["summary"]
    return {
        "totalTrades": summary["totalTrades"],
        "winRate": summary["winRate"],
        "totalPnl": summary["totalPnlPct"],
        "maxDrawdown": summary["maxDrawdownPct"],
    }


def build_progress_payload(
    *,
    phase: str,
    progress_pct: int,
    total_symbols: int,
    processed_symbols: int,
    message: str,
    current_symbol: str | None = None,
) -> dict[str, Any]:
    return {
        "phase": phase,
        "progressPct": max(0, min(100, int(progress_pct))),
        "totalSymbols": max(0, int(total_symbols)),
        "processedSymbols": max(0, int(processed_symbols)),
        "currentSymbol": current_symbol,
        "message": message,
    }


def flatten_trade_events(run_id: str, result: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    default_symbol = (result.get("context") or {}).get("symbol")
    for trade in result.get("trades", []):
        trade_id = str(trade["id"])
        qty = float(trade.get("quantity", 1))
        symbol = str(trade.get("symbol") or default_symbol or "")
        entry_event = {
            "id": f"{trade_id}_entry",
            "type": "entry",
            "time": trade["entryTime"],
            "price": trade["entryPrice"],
            "side": trade["side"],
            "symbol": symbol,
            "qty": qty,
            "tradeId": trade_id,
            "orderId": f"{run_id}_{trade_id}_entry",
            "pnl": None,
            "reason": "Blueprint trigger",
            "meta": {
                "allocatedCapital": trade.get("allocatedCapital"),
                "score": trade["score"],
                "stages": trade["stages"],
            },
        }
        exit_event = {
            "id": f"{trade_id}_exit",
            "type": map_exit_reason(str(trade["exitReason"])),
            "time": trade["exitTime"],
            "price": trade["exitPrice"],
            "side": trade["side"],
            "symbol": symbol,
            "qty": qty,
            "tradeId": trade_id,
            "orderId": f"{run_id}_{trade_id}_exit",
            "pnl": trade.get("netPnlAmount", trade["pnlPct"]),
            "reason": trade["exitReason"],
            "meta": {
                "barsHeld": trade["barsHeld"],
                "pnlPct": trade["pnlPct"],
                "entryCommissionAmount": trade.get("entryCommissionAmount"),
                "exitCommissionAmount": trade.get("exitCommissionAmount"),
                "score": trade["score"],
                "stages": trade["stages"],
            },
        }
        events.extend([entry_event, exit_event])

    return events


def map_exit_reason(exit_reason: str) -> str:
    if exit_reason == "target":
        return "tp"
    if exit_reason == "stop":
        return "stop"
    return "exit"


def get_active_timeframes(blueprint: dict[str, Any]) -> list[str]:
    stages = blueprint.get("stages") or {}
    seen: set[str] = set()
    ordered: list[str] = []
    for stage_key in ("trend", "setup", "trigger"):
        stage = stages.get(stage_key) or {}
        if not stage.get("rules"):
            continue
        timeframe = str(stage.get("timeframe") or "").strip()
        if timeframe and timeframe not in seen:
            ordered.append(timeframe)
            seen.add(timeframe)
    return ordered


def get_requested_symbols(blueprint: dict[str, Any]) -> list[str]:
    raw_symbols = [
        *(str(symbol).strip().upper() for symbol in (blueprint.get("symbols") or [])),
        str(blueprint.get("symbol") or "").strip().upper(),
    ]
    ordered: list[str] = []
    seen: set[str] = set()
    for symbol in raw_symbols:
        if not symbol or symbol in seen:
            continue
        ordered.append(symbol)
        seen.add(symbol)
    if not ordered:
        raise ValueError("En az bir sembol secmelisin.")
    return ordered


def clamp_int(value: Any, fallback: int, minimum: int, maximum: int) -> int:
    try:
        number_value = int(value)
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, number_value))


def get_symbol_worker_count(total_symbols: int) -> int:
    if total_symbols <= 1:
        return 1

    env_value = os.environ.get("BACKTEST_SYMBOL_WORKERS")
    if env_value:
        return clamp_int(env_value, 8, 1, min(32, total_symbols))

    pool_max = clamp_int(os.environ.get("ORACLE_POOL_MAX"), 8, 1, 16)
    return min(total_symbols, max(4, pool_max))


def get_symbol_batch_size(total_symbols: int) -> int:
    env_value = os.environ.get("BACKTEST_SYMBOL_BATCH_SIZE")
    if env_value:
        return clamp_int(env_value, 4, 4, min(64, max(total_symbols, 4)))
    return min(4, max(4, total_symbols))


def chunk_symbols(symbols: list[str], batch_size: int) -> list[list[str]]:
    size = max(1, batch_size)
    return [symbols[index:index + size] for index in range(0, len(symbols), size)]


def can_use_symbol_batch_loading(
    market_data_gateway: MarketDataGateway,
    active_timeframes: list[str],
    symbols: list[str],
) -> bool:
    if len(symbols) < 8:
        return False
    loader = getattr(market_data_gateway, "load_candles_for_symbols", None)
    return callable(loader) and all(get_timeframe_seconds(timeframe) >= 3600 for timeframe in active_timeframes)
