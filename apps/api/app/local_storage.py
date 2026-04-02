"""Local filesystem storage service replacing AWS S3 for local deployment."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter(tags=["local-storage"])

_storage_root: Path | None = None


def _get_storage_root() -> Path:
    """Return the storage root directory, cached after first call."""
    global _storage_root
    if _storage_root is None:
        env_path = os.getenv("LOCAL_STORAGE_PATH", "")
        if env_path:
            _storage_root = Path(env_path).resolve()
        else:
            # Default: ./storage/ relative to the api app root (apps/api/)
            _storage_root = Path(__file__).resolve().parents[1] / "storage"
    return _storage_root


def _reset() -> None:
    """Reset cached storage root (for tests)."""
    global _storage_root
    _storage_root = None


def _safe_path(key: str) -> Path:
    """Resolve *key* under the storage root, rejecting path traversal."""
    root = _get_storage_root().resolve()
    resolved = (root / key).resolve()
    # Use os.path.commonpath to avoid prefix false-positives
    # (e.g. /tmp/storage vs /tmp/storage2)
    try:
        common = Path(os.path.commonpath([root, resolved]))
    except ValueError:
        raise ValueError(f"Path traversal detected: {key}")
    if common != root:
        raise ValueError(f"Path traversal detected: {key}")
    return resolved


# ---------------------------------------------------------------------------
# Public API functions
# ---------------------------------------------------------------------------


def save_file(key: str, data: bytes) -> None:
    """Save *data* bytes to ``./storage/{key}``, creating parent dirs."""
    target = _safe_path(key)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def read_file(key: str) -> bytes:
    """Read bytes from ``./storage/{key}``.

    Raises ``FileNotFoundError`` if the key does not exist.
    """
    target = _safe_path(key)
    if not target.is_file():
        raise FileNotFoundError(f"No such file: {key}")
    return target.read_bytes()


def file_exists(key: str) -> bool:
    """Return ``True`` if a file exists at *key*."""
    target = _safe_path(key)
    return target.is_file()


def get_upload_url(key: str) -> str:
    """Return the local upload endpoint URL for *key*."""
    return f"/local/upload/{key}"


def get_download_url(key: str) -> str:
    """Return the local download endpoint URL for *key*."""
    return f"/local/download/{key}"


# ---------------------------------------------------------------------------
# FastAPI endpoints
# ---------------------------------------------------------------------------


@router.put("/local/upload/{key:path}")
async def upload_file(key: str, request: Request) -> dict[str, str]:
    """Accept raw bytes in the request body and persist to local storage."""
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")
    try:
        save_file(key, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "ok", "key": key}


@router.get("/local/download/{key:path}")
async def download_file(key: str) -> FileResponse:
    """Serve a file from local storage."""
    try:
        target = _safe_path(key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {key}")

    return FileResponse(path=target, filename=target.name)
