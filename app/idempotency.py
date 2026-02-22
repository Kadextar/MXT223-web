"""Idempotency: same Idempotency-Key = same response, no duplicate execution."""
import time
from typing import Any, Optional

from fastapi import Header, HTTPException, Request

# key -> (status_code, response_body, expiry_time)
_store: dict[str, tuple[int, Any, float]] = {}
TTL = 24 * 3600  # 24 hours


def check_idempotency(
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Optional[str]:
    """Return cached response key if key was already used. Otherwise return key for storing."""
    if not idempotency_key or len(idempotency_key) > 128:
        return None
    key = f"idem:{idempotency_key}"
    now = time.time()
    if key in _store:
        status, body, expiry = _store[key]
        if now < expiry:
            return key  # Caller should return cached (status, body)
        del _store[key]
    return key


def set_idempotent_result(key: str, status_code: int, body: Any) -> None:
    """Store result for idempotency key."""
    _store[key] = (status_code, body, time.time() + TTL)


def get_idempotent_result(key: str) -> Optional[tuple[int, Any]]:
    """Return (status_code, body) if key exists and not expired."""
    if key not in _store:
        return None
    status, body, expiry = _store[key]
    if time.time() >= expiry:
        del _store[key]
        return None
    return (status, body)
