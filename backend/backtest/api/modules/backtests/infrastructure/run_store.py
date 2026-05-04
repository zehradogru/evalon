from __future__ import annotations

import dataclasses
import json
import logging
from copy import deepcopy
from threading import Lock
from typing import Any, Dict, List, Optional, Union

from api.modules.backtests.domain.models import BacktestRunRecord

logger = logging.getLogger(__name__)

_BACKTEST_TTL = 7200  # 2 saat


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


class RedisRunStore:
    """
    BacktestRunRecord'ları Redis'te saklayan store.
    InMemoryRunStore ile aynı arayüzü sunar; bağlantı hatalarında
    sessizce None döner (çağıran kod yeniden deneyebilir).
    """

    def __init__(self, redis: Any) -> None:
        self._redis = redis

    @staticmethod
    def _key(run_id: str) -> str:
        return f"backtest:run:{run_id}"

    @staticmethod
    def _serialize(record: BacktestRunRecord) -> str:
        return json.dumps(dataclasses.asdict(record))

    @staticmethod
    def _deserialize(raw: str) -> BacktestRunRecord:
        data = json.loads(raw)
        return BacktestRunRecord(**data)

    def save(self, record: BacktestRunRecord) -> None:
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                future = asyncio.run_coroutine_threadsafe(
                    self._redis.set(self._key(record.run_id), self._serialize(record), ex=_BACKTEST_TTL),
                    loop,
                )
                future.result(timeout=5)
            else:
                loop.run_until_complete(
                    self._redis.set(self._key(record.run_id), self._serialize(record), ex=_BACKTEST_TTL)
                )
        except Exception as exc:
            logger.warning("RedisRunStore.save hatası (%s): %s", record.run_id, exc)

    def update(self, run_id: str, **changes: object) -> Optional[BacktestRunRecord]:
        record = self.get(run_id)
        if record is None:
            return None
        for key, value in changes.items():
            if hasattr(record, key):
                setattr(record, key, deepcopy(value))
        self.save(record)
        return deepcopy(record)

    def get(self, run_id: str) -> Optional[BacktestRunRecord]:
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                future = asyncio.run_coroutine_threadsafe(
                    self._redis.get(self._key(run_id)),
                    loop,
                )
                raw = future.result(timeout=5)
            else:
                raw = loop.run_until_complete(self._redis.get(self._key(run_id)))
            if raw is None:
                return None
            return self._deserialize(raw)
        except Exception as exc:
            logger.warning("RedisRunStore.get hatası (%s): %s", run_id, exc)
            return None


def create_run_store(redis: Any = None) -> Union[RedisRunStore, InMemoryRunStore]:
    """Redis varsa RedisRunStore, yoksa InMemoryRunStore döner."""
    if redis is not None:
        logger.info("BacktestRunStore: Redis kullanılıyor.")
        return RedisRunStore(redis)
    logger.info("BacktestRunStore: InMemory kullanılıyor.")
    return InMemoryRunStore()


class RunStoreProxy:
    """
    İnce proxy — startup'ta backing store'u Redis ile değiştirmeye izin verir.
    Router closure'ları proxy referansını yakalar; _set_store() çağrıldığında
    tüm sonraki çağrılar yeni store'a yönlendirilir.
    """

    def __init__(self) -> None:
        self._store: Any = InMemoryRunStore()

    def _set_store(self, store: Any) -> None:
        self._store = store

    def __getattr__(self, name: str) -> Any:
        return getattr(self._store, name)
