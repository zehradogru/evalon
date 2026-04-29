from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import sys
import tempfile

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.modules.co_movement.application.use_cases import AnalyzeCoMovementUseCase, ExplainCoMovementUseCase
from api.modules.co_movement.domain.models import CoMovementAnalyzeInput, CoMovementExplainInput
from api.modules.co_movement.infrastructure.explainer import CoMovementExplainer
from api.modules.co_movement.infrastructure.snapshot_store import CoMovementSnapshotStore


class FakeCoMovementGateway:
    def __init__(self, frames: dict[str, pd.DataFrame]) -> None:
        self._frames = frames

    def build_daily_window(self, start_date: date, end_date: date) -> tuple[datetime, datetime]:
        start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        return start_dt, end_dt

    def load_close_frames(
        self,
        *,
        symbols: list[str],
        start_date: datetime,
        end_date: datetime,
        timeframe: str = "1d",
    ) -> dict[str, pd.DataFrame]:
        del start_date, end_date, timeframe
        return {symbol: self._frames.get(symbol, pd.DataFrame()) for symbol in symbols}


def _make_close_frame(index: pd.DatetimeIndex, values: np.ndarray) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "ticker": ["TEST"] * len(index),
            "open": values,
            "high": values,
            "low": values,
            "close": values,
            "volume": np.full(len(index), 1_000),
        },
        index=index,
    )


def _build_frames() -> dict[str, pd.DataFrame]:
    index = pd.date_range("2024-01-01", periods=160, freq="D")
    x = np.linspace(0, 8, len(index))

    bank_base = 100 + np.linspace(0, 32, len(index)) + np.sin(x) * 2.0
    bank_peer = 102 + np.linspace(0, 31.5, len(index)) + np.sin(x + 0.04) * 2.1
    airline_base = 70 + np.sin(x * 1.7) * 6.0 + np.linspace(0, 8, len(index))
    airline_peer = 72 + np.sin((x * 1.7) + 0.08) * 6.2 + np.linspace(0, 8.5, len(index))

    sparse_index = index[::11]
    sparse_values = 40 + np.linspace(0, 3, len(sparse_index))

    return {
        "AKBNK": _make_close_frame(index, bank_base),
        "GARAN": _make_close_frame(index, bank_peer),
        "THYAO": _make_close_frame(index, airline_base),
        "PGSUS": _make_close_frame(index, airline_peer),
        "SPARSE": _make_close_frame(sparse_index, sparse_values),
    }


def test_analyze_co_movement_builds_expected_outputs():
    gateway = FakeCoMovementGateway(_build_frames())
    use_case = AnalyzeCoMovementUseCase(gateway)

    result = use_case.execute(
        CoMovementAnalyzeInput(
            symbols=["AKBNK", "GARAN", "THYAO", "PGSUS", "SPARSE"],
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 8),
            top_k=2,
            min_similarity=0.7,
            rolling_window=60,
            rolling_step=20,
            max_missing_ratio=0.2,
        )
    )

    assert result["symbols"] == ["AKBNK", "GARAN", "THYAO", "PGSUS"]
    assert any(item["symbol"] == "SPARSE" for item in result["excluded_symbols"])
    assert result["matrices"]["pearson"]["AKBNK"]["GARAN"] > 0.95
    assert result["matrices"]["hybrid_similarity"]["THYAO"]["PGSUS"] > 0.8
    assert result["graph"]["edges"]
    assert result["metrics"]["community_count"] == 2
    assert result["rolling_stability"]
    assert result["top_pairs"][0]["hybrid_similarity"] >= result["top_pairs"][-1]["hybrid_similarity"]


def test_analyze_co_movement_rejects_non_daily_timeframe():
    gateway = FakeCoMovementGateway(_build_frames())
    use_case = AnalyzeCoMovementUseCase(gateway)

    try:
        use_case.execute(
            CoMovementAnalyzeInput(
                symbols=["AKBNK", "GARAN"],
                start_date=date(2024, 1, 1),
                end_date=date(2024, 6, 8),
                timeframe="1h",
            )
        )
    except ValueError as exc:
        assert "yalnizca gunluk" in str(exc)
    else:
        raise AssertionError("Expected ValueError for non-daily timeframe.")


def test_explain_co_movement_fallback_is_turkish_and_warns():
    use_case = ExplainCoMovementUseCase(CoMovementExplainer())
    payload = use_case.execute(
        CoMovementExplainInput(
            top_pairs=[
                {
                    "source": "AKBNK",
                    "target": "GARAN",
                    "hybrid_similarity": 0.92,
                    "pearson": 0.88,
                    "dtw_similarity": 0.96,
                }
            ],
            communities=[
                {
                    "community_id": 0,
                    "stocks": ["AKBNK", "GARAN"],
                    "size": 2,
                    "avg_similarity": 0.92,
                }
            ],
            metrics={"modularity": 0.41, "rolling_window_count": 5},
            language="tr",
            symbols=["AKBNK", "GARAN"],
            date_range={"start": "2024-01-01", "end": "2024-06-01"},
        )
    )

    assert "AKBNK-GARAN" in payload["summary"]
    assert "yatirim tavsiyesi" in payload["warnings"][-1].lower()
    assert payload["source"] in {"heuristic", "llm"}


def test_snapshot_store_compacts_summary_and_keeps_matrix_access():
    gateway = FakeCoMovementGateway(_build_frames())
    result = AnalyzeCoMovementUseCase(gateway).execute(
        CoMovementAnalyzeInput(
            symbols=["AKBNK", "GARAN", "THYAO", "PGSUS"],
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 8),
            min_history_rows=60,
        )
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        store = CoMovementSnapshotStore(tmp_dir)
        metadata = store.save_snapshot(result, snapshot_id="snap_test", label="test")
        summary = store.load_latest_summary()
        matrix_payload = store.load_latest_matrix("hybrid_similarity", symbols=["AKBNK", "GARAN"])

    assert metadata["snapshot_id"] == "snap_test"
    assert summary["snapshot"]["snapshot_id"] == "snap_test"
    assert summary["snapshot_summary"]["top_pairs_saved"] <= 1000
    assert matrix_payload["symbols"] == ["AKBNK", "GARAN"]
    assert matrix_payload["matrix"]["AKBNK"]["GARAN"] is not None
