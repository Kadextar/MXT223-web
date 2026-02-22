"""Rate limiting for auth and sensitive endpoints."""
import time
from collections import defaultdict
from typing import Tuple

from fastapi import Request, HTTPException

from app.config import (
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    API_RATE_LIMIT_REQUESTS,
    API_RATE_LIMIT_WINDOW_SECONDS,
)
from app.logging_config import logger

# key -> (count, window_start)
_store: dict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0.0))
_api_store: dict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0.0))


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request) -> None:
    """Raise 429 if client exceeded rate limit. Call from login/refresh endpoints."""
    key = f"ratelimit:{_client_key(request)}"
    now = time.monotonic()
    count, window_start = _store[key]
    if now - window_start >= RATE_LIMIT_WINDOW_SECONDS:
        _store[key] = (1, now)
        return
    if count >= RATE_LIMIT_REQUESTS:
        logger.warning("Rate limit exceeded for %s", key)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again later.",
        )
    _store[key] = (count + 1, window_start)


def check_api_rate_limit(request: Request) -> None:
    """Global rate limit for all /api/* endpoints. Raise 429 if exceeded."""
    path = request.scope.get("path") or ""
    if not path.startswith("/api"):
        return
    key = f"api:{_client_key(request)}"
    now = time.monotonic()
    count, window_start = _api_store[key]
    if now - window_start >= API_RATE_LIMIT_WINDOW_SECONDS:
        _api_store[key] = (1, now)
        return
    if count >= API_RATE_LIMIT_REQUESTS:
        logger.warning("API rate limit exceeded for %s", key)
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    _api_store[key] = (count + 1, window_start)


# Per-user rate limit (for change-password, admin actions)
_user_store: dict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0.0))
USER_RATE_LIMIT = 5
USER_RATE_WINDOW = 60


def check_rate_limit_user(user_id: str) -> None:
    """Raise 429 if user exceeded per-user limit (e.g. change password)."""
    key = f"user_ratelimit:{user_id}"
    now = time.monotonic()
    count, window_start = _user_store[key]
    if now - window_start >= USER_RATE_WINDOW:
        _user_store[key] = (1, now)
        return
    if count >= USER_RATE_LIMIT:
        logger.warning("User rate limit exceeded for %s", user_id)
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    _user_store[key] = (count + 1, window_start)
