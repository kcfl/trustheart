"""FastAPI application initialization, middleware wiring, exception handlers, and lifespan."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import ALLOWED_ORIGINS
from backend.app.routes import router
from backend.app.security import SafeLoggingAndSecurityMiddleware
from backend.app.service import get_model_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager: verifies model integrity and preloads artifacts.

    Fails closed at startup if cryptographic verification fails or artifacts are tampered.
    """
    # Trigger fail-closed integrity check on startup
    get_model_service()
    yield


app = FastAPI(
    title="TrustHeart 3D API",
    version="1.0.0",
    description="Multimodal CAD and vessel stenosis prediction backend with Fréchet coherence and clinical trust layer.",
    lifespan=lifespan,
)

# 1. CORS allow-list (no wildcard allowed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# 2. Security headers, rate limiting, and safe privacy logging middleware
app.add_middleware(SafeLoggingAndSecurityMiddleware)

# 3. Clean error handlers returning JSON without stack traces
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Format validation errors cleanly without stack traces."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        errors.append(f"{loc}: {msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "; ".join(errors)},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions with clean JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle uncaught exceptions cleanly without exposing stack traces."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred."},
    )


# 4. Attach API routes
app.include_router(router)
