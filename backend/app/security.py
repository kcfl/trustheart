"""Security, rate limiting, request validation, and safe logging middleware."""

import collections
import logging
import time
from typing import Any, Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.config import (
    MAX_REQUEST_BODY_BYTES,
    RATE_LIMIT_PER_MINUTE,
)

logger = logging.getLogger("trustheart.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Global tracker for IP request timestamps
REQUEST_TIMES: dict[str, collections.deque[float]] = collections.defaultdict(collections.deque)


def reset_rate_limiter() -> None:
    """Clear all recorded request timestamps for rate limiting."""
    REQUEST_TIMES.clear()


class SafeLoggingAndSecurityMiddleware(BaseHTTPMiddleware):
    """Enforces request size limits, in-memory rate limiting, security headers, and privacy logging."""

    def __init__(self, app: Any, rate_limit: int | None = None) -> None:
        super().__init__(app)
        self.rate_limit: int = rate_limit if rate_limit is not None else RATE_LIMIT_PER_MINUTE

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        # 1. Enforce max body size (20 KB)
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body exceeds maximum allowed limit of 20 KB."},
                    )
            except ValueError:
                pass

        # If body is streamed without content-length or to verify chunked bodies
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.body()
            if len(body) > MAX_REQUEST_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body exceeds maximum allowed limit of 20 KB."},
                )

        # 2. In-memory IP rate limiter
        import os
        trust_proxy = os.getenv("TRUSTHEART_TRUST_PROXY", "false").lower() in ("true", "1", "yes")
        try:
            trusted_hops = int(os.getenv("TRUSTHEART_TRUSTED_PROXY_HOPS", "1"))
            if trusted_hops < 1:
                trusted_hops = 1
        except ValueError:
            trusted_hops = 1

        client_ip = request.client.host if request.client and request.client.host else "127.0.0.1"
        if trust_proxy:
            xff = request.headers.get("x-forwarded-for")
            if xff:
                ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
                if len(ips) >= trusted_hops:
                    client_ip = ips[-trusted_hops]

        now = time.monotonic()
        q = REQUEST_TIMES[client_ip]

        # Purge requests older than 60 seconds
        while q and (now - q[0]) > 60.0:
            q.popleft()

        # Check rate limit (allow dynamic env override if modified during tests)
        current_limit = int(os.getenv("TRUSTHEART_RATE_LIMIT", str(self.rate_limit)))

        if len(q) >= current_limit:
            _ = await request.body()
            retry_after = max(1, int(60.0 - (now - q[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": str(retry_after), "Connection": "close"},
            )

        q.append(now)

        # 3. Process request with duration tracking
        start_time = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.monotonic() - start_time) * 1000.0
            logger.info(f"{request.method} {request.url.path} - 500 in {duration_ms:.2f}ms")
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error occurred."},
            )

        duration_ms = (time.monotonic() - start_time) * 1000.0

        # Safe logging: log ONLY method, path, status code, duration (NO inputs, bodies, case_ids)
        logger.info(f"{request.method} {request.url.path} - {response.status_code} in {duration_ms:.2f}ms")

        # 4. Attach strict security headers to every response
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"

        path = request.url.path
        if (
            path.startswith("/api/")
            or path == "/api"
            or path in ("/docs", "/openapi.json", "/redoc")
        ):
            response.headers["Content-Security-Policy"] = "default-src 'none'"
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; "
                "frame-ancestors 'none'"
            )

        if request.url.path.startswith("/api/predict"):
            response.headers["Cache-Control"] = "no-store"

        return response
