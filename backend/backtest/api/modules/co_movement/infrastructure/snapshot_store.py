from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np


class CoMovementSnapshotStore:
    MATRIX_KEYS = (
        "pearson",
        "spearman",
        "dtw_distance",
        "dtw_similarity",
        "hybrid_similarity",
    )
    SUMMARY_TOP_PAIRS_LIMIT = 1000
    SUMMARY_PAIR_RANKING_LIMIT = 500
    SUMMARY_ROLLING_STABILITY_LIMIT = 1000

    def __init__(self, path: str | Path) -> None:
        self._root = Path(path)
        self._lock = Lock()
        self._root.mkdir(parents=True, exist_ok=True)

    def save_snapshot(
        self,
        analysis_result: dict[str, Any],
        *,
        snapshot_id: str | None = None,
        label: str = "universe",
    ) -> dict[str, Any]:
        with self._lock:
            created_at = datetime.now(timezone.utc)
            snapshot_id = snapshot_id or f"{label}_{created_at.strftime('%Y%m%dT%H%M%SZ')}"
            snapshot_dir = self._root / snapshot_id
            snapshot_dir.mkdir(parents=True, exist_ok=False)

            symbols = list(analysis_result.get("symbols") or [])
            matrices = deepcopy(analysis_result.get("matrices") or {})

            metadata = {
                "snapshot_id": snapshot_id,
                "label": label,
                "created_at": created_at.isoformat(),
                "symbol_count": len(symbols),
                "edge_count": int((analysis_result.get("metrics") or {}).get("edge_count", 0)),
                "community_count": int((analysis_result.get("metrics") or {}).get("community_count", 0)),
                "date_range": deepcopy(analysis_result.get("date_range") or {}),
                "config": deepcopy(analysis_result.get("config") or {}),
                "available_matrices": list(self.MATRIX_KEYS),
            }

            summary = self._build_compact_summary(analysis_result, metadata)
            self._write_json(snapshot_dir / "summary.json", summary)
            self._write_json(snapshot_dir / "metadata.json", metadata)
            self._write_matrices(snapshot_dir / "matrices.npz", matrices, symbols)

            latest = {
                "snapshot_id": snapshot_id,
                "summary_path": str((snapshot_dir / "summary.json").resolve()),
                "metadata_path": str((snapshot_dir / "metadata.json").resolve()),
                "matrices_path": str((snapshot_dir / "matrices.npz").resolve()),
                "created_at": metadata["created_at"],
            }
            self._write_json(self._root / "latest.json", latest)
            return metadata

    def _build_compact_summary(
        self,
        analysis_result: dict[str, Any],
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        summary = deepcopy(analysis_result)
        summary["snapshot"] = metadata
        summary["matrices"] = {
            "storage": "npz",
            "available": list(self.MATRIX_KEYS),
            "symbols": list(analysis_result.get("symbols") or []),
        }
        pair_rankings = summary.get("pair_rankings") or {}
        rolling = summary.get("rolling_stability") or []
        top_pairs = summary.get("top_pairs") or []

        summary["top_pairs"] = top_pairs[: self.SUMMARY_TOP_PAIRS_LIMIT]
        summary["rolling_stability"] = rolling[: self.SUMMARY_ROLLING_STABILITY_LIMIT]
        summary["pair_rankings"] = {
            key: list(values[: self.SUMMARY_PAIR_RANKING_LIMIT])
            for key, values in pair_rankings.items()
        }
        summary["snapshot_summary"] = {
            "top_pairs_total": len(top_pairs),
            "top_pairs_saved": len(summary["top_pairs"]),
            "rolling_stability_total": len(rolling),
            "rolling_stability_saved": len(summary["rolling_stability"]),
            "pair_rankings_total": {
                key: len(values)
                for key, values in pair_rankings.items()
            },
            "pair_rankings_saved": {
                key: len(values)
                for key, values in summary["pair_rankings"].items()
            },
        }
        return summary

    def list_snapshots(self) -> list[dict[str, Any]]:
        snapshots: list[dict[str, Any]] = []
        for child in sorted(self._root.iterdir()):
            if not child.is_dir():
                continue
            metadata_path = child / "metadata.json"
            if metadata_path.is_file():
                snapshots.append(self._read_json(metadata_path))
        snapshots.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return snapshots

    def load_latest_summary(self) -> dict[str, Any]:
        latest = self._read_latest_pointer()
        return self._read_json(Path(latest["summary_path"]))

    def load_summary(self, snapshot_id: str) -> dict[str, Any]:
        summary_path = self._root / snapshot_id / "summary.json"
        return self._read_json(summary_path)

    def load_latest_matrix(
        self,
        matrix_name: str,
        *,
        symbols: list[str] | None = None,
    ) -> dict[str, Any]:
        latest = self._read_latest_pointer()
        return self._load_matrix(Path(latest["matrices_path"]), matrix_name, symbols=symbols)

    def load_matrix(
        self,
        snapshot_id: str,
        matrix_name: str,
        *,
        symbols: list[str] | None = None,
    ) -> dict[str, Any]:
        matrix_path = self._root / snapshot_id / "matrices.npz"
        return self._load_matrix(matrix_path, matrix_name, symbols=symbols)

    def _load_matrix(
        self,
        matrix_path: Path,
        matrix_name: str,
        *,
        symbols: list[str] | None = None,
    ) -> dict[str, Any]:
        if matrix_name not in self.MATRIX_KEYS:
            raise ValueError(f"Unsupported matrix_name: {matrix_name}")
        if not matrix_path.is_file():
            raise FileNotFoundError(f"Matrix file not found: {matrix_path}")

        with np.load(matrix_path, allow_pickle=False) as payload:
            stored_symbols = [str(item) for item in payload["symbols"].tolist()]
            matrix = payload[matrix_name]

        selected_symbols = stored_symbols
        if symbols:
            requested = [symbol for symbol in symbols if symbol in stored_symbols]
            if len(requested) < 2:
                raise ValueError("En az 2 gecerli symbol secilmeli.")
            indices = [stored_symbols.index(symbol) for symbol in requested]
            matrix = matrix[np.ix_(indices, indices)]
            selected_symbols = requested

        return {
            "matrix_name": matrix_name,
            "symbols": selected_symbols,
            "matrix": self._matrix_array_to_dict(matrix, selected_symbols),
        }

    def _write_matrices(
        self,
        path: Path,
        matrices: dict[str, Any],
        symbols: list[str],
    ) -> None:
        arrays: dict[str, Any] = {
            "symbols": np.asarray(symbols, dtype="<U16"),
        }
        for key in self.MATRIX_KEYS:
            matrix_dict = matrices.get(key) or {}
            arrays[key] = self._matrix_dict_to_array(matrix_dict, symbols)
        np.savez_compressed(path, **arrays)

    @staticmethod
    def _matrix_dict_to_array(
        matrix_dict: dict[str, dict[str, float | None]],
        symbols: list[str],
    ) -> np.ndarray:
        size = len(symbols)
        matrix = np.zeros((size, size), dtype=np.float64)
        for row_index, row_symbol in enumerate(symbols):
            row = matrix_dict.get(row_symbol) or {}
            for column_index, column_symbol in enumerate(symbols):
                value = row.get(column_symbol)
                matrix[row_index, column_index] = np.nan if value is None else float(value)
        return matrix

    @staticmethod
    def _matrix_array_to_dict(
        matrix: np.ndarray,
        symbols: list[str],
    ) -> dict[str, dict[str, float | None]]:
        payload: dict[str, dict[str, float | None]] = {}
        for row_index, row_symbol in enumerate(symbols):
            payload[row_symbol] = {}
            for column_index, column_symbol in enumerate(symbols):
                value = matrix[row_index, column_index]
                payload[row_symbol][column_symbol] = None if np.isnan(value) else round(float(value), 6)
        return payload

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        if not path.is_file():
            raise FileNotFoundError(f"Snapshot file not found: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    def _read_latest_pointer(self) -> dict[str, Any]:
        latest_path = self._root / "latest.json"
        return self._read_json(latest_path)
