from __future__ import annotations

from copy import deepcopy
from threading import Lock
from typing import Dict, List,  Union, Optional, Optional

from api.modules.backtests.domain.models import BacktestRunRecord


class InMemoryRunStore:
    def __init__(self) -> None:
        self._records: Dict[str, BacktestRunRecord] = {}
        self._lock = Lock()

    def save(self, record: BacktestRunRecord) -> None:
        with self._lock:
            self._records[record.run_id] = deepcopy(record)

    def update(self, run_id: str, **changes: object) -> Optional[BacktestRunRecord]:
        with self._lock:
            record = self._records.get(run_id)
            if record is None:
                return None

            for key, value in changes.items():
                if hasattr(record, key):
                    setattr(record, key, deepcopy(value))

            self._records[run_id] = record
            return deepcopy(record)

    def get(self, run_id: str) -> Optional[BacktestRunRecord]:
        with self._lock:
            record = self._records.get(run_id)
            return deepcopy(record) if record is not None else None
