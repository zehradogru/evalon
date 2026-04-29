from __future__ import annotations

from collections import defaultdict
from itertools import combinations
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd
from networkx.algorithms.community.quality import modularity

try:
    from dtaidistance import dtw as dtaidistance_dtw
except Exception:  # pragma: no cover - optional dependency
    dtaidistance_dtw = None

try:
    import community as community_louvain
except Exception:  # pragma: no cover - optional dependency
    community_louvain = None


def normalize_symbols(symbols: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for symbol in symbols:
        value = str(symbol or "").strip().upper()
        if value.endswith(".IS"):
            value = value[:-3]
        value = "".join(char for char in value if char.isalnum() or char == "_")
        if value and value not in seen:
            normalized.append(value)
            seen.add(value)

    return normalized


def align_price_frames(
    frames: dict[str, pd.DataFrame],
    *,
    max_missing_ratio: float,
    min_history_rows: int,
) -> tuple[pd.DataFrame, list[dict[str, Any]], list[dict[str, Any]]]:
    cleaned_series: dict[str, pd.Series] = {}
    excluded: list[dict[str, Any]] = []

    for symbol, frame in frames.items():
        if frame is None or frame.empty or "close" not in frame.columns:
            excluded.append({"symbol": symbol, "reason": "no_price_data"})
            continue

        series = pd.to_numeric(frame["close"], errors="coerce").dropna()
        if series.empty:
            excluded.append({"symbol": symbol, "reason": "no_valid_close_values"})
            continue

        ordered = series.sort_index()
        ordered = ordered[~ordered.index.duplicated(keep="last")]
        if len(ordered) < min_history_rows:
            excluded.append(
                {
                    "symbol": symbol,
                    "reason": "insufficient_history",
                    "rows": int(len(ordered)),
                    "required_rows": min_history_rows,
                }
            )
            continue

        cleaned_series[symbol] = ordered

    if len(cleaned_series) < 2:
        raise ValueError("Analiz icin en az 2 hisse ve gecerli fiyat serisi gerekli.")

    common_start = max(series.index.min() for series in cleaned_series.values())
    common_end = min(series.index.max() for series in cleaned_series.values())
    if common_start >= common_end:
        raise ValueError("Secilen hisseler icin ortak tarih araligi bulunamadi.")

    trimmed = {
        symbol: series[(series.index >= common_start) & (series.index <= common_end)]
        for symbol, series in cleaned_series.items()
    }
    aligned_index = pd.Index(sorted(set().union(*(series.index for series in trimmed.values()))), name="date")
    raw_matrix = pd.concat(
        [trimmed[symbol].reindex(aligned_index).rename(symbol) for symbol in trimmed],
        axis=1,
    )

    retained_symbols: list[str] = []
    for symbol in raw_matrix.columns:
        missing_ratio = float(raw_matrix[symbol].isna().mean())
        present_rows = int(raw_matrix[symbol].notna().sum())
        if present_rows < 2:
            excluded.append(
                {
                    "symbol": symbol,
                    "reason": "insufficient_history_after_alignment",
                    "rows": present_rows,
                }
            )
            continue
        if missing_ratio > max_missing_ratio:
            excluded.append(
                {
                    "symbol": symbol,
                    "reason": "too_many_missing_values",
                    "missing_ratio": round(missing_ratio, 6),
                }
            )
            continue
        retained_symbols.append(symbol)

    if len(retained_symbols) < 2:
        raise ValueError("Eksik veri filtresinden sonra analiz icin yeterli hisse kalmadi.")

    common_start = max(trimmed[symbol].index.min() for symbol in retained_symbols)
    common_end = min(trimmed[symbol].index.max() for symbol in retained_symbols)
    if common_start >= common_end:
        raise ValueError("Filtreleme sonrasi ortak tarih araligi kalmadi.")

    final_trimmed = {
        symbol: cleaned_series[symbol][(cleaned_series[symbol].index >= common_start) & (cleaned_series[symbol].index <= common_end)]
        for symbol in retained_symbols
    }
    final_index = pd.Index(sorted(set().union(*(series.index for series in final_trimmed.values()))), name="date")
    aligned_columns: dict[str, pd.Series] = {}
    quality: list[dict[str, Any]] = []

    for symbol, series in final_trimmed.items():
        raw_series = series.reindex(final_index)
        missing_before_fill = int(raw_series.isna().sum())
        missing_ratio = float(raw_series.isna().mean())
        filled = raw_series.ffill().bfill()
        if filled.isna().any():
            excluded.append({"symbol": symbol, "reason": "unable_to_fill_missing_values"})
            continue

        aligned_columns[symbol] = filled.astype(float)
        quality.append(
            {
                "symbol": symbol,
                "rows": int(len(final_index)),
                "observed_rows": int(raw_series.notna().sum()),
                "filled_rows": missing_before_fill,
                "missing_ratio": round(missing_ratio, 6),
            }
        )

    aligned = pd.concat(aligned_columns, axis=1) if aligned_columns else pd.DataFrame(index=final_index)

    if aligned.shape[1] < 2:
        raise ValueError("Veri doldurma sonrasi analiz icin yeterli hisse kalmadi.")

    return aligned.sort_index(), excluded, quality


def compute_log_returns(close_matrix: pd.DataFrame) -> pd.DataFrame:
    positive_close = close_matrix.where(close_matrix > 0)
    returns = np.log(positive_close / positive_close.shift(1))
    returns = returns.replace([np.inf, -np.inf], np.nan).dropna(how="all")
    return returns


def compute_correlation_matrix(log_returns: pd.DataFrame, method: str) -> pd.DataFrame:
    if log_returns.empty:
        raise ValueError("Korelasyon hesaplamak icin yeterli return verisi yok.")

    matrix = log_returns.corr(method=method).fillna(0.0).copy()
    _set_diagonal(matrix, 1.0)
    return matrix


def compute_normalized_close(close_matrix: pd.DataFrame) -> pd.DataFrame:
    baseline = close_matrix.iloc[0].replace(0, np.nan)
    normalized = close_matrix.divide(baseline).subtract(1.0)
    normalized = normalized.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0.0)
    return normalized


def compute_pairwise_dtw_distance(normalized_close: pd.DataFrame) -> pd.DataFrame:
    symbols = list(normalized_close.columns)
    size = len(symbols)
    arrays = {
        symbol: normalized_close[symbol].astype(float).to_numpy()
        for symbol in symbols
    }

    if dtaidistance_dtw is not None and size >= 8:
        distance_array = dtaidistance_dtw.distance_matrix_fast(
            [arrays[symbol] for symbol in symbols],
            compact=False,
            parallel=True,
            only_triu=False,
            use_pruning=True,
        )
        matrix = pd.DataFrame(distance_array, index=symbols, columns=symbols)
        _set_diagonal(matrix, 0.0)
        return matrix

    matrix = pd.DataFrame(np.zeros((size, size), dtype=float), index=symbols, columns=symbols)

    for left_index, left_symbol in enumerate(symbols):
        for right_index in range(left_index + 1, size):
            right_symbol = symbols[right_index]
            distance = _dtw_distance(arrays[left_symbol], arrays[right_symbol])
            matrix.iat[left_index, right_index] = distance
            matrix.iat[right_index, left_index] = distance

    return matrix


def _dtw_distance(left: np.ndarray, right: np.ndarray) -> float:
    if dtaidistance_dtw is not None:
        return float(dtaidistance_dtw.distance_fast(left, right, use_pruning=True))
    return _dtw_distance_fallback(left, right)


def _dtw_distance_fallback(left: np.ndarray, right: np.ndarray) -> float:
    previous = np.full(len(right) + 1, np.inf, dtype=float)
    previous[0] = 0.0

    for left_value in left:
        current = np.full(len(right) + 1, np.inf, dtype=float)
        for idx, right_value in enumerate(right, start=1):
            cost = abs(float(left_value) - float(right_value))
            current[idx] = cost + min(
                current[idx - 1],
                previous[idx],
                previous[idx - 1],
            )
        previous = current

    return float(previous[-1])


def distance_to_similarity(distance_matrix: pd.DataFrame) -> pd.DataFrame:
    if distance_matrix.empty:
        return distance_matrix

    similarity = pd.DataFrame(
        np.ones(distance_matrix.shape, dtype=float),
        index=distance_matrix.index,
        columns=distance_matrix.columns,
    )

    off_diagonal: list[float] = []
    for row_index, row_symbol in enumerate(distance_matrix.index):
        for column_index in range(row_index + 1, len(distance_matrix.columns)):
            column_symbol = distance_matrix.columns[column_index]
            off_diagonal.append(float(distance_matrix.loc[row_symbol, column_symbol]))

    max_distance = max(off_diagonal) if off_diagonal else 0.0
    if max_distance <= 0:
        _set_diagonal(similarity, 1.0)
        return similarity

    normalized_distance = distance_matrix / max_distance
    similarity = (1.0 - normalized_distance).clip(lower=0.0, upper=1.0).copy()
    _set_diagonal(similarity, 1.0)
    return similarity


def combine_similarity_matrices(
    pearson_matrix: pd.DataFrame,
    dtw_similarity_matrix: pd.DataFrame,
) -> pd.DataFrame:
    pearson_similarity = pearson_matrix.clip(lower=0.0)
    hybrid = ((0.5 * pearson_similarity) + (0.5 * dtw_similarity_matrix)).copy()
    _set_diagonal(hybrid, 1.0)
    return hybrid


def matrix_to_serializable(matrix: pd.DataFrame) -> dict[str, dict[str, float | None]]:
    payload: dict[str, dict[str, float | None]] = {}
    for row_symbol in matrix.index:
        payload[row_symbol] = {}
        for column_symbol in matrix.columns:
            value = matrix.loc[row_symbol, column_symbol]
            payload[row_symbol][column_symbol] = None if pd.isna(value) else round(float(value), 6)
    return payload


def top_pairs_from_matrix(
    matrix: pd.DataFrame,
    *,
    score_key: str,
    extra_matrices: dict[str, pd.DataFrame] | None = None,
) -> list[dict[str, Any]]:
    extra_matrices = extra_matrices or {}
    pairs: list[dict[str, Any]] = []
    symbols = list(matrix.columns)

    for left_index, left_symbol in enumerate(symbols):
        for right_index in range(left_index + 1, len(symbols)):
            right_symbol = symbols[right_index]
            score = matrix.iat[left_index, right_index]
            if pd.isna(score):
                continue

            entry: dict[str, Any] = {
                "source": left_symbol,
                "target": right_symbol,
                score_key: round(float(score), 6),
            }
            for key, extra_matrix in extra_matrices.items():
                value = extra_matrix.loc[left_symbol, right_symbol]
                entry[key] = round(float(value), 6)
            pairs.append(entry)

    pairs.sort(key=lambda item: item[score_key], reverse=True)
    return pairs


def build_similarity_graph(
    hybrid_matrix: pd.DataFrame,
    pearson_matrix: pd.DataFrame,
    dtw_similarity_matrix: pd.DataFrame,
    *,
    top_k: int,
    min_similarity: float,
) -> tuple[nx.Graph, list[dict[str, Any]], list[dict[str, Any]]]:
    graph = nx.Graph()
    symbols = list(hybrid_matrix.columns)
    for symbol in symbols:
        graph.add_node(symbol)

    edge_map: dict[tuple[str, str], dict[str, Any]] = {}
    for source in symbols:
        ranked = hybrid_matrix.loc[source].drop(labels=[source]).sort_values(ascending=False)
        selected = ranked[ranked >= min_similarity].head(top_k)
        for target, weight in selected.items():
            pair_key = tuple(sorted((source, target)))
            edge_map[pair_key] = {
                "source": pair_key[0],
                "target": pair_key[1],
                "weight": round(float(weight), 6),
                "pearson": round(float(pearson_matrix.loc[source, target]), 6),
                "dtw_similarity": round(float(dtw_similarity_matrix.loc[source, target]), 6),
            }

    edges = sorted(edge_map.values(), key=lambda item: (-item["weight"], item["source"], item["target"]))
    for edge in edges:
        graph.add_edge(
            edge["source"],
            edge["target"],
            weight=edge["weight"],
            pearson=edge["pearson"],
            dtw_similarity=edge["dtw_similarity"],
        )

    nodes = [{"id": symbol, "label": symbol} for symbol in symbols]
    return graph, nodes, edges


def detect_communities(
    graph: nx.Graph,
    hybrid_matrix: pd.DataFrame,
) -> tuple[dict[str, int], list[dict[str, Any]], float, str]:
    if graph.number_of_nodes() == 0:
        return {}, [], 0.0, "empty"

    if graph.number_of_edges() == 0:
        partition = {node: index for index, node in enumerate(sorted(graph.nodes))}
        communities = _communities_from_partition(partition, hybrid_matrix)
        return partition, communities, 0.0, "singleton"

    method = "python-louvain"
    if community_louvain is not None:
        partition = community_louvain.best_partition(graph, weight="weight", random_state=42)
    else:  # pragma: no cover - depends on runtime package set
        method = "networkx-louvain"
        louvain_groups = nx.algorithms.community.louvain_communities(graph, weight="weight", seed=42)
        partition = {
            node: community_id
            for community_id, members in enumerate(louvain_groups)
            for node in sorted(members)
        }

    communities = _communities_from_partition(partition, hybrid_matrix)
    grouped = [set(community["stocks"]) for community in communities if community["stocks"]]
    modularity_score = 0.0
    if graph.number_of_edges() > 0 and grouped:
        try:
            modularity_score = float(modularity(graph, grouped, weight="weight"))
        except Exception:
            modularity_score = 0.0

    return partition, communities, round(modularity_score, 6), method


def _communities_from_partition(
    partition: dict[str, int],
    hybrid_matrix: pd.DataFrame,
) -> list[dict[str, Any]]:
    grouped: dict[int, list[str]] = defaultdict(list)
    for symbol, community_id in partition.items():
        grouped[int(community_id)].append(symbol)

    communities: list[dict[str, Any]] = []
    for community_id in sorted(grouped):
        stocks = sorted(grouped[community_id])
        communities.append(
            {
                "community_id": community_id,
                "stocks": stocks,
                "size": len(stocks),
                "avg_similarity": round(_average_group_similarity(hybrid_matrix, stocks), 6),
            }
        )

    communities.sort(key=lambda item: (-item["size"], item["community_id"]))
    return communities


def _average_group_similarity(hybrid_matrix: pd.DataFrame, stocks: list[str]) -> float:
    if len(stocks) < 2:
        return 0.0

    values = [
        float(hybrid_matrix.loc[left_symbol, right_symbol])
        for left_symbol, right_symbol in combinations(stocks, 2)
    ]
    if not values:
        return 0.0
    return float(np.mean(values))


def _set_diagonal(matrix: pd.DataFrame, value: float) -> None:
    for index in range(min(len(matrix.index), len(matrix.columns))):
        matrix.iat[index, index] = value


def annotate_nodes_with_communities(
    nodes: list[dict[str, Any]],
    partition: dict[str, int],
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for node in nodes:
        community_id = partition.get(node["id"], -1)
        enriched.append({**node, "community_id": community_id})
    return enriched


def compute_rolling_stability(
    close_matrix: pd.DataFrame,
    *,
    rolling_window: int,
    rolling_step: int,
    min_similarity: float,
    overall_hybrid_matrix: pd.DataFrame,
) -> tuple[list[dict[str, Any]], int]:
    if close_matrix.shape[1] < 2:
        return [], 0

    windows = _build_windows(len(close_matrix), rolling_window, rolling_step)
    if not windows:
        return [], 0

    pair_keys = [
        (left_symbol, right_symbol)
        for left_symbol, right_symbol in combinations(close_matrix.columns, 2)
    ]
    strong_counts = {pair: 0 for pair in pair_keys}

    for start_index, end_index in windows:
        window_close = close_matrix.iloc[start_index:end_index]
        if window_close.shape[0] < 2:
            continue

        window_returns = compute_log_returns(window_close)
        if window_returns.empty:
            continue

        pearson = compute_correlation_matrix(window_returns, "pearson")
        normalized_close = compute_normalized_close(window_close)
        dtw_distance = compute_pairwise_dtw_distance(normalized_close)
        dtw_similarity = distance_to_similarity(dtw_distance)
        hybrid = combine_similarity_matrices(pearson, dtw_similarity)

        for pair in pair_keys:
            score = float(hybrid.loc[pair[0], pair[1]])
            if score >= min_similarity:
                strong_counts[pair] += 1

    total_windows = len(windows)
    stability_rows: list[dict[str, Any]] = []
    for source, target in pair_keys:
        strong_windows = strong_counts[(source, target)]
        stability = (strong_windows / total_windows) if total_windows else 0.0
        stability_rows.append(
            {
                "pair": f"{source}-{target}",
                "source": source,
                "target": target,
                "stability": round(float(stability), 6),
                "strong_windows": strong_windows,
                "total_windows": total_windows,
                "hybrid_similarity": round(float(overall_hybrid_matrix.loc[source, target]), 6),
            }
        )

    stability_rows.sort(
        key=lambda item: (
            -item["stability"],
            -item["strong_windows"],
            -item["hybrid_similarity"],
            item["pair"],
        )
    )
    return stability_rows, total_windows


def _build_windows(length: int, window: int, step: int) -> list[tuple[int, int]]:
    if length <= 1:
        return []

    if length <= window:
        return [(0, length)]

    starts = list(range(0, length - window + 1, step))
    final_start = length - window
    if not starts or starts[-1] != final_start:
        starts.append(final_start)

    return [(start_index, start_index + window) for start_index in starts]
