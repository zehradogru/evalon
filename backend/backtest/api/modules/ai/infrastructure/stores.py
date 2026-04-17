from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from threading import Lock
from typing import Dict, List,  Union, Optional, Any
from uuid import uuid4

from api.modules.ai.domain.models import AiAssetRecord, AiSessionRecord, utc_epoch_seconds


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
