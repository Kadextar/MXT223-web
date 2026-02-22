"""
Caching utilities for API endpoints. TTL from app.config.CACHE_TTL_SECONDS.
Optional: if REDIS_URL is set, use Redis for cache; else in-memory TTLCache.
"""
import hashlib
import json
from functools import wraps
from typing import Callable, Any

from cachetools import TTLCache

# Lazy init
schedule_cache: Any = None


def _get_cache() -> Any:
    global schedule_cache
    if schedule_cache is not None:
        return schedule_cache
    from app.config import CACHE_TTL_SECONDS, REDIS_URL
    if REDIS_URL:
        try:
            import redis.asyncio as redis_async  # type: ignore
            schedule_cache = _RedisCache(REDIS_URL, ttl=CACHE_TTL_SECONDS)
        except Exception:
            schedule_cache = TTLCache(maxsize=100, ttl=CACHE_TTL_SECONDS)
    else:
        schedule_cache = TTLCache(maxsize=100, ttl=CACHE_TTL_SECONDS)
    return schedule_cache


class _RedisCache:
    """In-memory–like cache backed by Redis (sync interface for use inside async cached wrapper)."""
    _prefix = "mxt223:cache:"

    def __init__(self, url: str, ttl: int = 300):
        import redis
        self._client = redis.from_url(url, decode_responses=True)
        self.maxsize = 100
        self.ttl = ttl
        self.currsize = 0  # Not tracked for Redis

    def __contains__(self, key: str) -> bool:
        return self._client.exists(self._prefix + key) > 0

    def __getitem__(self, key: str) -> Any:
        import json as _json
        raw = self._client.get(self._prefix + key)
        if raw is None:
            raise KeyError(key)
        return _json.loads(raw)

    def __setitem__(self, key: str, value: Any) -> None:
        import json as _json
        k = self._prefix + key
        self._client.setex(k, self.ttl, _json.dumps(value, default=str))

    def clear(self) -> None:
        for k in self._client.scan_iter(match=self._prefix + "*"):
            self._client.delete(k)


def cache_key(*args, **kwargs) -> str:
    """
    Generate a cache key from function arguments
    
    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments
        
    Returns:
        MD5 hash of serialized arguments
    """
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(ttl: int = None):
    """
    Decorator for caching async function results. Uses CACHE_TTL_SECONDS if ttl not given.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = _get_cache()
            key = f"{func.__name__}:{cache_key(*args, **kwargs)}"
            if key in cache:
                return cache[key]
            result = await func(*args, **kwargs)
            cache[key] = result
            return result

        def clear_cache_fn():
            _get_cache().clear()

        def cache_info_fn():
            c = _get_cache()
            return {"size": len(c), "maxsize": c.maxsize, "ttl": c.ttl}

        wrapper.clear_cache = clear_cache_fn
        wrapper.cache_info = cache_info_fn
        return wrapper
    return decorator


def clear_cache():
    """Clear all cached data."""
    _get_cache().clear()


def get_cache_stats() -> dict:
    """Return cache statistics."""
    c = _get_cache()
    return {
        "size": len(c),
        "maxsize": c.maxsize,
        "ttl": c.ttl,
        "currsize": c.currsize,
    }
