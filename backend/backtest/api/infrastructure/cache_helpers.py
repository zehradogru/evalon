"""
Redis cache yardımcı fonksiyonları.

Kullanım:
    from api.infrastructure.cache_helpers import cached_query, make_cache_key

    result = await cached_query(
        redis=get_redis(),
        cache_key="prices:THYAO:1h:100",
        ttl=3600,
        fetch_fn=lambda: fetch_from_oracle(),
    )
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


async def cached_query(
    redis: Optional[object],
    cache_key: str,
    ttl: int,
    fetch_fn: Callable[[], Any],
) -> Any:
    """
    Redis'te cache_key varsa deserialize edip döner.
    Yoksa fetch_fn() çağırır, sonucu serialize edip Redis'e yazar ve döner.
    redis=None ise her seferinde fetch_fn() çağrılır (graceful degradation).
    """
    if redis is None:
        return await _maybe_await(fetch_fn())

    try:
        raw = await redis.get(cache_key)  # type: ignore[union-attr]
        if raw is not None:
            logger.debug("Cache HIT: %s", cache_key)
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis GET hatası (%s): %s — DB'ye düşülüyor.", cache_key, exc)

    result = await _maybe_await(fetch_fn())

    try:
        await redis.set(cache_key, json.dumps(result, default=_json_default), ex=ttl)  # type: ignore[union-attr]
        logger.debug("Cache MISS → yazıldı: %s (TTL=%ds)", cache_key, ttl)
    except Exception as exc:
        logger.warning("Redis SET hatası (%s): %s", cache_key, exc)

    return result


async def invalidate(redis: Optional[object], cache_key: str) -> None:
    """Belirtilen anahtarı Redis'ten sil."""
    if redis is None:
        return
    try:
        await redis.delete(cache_key)  # type: ignore[union-attr]
    except Exception as exc:
        logger.warning("Redis DELETE hatası (%s): %s", cache_key, exc)


def make_cache_key(*parts: Any) -> str:
    """Birden fazla parçayı ':' ile birleştirerek cache anahtarı üretir."""
    return ":".join(str(p) for p in parts)


def hash_params(params: Any) -> str:
    """Dict/list gibi yapıları deterministik bir MD5 hash'e çevirir."""
    serialized = json.dumps(params, sort_keys=True, default=str)
    return hashlib.md5(serialized.encode()).hexdigest()  # noqa: S324 (non-crypto use)


async def _maybe_await(value: Any) -> Any:
    """Coroutine ise await et, değilse doğrudan döndür."""
    import asyncio

    if asyncio.iscoroutine(value):
        return await value
    return value


def _json_default(obj: Any) -> Any:
    """json.dumps için özel tip serileştirici."""
    import datetime

    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    raise TypeError(f"Serileştirilemeyen tip: {type(obj)}")
