from __future__ import annotations

import json
import logging
from copy import deepcopy
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

from api.modules.ai.domain.models import AiAssetRecord, AiSessionRecord, utc_epoch_seconds

logger = logging.getLogger(__name__)

_SESSION_TTL = 18000  # 5 saat


class InMemoryAiSessionStore:
    def __init__(self) -> None:
        self._records: Dict[str, AiSessionRecord] = {}
        self._lock = Lock()

    def create(self, user_id: str, title: Optional[str] = None) -> AiSessionRecord:
        with self._lock:
            session = AiSessionRecord(
                session_id=f"aisess_{uuid4().hex}",
                user_id=user_id,
                title=title,
            )
            self._records[session.session_id] = session.model_copy(deep=True)
            return session

    def save(self, session: AiSessionRecord) -> None:
        with self._lock:
            self._records[session.session_id] = session.model_copy(deep=True)

    def get(self, session_id: str) -> Optional[AiSessionRecord]:
        with self._lock:
            record = self._records.get(session_id)
            return record.model_copy(deep=True) if record is not None else None


class RedisAiSessionStore:
    """
    AiSessionRecord'ları Redis'te saklayan store.
    InMemoryAiSessionStore ile aynı arayüzü sunar; bağlantı hatalarında
    sessizce None döner.
    """

    def __init__(self, redis: Any) -> None:
        self._redis = redis

    @staticmethod
    def _key(session_id: str) -> str:
        return f"ai:session:{session_id}"

    @staticmethod
    def _serialize(session: AiSessionRecord) -> str:
        return session.model_dump_json()

    @staticmethod
    def _deserialize(raw: str) -> AiSessionRecord:
        return AiSessionRecord.model_validate_json(raw)

    def _run_async(self, coro: Any) -> Any:
        import asyncio

        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            future = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result(timeout=5)
        return loop.run_until_complete(coro)

    def create(self, user_id: str, title: Optional[str] = None) -> AiSessionRecord:
        session = AiSessionRecord(
            session_id=f"aisess_{uuid4().hex}",
            user_id=user_id,
            title=title,
        )
        try:
            self._run_async(
                self._redis.set(self._key(session.session_id), self._serialize(session), ex=_SESSION_TTL)
            )
        except Exception as exc:
            logger.warning("RedisAiSessionStore.create hatası (%s): %s", session.session_id, exc)
        return session

    def save(self, session: AiSessionRecord) -> None:
        try:
            self._run_async(
                self._redis.set(self._key(session.session_id), self._serialize(session), ex=_SESSION_TTL)
            )
        except Exception as exc:
            logger.warning("RedisAiSessionStore.save hatası (%s): %s", session.session_id, exc)

    def get(self, session_id: str) -> Optional[AiSessionRecord]:
        try:
            raw = self._run_async(self._redis.get(self._key(session_id)))
            if raw is None:
                return None
            return self._deserialize(raw)
        except Exception as exc:
            logger.warning("RedisAiSessionStore.get hatası (%s): %s", session_id, exc)
            return None


def create_ai_session_store(redis: Any = None) -> Union[RedisAiSessionStore, InMemoryAiSessionStore]:
    """Redis varsa RedisAiSessionStore, yoksa InMemoryAiSessionStore döner."""
    if redis is not None:
        logger.info("AiSessionStore: Redis kullanılıyor.")
        return RedisAiSessionStore(redis)
    logger.info("AiSessionStore: InMemory kullanılıyor.")
    return InMemoryAiSessionStore()


class AiSessionStoreProxy:
    """
    İnce proxy — startup'ta backing store'u Redis ile değiştirmeye izin verir.
    """

    def __init__(self) -> None:
        self._store: Any = InMemoryAiSessionStore()

    def _set_store(self, store: Any) -> None:
        self._store = store

    def __getattr__(self, name: str) -> Any:
        return getattr(self._store, name)


class JsonFileAiAssetStore:
    def __init__(self, path: Union[str, Path]) -> None:
        self._path = Path(path)
        self._lock = Lock()
        self._memory_payload = {"strategies": [], "rules": [], "indicators": []}
        self._file_storage_enabled = True
        try:
            self._ensure_file()
        except OSError:
            # Some serverless platforms mount the deployment bundle as read-only.
            # Fall back to in-memory storage so API startup still succeeds.
            self._file_storage_enabled = False

    def list_assets(self, user_id: str) -> Dict[str, List[Dict[str, Any]]]:
        payload = self._read()
        return {
            "strategies": [item for item in payload["strategies"] if item.get("user_id") == user_id],
            "rules": [item for item in payload["rules"] if item.get("user_id") == user_id],
            "indicators": [item for item in payload["indicators"] if item.get("user_id") == user_id],
        }

    def save_asset(
        self,
        *,
        user_id: str,
        kind: str,
        title: str,
        description: str,
        prompt: Optional[str],
        spec: Dict[str, Any],
    ) -> Dict[str, Any]:
        record = AiAssetRecord(
            user_id=user_id,
            kind=kind,  # type: ignore[arg-type]
            title=title,
            description=description,
            prompt=prompt,
            spec=deepcopy(spec),
            created_at=utc_epoch_seconds(),
            updated_at=utc_epoch_seconds(),
        )
        with self._lock:
            payload = self._read_unlocked()
            key = {
                "strategy": "strategies",
                "rule": "rules",
                "indicator": "indicators",
            }.get(kind, f"{kind}s")
            payload.setdefault(key, [])
            payload[key].append(record.model_dump(mode="python"))
            self._write_unlocked(payload)
        return record.model_dump(mode="python")

    def _ensure_file(self) -> None:
        if not self._file_storage_enabled:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text(
                json.dumps({"strategies": [], "rules": [], "indicators": []}, ensure_ascii=True, indent=2),
                encoding="utf-8",
            )

    def _read(self) -> Dict[str, Any]:
        with self._lock:
            return self._read_unlocked()

    def _read_unlocked(self) -> Dict[str, Any]:
        if not self._file_storage_enabled:
            return deepcopy(self._memory_payload)
        self._ensure_file()
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"strategies": [], "rules": [], "indicators": []}

    def _write_unlocked(self, payload: Dict[str, Any]) -> None:
        if not self._file_storage_enabled:
            self._memory_payload = deepcopy(payload)
            return

        try:
            self._path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        except OSError:
            self._file_storage_enabled = False
            self._memory_payload = deepcopy(payload)
