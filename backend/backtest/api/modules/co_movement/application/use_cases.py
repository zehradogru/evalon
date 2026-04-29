from __future__ import annotations

from typing import Any

from api.modules.co_movement.domain.models import CoMovementAnalyzeInput, CoMovementExplainInput
from api.modules.co_movement.infrastructure.analysis_engine import (
    align_price_frames,
    annotate_nodes_with_communities,
    build_similarity_graph,
    combine_similarity_matrices,
    compute_correlation_matrix,
    compute_log_returns,
    compute_normalized_close,
    compute_pairwise_dtw_distance,
    compute_rolling_stability,
    detect_communities,
    distance_to_similarity,
    matrix_to_serializable,
    normalize_symbols,
    top_pairs_from_matrix,
)
from api.modules.co_movement.infrastructure.explainer import CoMovementExplainer
from api.modules.co_movement.infrastructure.market_data import CoMovementMarketDataGateway
from api.modules.co_movement.infrastructure.snapshot_store import CoMovementSnapshotStore


class AnalyzeCoMovementUseCase:
    def __init__(self, data_gateway: CoMovementMarketDataGateway) -> None:
        self._data_gateway = data_gateway

    def execute(self, request: CoMovementAnalyzeInput) -> dict[str, Any]:
        symbols = normalize_symbols(request.symbols)
        if len(symbols) < 2:
            raise ValueError("Analiz icin en az 2 gecerli hisse gerekli.")

        if request.timeframe != "1d":
            raise ValueError("Ilk versiyonda yalnizca gunluk (1d) analiz destekleniyor.")

        start_dt, end_dt = self._data_gateway.build_daily_window(request.start_date, request.end_date)
        frames = self._data_gateway.load_close_frames(
            symbols=symbols,
            start_date=start_dt,
            end_date=end_dt,
            timeframe=request.timeframe,
        )

        aligned_close, excluded_symbols, data_quality = align_price_frames(
            frames,
            max_missing_ratio=request.max_missing_ratio,
            min_history_rows=request.min_history_rows,
        )
        usable_symbols = list(aligned_close.columns)
        if len(usable_symbols) < 2:
            raise ValueError("Analiz icin yeterli ortak veri kalmadi.")

        log_returns = compute_log_returns(aligned_close)
        pearson_matrix = compute_correlation_matrix(log_returns, "pearson")
        spearman_matrix = compute_correlation_matrix(log_returns, "spearman")

        normalized_close = compute_normalized_close(aligned_close)
        dtw_distance_matrix = compute_pairwise_dtw_distance(normalized_close)
        dtw_similarity_matrix = distance_to_similarity(dtw_distance_matrix)
        hybrid_matrix = combine_similarity_matrices(pearson_matrix, dtw_similarity_matrix)

        graph, nodes, edges = build_similarity_graph(
            hybrid_matrix,
            pearson_matrix,
            dtw_similarity_matrix,
            top_k=request.top_k,
            min_similarity=request.min_similarity,
        )
        partition, communities, modularity_score, louvain_method = detect_communities(graph, hybrid_matrix)
        nodes = annotate_nodes_with_communities(nodes, partition)

        top_pearson_pairs = top_pairs_from_matrix(pearson_matrix, score_key="pearson")
        top_dtw_pairs = top_pairs_from_matrix(dtw_similarity_matrix, score_key="dtw_similarity")
        top_hybrid_pairs = top_pairs_from_matrix(
            hybrid_matrix,
            score_key="hybrid_similarity",
            extra_matrices={
                "pearson": pearson_matrix,
                "dtw_similarity": dtw_similarity_matrix,
                "spearman": spearman_matrix,
            },
        )

        rolling_stability, total_windows = compute_rolling_stability(
            aligned_close,
            rolling_window=request.rolling_window,
            rolling_step=request.rolling_step,
            min_similarity=request.min_similarity,
            overall_hybrid_matrix=hybrid_matrix,
        )

        aligned_start = aligned_close.index.min()
        aligned_end = aligned_close.index.max()
        return {
            "symbols": usable_symbols,
            "requested_symbols": symbols,
            "excluded_symbols": excluded_symbols,
            "date_range": {
                "start": request.start_date.isoformat(),
                "end": request.end_date.isoformat(),
                "aligned_start": aligned_start.date().isoformat(),
                "aligned_end": aligned_end.date().isoformat(),
                "timeframe": request.timeframe,
                "rows": int(len(aligned_close)),
            },
            "config": {
                "top_k": request.top_k,
                "min_similarity": request.min_similarity,
                "rolling_window": request.rolling_window,
                "rolling_step": request.rolling_step,
                "max_missing_ratio": request.max_missing_ratio,
                "min_history_rows": request.min_history_rows,
            },
            "matrices": {
                "pearson": matrix_to_serializable(pearson_matrix),
                "spearman": matrix_to_serializable(spearman_matrix),
                "dtw_distance": matrix_to_serializable(dtw_distance_matrix),
                "dtw_similarity": matrix_to_serializable(dtw_similarity_matrix),
                "hybrid_similarity": matrix_to_serializable(hybrid_matrix),
            },
            "top_pairs": top_hybrid_pairs,
            "pair_rankings": {
                "pearson": top_pearson_pairs,
                "dtw": top_dtw_pairs,
                "hybrid": top_hybrid_pairs,
            },
            "graph": {
                "nodes": nodes,
                "edges": edges,
            },
            "communities": communities,
            "metrics": {
                "modularity": modularity_score,
                "community_count": len(communities),
                "edge_count": len(edges),
                "node_count": len(nodes),
                "pair_count": int((len(usable_symbols) * (len(usable_symbols) - 1)) / 2),
                "rolling_window_count": total_windows,
                "louvain_method": louvain_method,
            },
            "rolling_stability": rolling_stability,
            "data_quality": data_quality,
        }


class ExplainCoMovementUseCase:
    def __init__(self, explainer: CoMovementExplainer) -> None:
        self._explainer = explainer

    def execute(self, request: CoMovementExplainInput) -> dict[str, Any]:
        return self._explainer.explain(
            top_pairs=request.top_pairs,
            communities=request.communities,
            metrics=request.metrics,
            language=request.language,
            symbols=request.symbols,
            date_range=request.date_range,
        )


class SaveCoMovementSnapshotUseCase:
    def __init__(self, snapshot_store: CoMovementSnapshotStore) -> None:
        self._snapshot_store = snapshot_store

    def execute(
        self,
        analysis_result: dict[str, Any],
        *,
        snapshot_id: str | None = None,
        label: str = "universe",
    ) -> dict[str, Any]:
        return self._snapshot_store.save_snapshot(
            analysis_result,
            snapshot_id=snapshot_id,
            label=label,
        )


class ListCoMovementSnapshotsUseCase:
    def __init__(self, snapshot_store: CoMovementSnapshotStore) -> None:
        self._snapshot_store = snapshot_store

    def execute(self) -> list[dict[str, Any]]:
        return self._snapshot_store.list_snapshots()


class GetLatestCoMovementSnapshotUseCase:
    def __init__(self, snapshot_store: CoMovementSnapshotStore) -> None:
        self._snapshot_store = snapshot_store

    def execute(self) -> dict[str, Any]:
        return self._snapshot_store.load_latest_summary()


class GetCoMovementSnapshotUseCase:
    def __init__(self, snapshot_store: CoMovementSnapshotStore) -> None:
        self._snapshot_store = snapshot_store

    def execute(self, snapshot_id: str) -> dict[str, Any]:
        return self._snapshot_store.load_summary(snapshot_id)


class GetLatestCoMovementMatrixUseCase:
    def __init__(self, snapshot_store: CoMovementSnapshotStore) -> None:
        self._snapshot_store = snapshot_store

    def execute(self, matrix_name: str, *, symbols: list[str] | None = None) -> dict[str, Any]:
        return self._snapshot_store.load_latest_matrix(matrix_name, symbols=symbols)
