from __future__ import annotations

import os
import logging
from pathlib import Path
import subprocess

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.env import load_env
from app.db import get_alembic_revision, ping_db
from app.assets import router as assets_router
from app.jobs import router as jobs_router
from app.runs import router as runs_router
from app.print_output import router as print_output_router
from app.security import SecurityHeadersMiddleware, sanitize_error_message

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_env()

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

# CORS configuration - MUST be explicitly set in production
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Development fallback - log warning
    logger.warning(
        "CORS_ORIGINS not set. Using permissive CORS for development. "
        "Set CORS_ORIGINS environment variable in production!"
    )
    cors_origins = ["*"]

app = FastAPI(
    title="AdhocPrintStudio API",
    description="API for document generation and print output",
    version="1.0.0",
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False if "*" in cors_origins else True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(assets_router)
app.include_router(jobs_router)
app.include_router(runs_router)
app.include_router(print_output_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global exception handler that sanitizes error messages.

    Prevents leaking sensitive information in error responses.
    """
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # For unexpected exceptions, sanitize the message
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": sanitize_error_message(exc)},
    )


@app.get("/health")
@limiter.exempt
def health() -> dict[str, str]:
    """Health check endpoint (exempt from rate limiting)."""
    return {"status": "ok"}


@app.get("/db/ping")
@limiter.limit("10/minute")
def db_ping(request: Request) -> dict[str, str]:
    """Database connectivity check."""
    try:
        ping_db()
    except Exception as exc:
        logger.error(f"Database ping failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Database connection failed",
        ) from exc
    return {"status": "ok"}


def get_git_commit() -> str | None:
    """Get the current git commit hash."""
    repo_root = Path(__file__).resolve().parents[3]
    try:
        result = subprocess.run(
            ["/usr/bin/git", "rev-parse", "--short", "HEAD"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() or None
    except Exception:
        return None


@app.get("/version")
@limiter.limit("30/minute")
def version(request: Request) -> dict[str, str | None]:
    """Get application version information."""
    return {
        "git_commit": get_git_commit(),
        "alembic_revision": get_alembic_revision(),
    }
