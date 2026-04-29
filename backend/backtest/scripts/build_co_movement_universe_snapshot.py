from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path
import sys

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and persist a co-movement snapshot for the full BIST universe.")
    parser.add_argument("--lookback-days", type=int, default=365, help="How many calendar days to analyze from the latest available date.")
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--min-similarity", type=float, default=0.60)
    parser.add_argument("--rolling-window", type=int, default=90)
    parser.add_argument("--rolling-step", type=int, default=20)
    parser.add_argument("--max-missing-ratio", type=float, default=0.15)
    parser.add_argument("--min-history-rows", type=int, default=180)
    parser.add_argument("--label", type=str, default="universe")
    parser.add_argument("--snapshot-id", type=str, default="")
    return parser.parse_args()


def main() -> None:
    load_dotenv(PROJECT_ROOT / ".env")

    from api.main import _resolve_co_movement_store_path, client
    from api.modules.co_movement.application.use_cases import AnalyzeCoMovementUseCase, SaveCoMovementSnapshotUseCase
    from api.modules.co_movement.domain.models import CoMovementAnalyzeInput
    from api.modules.co_movement.infrastructure.market_data import CoMovementMarketDataGateway
    from api.modules.co_movement.infrastructure.snapshot_store import CoMovementSnapshotStore

    args = parse_args()

    data_gateway = CoMovementMarketDataGateway(client)
    date_range = data_gateway.get_available_date_range()
    all_symbols = data_gateway.list_available_symbols()

    latest_date = date.fromisoformat(date_range["end"])
    start_date = latest_date - timedelta(days=max(30, args.lookback_days))
    store_path = _resolve_co_movement_store_path()

    print("universe_symbols=", len(all_symbols))
    print("available_date_range=", date_range)
    print("analysis_window=", {"start": start_date.isoformat(), "end": latest_date.isoformat()})
    print("snapshot_store=", str(store_path))
    print("phase=analyze")

    analyze_use_case = AnalyzeCoMovementUseCase(data_gateway)
    snapshot_store = CoMovementSnapshotStore(store_path)
    save_use_case = SaveCoMovementSnapshotUseCase(snapshot_store)

    result = analyze_use_case.execute(
        CoMovementAnalyzeInput(
            symbols=all_symbols,
            start_date=start_date,
            end_date=latest_date,
            top_k=args.top_k,
            min_similarity=args.min_similarity,
            rolling_window=args.rolling_window,
            rolling_step=args.rolling_step,
            max_missing_ratio=args.max_missing_ratio,
            min_history_rows=args.min_history_rows,
        )
    )
    print("phase=save")

    metadata = save_use_case.execute(
        result,
        snapshot_id=args.snapshot_id or None,
        label=args.label,
    )

    print("snapshot_id=", metadata["snapshot_id"])
    print("created_at=", metadata["created_at"])
    print("symbol_count=", metadata["symbol_count"])
    print("edge_count=", metadata["edge_count"])
    print("community_count=", metadata["community_count"])
    print("date_range=", metadata["date_range"])


if __name__ == "__main__":
    main()
