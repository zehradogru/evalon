"""
Redis bağlantı yönetimi.

Kullanım:
    from api.infrastructure.redis_client import get_redis, init_redis, close_redis

Startup'ta init_redis() çağrılır. get_redis() ya aktif AsyncRedis örneği ya da
None döner — None dönünce çağıran kod in-memory fallback'e devam etmeli.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# redis paketi isteğe bağlı; kurulu değilse None olarak tutulur.
try:
    import redis.asyncio as aioredis  # type: ignore
    from redis.asyncio import Redis as AsyncRedis  # type: ignore

    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None  # type: ignore
    AsyncRedis = None  # type: ignore
    _REDIS_AVAILABLE = False

_redis_instance: Optional[object] = None  # AsyncRedis | None


async def init_redis() -> Optional[object]:
    """
    REDIS_URL env var'ından Redis bağlantısı kur.
    Başarılıysa AsyncRedis örneği döner; herhangi bir hata durumunda None döner.
    """
    global _redis_instance

    if not _REDIS_AVAILABLE:
        logger.warning("redis paketi kurulu değil — in-memory store'lar kullanılacak.")
        return None

    url = (os.environ.get("REDIS_URL") or "").strip()
    if not url:
        logger.info("REDIS_URL env var bulunamadı — in-memory store'lar kullanılacak.")
        return None

    try:
        client = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        await client.ping()
        _redis_instance = client
        logger.info("Redis bağlantısı kuruldu: %s", _redact_url(url))
        return _redis_instance
    except Exception as exc:
        logger.warning("Redis bağlantısı başarısız (%s) — in-memory store'lara devam ediliyor.", exc)
        _redis_instance = None
        return None


async def close_redis() -> None:
    """Uygulama kapanırken bağlantıyı temiz kapat."""
    global _redis_instance
    if _redis_instance is not None:
        try:
            await _redis_instance.aclose()  # type: ignore[union-attr]
        except Exception:
            pass
        _redis_instance = None


def get_redis() -> Optional[object]:
    """Mevcut AsyncRedis örneğini döner; bağlı değilse None."""
    return _redis_instance


def is_redis_connected() -> bool:
    return _redis_instance is not None


def _redact_url(url: str) -> str:
    """Loglara yazılacak URL'den parolayı gizler."""
    try:
        from urllib.parse import urlparse, urlunparse

        parsed = urlparse(url)
        if parsed.password:
            netloc = f"{parsed.hostname}:{parsed.port}" if parsed.port else (parsed.hostname or "")
            redacted = parsed._replace(netloc=netloc)
            return urlunparse(redacted)
    except Exception:
        pass
    return url
