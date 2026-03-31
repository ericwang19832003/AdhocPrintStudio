"""Single-process FastAPI entry point for local deployment.

Monkey-patches cloud modules (app.db, app.models) to use local SQLite-backed
equivalents, then wires all routers into one FastAPI app.

Start with:
    cd apps/api && python -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# 1. Monkey-patch cloud modules BEFORE importing routers that depend on them
# ---------------------------------------------------------------------------
import app.db_local as db_local  # noqa: E402
import app.models_local as models_local  # noqa: E402
import app.db as db_mod  # noqa: E402
import app.models as models_mod  # noqa: E402

# Redirect db functions
db_mod.get_session = db_local.get_session  # type: ignore[attr-defined]
db_mod.ping_db = db_local.ping_db  # type: ignore[attr-defined]

# Redirect ORM models
models_mod.TemplateProfile = models_local.TemplateProfile  # type: ignore[attr-defined]
models_mod.Job = models_local.Job  # type: ignore[attr-defined]
models_mod.JobMapping = models_local.JobMapping  # type: ignore[attr-defined]
models_mod.JobTleConfig = models_local.JobTleConfig  # type: ignore[attr-defined]
models_mod.JobReturnAddress = models_local.JobReturnAddress  # type: ignore[attr-defined]
models_mod.JobRun = models_local.JobRun  # type: ignore[attr-defined]
models_mod.Asset = models_local.Asset  # type: ignore[attr-defined]

# ---------------------------------------------------------------------------
# 2. NOW import routers (they resolve symbols from the already-patched modules)
# ---------------------------------------------------------------------------
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.local_storage import router as local_storage_router  # noqa: E402
from app.assets_local import router as assets_local_router  # noqa: E402
from app.runs_local import router as runs_local_router  # noqa: E402
from app.jobs import router as jobs_router  # noqa: E402
from app.print_output import router as print_output_router  # noqa: E402
from app.db_local import init_db, ping_db  # noqa: E402
from app.worker_thread import start_worker, stop_worker  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 3. Lifespan: init DB + background worker
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting local mode — initialising SQLite DB and worker thread")
    init_db()
    start_worker()
    yield
    logger.info("Shutting down — stopping worker thread")
    stop_worker()


# ---------------------------------------------------------------------------
# 4. FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AdhocPrintStudio Local",
    description="Local single-process deployment (SQLite + filesystem)",
    version="1.0.0-local",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# 5. Middleware (order matters — last added runs first)
# ---------------------------------------------------------------------------


class LocalCSPMiddleware(BaseHTTPMiddleware):
    """Override the restrictive CSP from SecurityHeadersMiddleware.

    Allows inline scripts/styles so the bundled static frontend works.
    """

    LOCAL_CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "font-src 'self' data:; "
        "frame-ancestors 'none'"
    )

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["Content-Security-Policy"] = self.LOCAL_CSP
        return response


# Local mode: use permissive CSP only (no strict SecurityHeadersMiddleware)
app.add_middleware(LocalCSPMiddleware)

# CORS — allow everything for local use
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 6. Routers
# ---------------------------------------------------------------------------
app.include_router(local_storage_router)
app.include_router(assets_local_router)
app.include_router(runs_local_router)
app.include_router(jobs_router)
app.include_router(print_output_router)

# ---------------------------------------------------------------------------
# 7. Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db/ping")
def db_ping() -> dict[str, str]:
    try:
        ping_db()
    except Exception as exc:
        logger.error(f"Database ping failed: {exc}")
        raise HTTPException(status_code=500, detail="Database connection failed") from exc
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str | None]:
    return {"git_commit": None, "alembic_revision": "local-sqlite"}


# ---------------------------------------------------------------------------
# 8. Static frontend (mount LAST so API routes win)
# ---------------------------------------------------------------------------
_WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if _WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_WEB_DIR), html=True), name="static-frontend")
    logger.info("Serving static frontend from %s", _WEB_DIR)
else:
    logger.info("No web/ directory found at %s — static frontend not mounted", _WEB_DIR)
