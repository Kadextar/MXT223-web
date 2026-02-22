"""Security and observability middleware."""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, RedirectResponse

from app.logging_config import logger
from app.config import IS_PRODUCTION

# Security headers to add to every response (including static)
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # CSP: allow self, CDN for fonts and FontAwesome; inline scripts in HTML allowed
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    ),
}

# HSTS in production only
HSTS_HEADER = "max-age=31536000; includeSubDomains; preload" if IS_PRODUCTION else None

# Paths to skip request logging (noise)
LOG_SKIP_PREFIXES = ("/static/", "/health/live", "/favicon")


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """In production, redirect HTTP to HTTPS (X-Forwarded-Proto aware)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if not IS_PRODUCTION:
            return await call_next(request)
        proto = request.headers.get("X-Forwarded-Proto", request.url.scheme)
        if proto and proto.lower() == "https":
            return await call_next(request)
        url = request.url.replace(scheme="https", netloc=request.url.netloc)
        return RedirectResponse(url=url, status_code=301)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security-related headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        if HSTS_HEADER:
            response.headers["Strict-Transport-Security"] = HSTS_HEADER
        return response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID to request state and response for tracing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class ApiRateLimitMiddleware(BaseHTTPMiddleware):
    """Apply global rate limit to all /api/* requests. Returns 429 if exceeded."""

    async def dispatch(self, request: Request, call_next) -> Response:
        from app.rate_limit import check_api_rate_limit
        from fastapi import HTTPException
        try:
            check_api_rate_limit(request)
        except HTTPException as e:
            return Response(
                content='{"detail":"Too many requests. Try again later.","code":429}',
                status_code=429,
                media_type="application/json",
            )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status, duration, request_id for API requests. Update metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        from app.metrics import inc_request_total, inc_request_errors_total
        path = request.scope.get("path", "")
        inc_request_total()
        if any(path.startswith(p) for p in LOG_SKIP_PREFIXES):
            response = await call_next(request)
            if response.status_code >= 500:
                inc_request_errors_total()
            return response
        start = time.perf_counter()
        response = await call_next(request)
        if response.status_code >= 500:
            inc_request_errors_total()
        duration_ms = (time.perf_counter() - start) * 1000
        request_id = getattr(request.state, "request_id", "")
        logger.info(
            "%s %s %s %.1fms %s",
            request.method,
            path,
            response.status_code,
            duration_ms,
            request_id or "-",
        )
        return response
