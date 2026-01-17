from __future__ import annotations

from pathlib import Path
import subprocess

from fastapi import FastAPI, HTTPException

from app.env import load_env
from app.db import get_alembic_revision, ping_db
from app.assets import router as assets_router
from app.jobs import router as jobs_router
from app.runs import router as runs_router

load_env()

app = FastAPI()
app.include_router(assets_router)
app.include_router(jobs_router)
app.include_router(runs_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db/ping")
def db_ping() -> dict[str, str]:
    try:
        ping_db()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"status": "ok"}


def get_git_commit() -> str | None:
    repo_root = Path(__file__).resolve().parents[3]
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip() or None
    except Exception:
        return None


@app.get("/version")
def version() -> dict[str, str | None]:
    return {
        "git_commit": get_git_commit(),
        "alembic_revision": get_alembic_revision(),
    }
