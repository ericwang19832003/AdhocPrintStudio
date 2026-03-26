# Windows Zero-Dependency Deployment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package AdhocPrintStudio as a single ZIP that runs on any Windows machine with zero prerequisites — unzip, double-click, use.

**Architecture:** Collapse 3 services (API, Web, Worker) + 3 cloud deps (PostgreSQL, S3, SQS) into a single Python process using SQLite, local filesystem storage, and a static frontend export. Ship with Python Embeddable Package so nothing needs installing.

**Tech Stack:** Python 3.11 (embeddable), FastAPI, SQLAlchemy (SQLite), Next.js (static export), uvicorn

**Design doc:** `docs/plans/2026-03-26-windows-deployment-design.md`

---

## Task 1: Create Local-Mode Database Layer (SQLite)

**Files:**
- Create: `apps/api/app/models_local.py`
- Create: `apps/api/app/db_local.py`
- Create: `apps/api/tests/test_db_local.py`

The existing `models.py` and `db.py` use PostgreSQL-specific types (`UUID`, `JSONB`, `psycopg2`). Rather than modifying them (which would break the cloud deployment), create parallel local-mode modules.

**Step 1: Write the failing test**

Create `apps/api/tests/test_db_local.py`:

```python
"""Tests for local SQLite database layer."""
import os
import tempfile
import uuid

import pytest


@pytest.fixture
def tmp_db(tmp_path):
    """Create a temporary SQLite database."""
    db_path = tmp_path / "test.db"
    os.environ["LOCAL_DATABASE_PATH"] = str(db_path)
    # Reset module-level singletons
    import app.db_local as db_mod
    db_mod._ENGINE = None
    db_mod._SESSION_FACTORY = None
    yield db_path
    os.environ.pop("LOCAL_DATABASE_PATH", None)
    db_mod._ENGINE = None
    db_mod._SESSION_FACTORY = None


def test_create_all_tables(tmp_db):
    from app.db_local import init_db, get_session
    init_db()
    with get_session() as session:
        # Should be able to query without error
        from app.models_local import Asset
        result = session.query(Asset).all()
        assert result == []


def test_insert_and_read_asset(tmp_db):
    from app.db_local import init_db, get_session
    from app.models_local import Asset
    init_db()
    asset_id = str(uuid.uuid4())
    with get_session() as session:
        asset = Asset(id=asset_id, type="TEMPLATE", filename="test.pdf", s3_key="uploads/test.pdf")
        session.add(asset)
        session.commit()
    with get_session() as session:
        asset = session.get(Asset, asset_id)
        assert asset is not None
        assert asset.filename == "test.pdf"


def test_insert_and_read_job_with_json(tmp_db):
    from app.db_local import init_db, get_session
    from app.models_local import TemplateProfile, Job, JobTleConfig
    init_db()
    tp_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    with get_session() as session:
        tp = TemplateProfile(id=tp_id, name="Test", version=1, status="ACTIVE", template_s3_key="k")
        session.add(tp)
        session.flush()
        job = Job(id=job_id, name="Job1", template_profile_id=tp_id)
        session.add(job)
        session.flush()
        tle = JobTleConfig(job_id=job_id, name_expr={"literal": "John Doe"})
        session.add(tle)
        session.commit()
    with get_session() as session:
        tle = session.get(JobTleConfig, job_id)
        assert tle is not None
        assert tle.name_expr == {"literal": "John Doe"}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/minwang/AdhocPrintStudio && cd apps/api && python -m pytest tests/test_db_local.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.db_local'`

**Step 3: Write `db_local.py`**

Create `apps/api/app/db_local.py`:

```python
"""Local SQLite database engine for zero-dependency deployment."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker | None = None


def get_database_path() -> Path:
    """Get the SQLite database file path."""
    path = os.getenv("LOCAL_DATABASE_PATH")
    if path:
        return Path(path)
    # Default: data/studio.db relative to project root
    return Path(__file__).resolve().parents[1] / "data" / "studio.db"


def get_engine() -> Engine:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        db_path = get_database_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _ENGINE = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
        # Enable WAL mode for better concurrency
        @event.listens_for(_ENGINE, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _SESSION_FACTORY = sessionmaker(bind=_ENGINE, autoflush=False, autocommit=False)
    return _ENGINE


@contextmanager
def get_session():
    if _SESSION_FACTORY is None:
        get_engine()
    if _SESSION_FACTORY is None:
        raise RuntimeError("Database session factory is not initialized.")
    session = _SESSION_FACTORY()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create all tables if they don't exist."""
    from app.models_local import Base
    engine = get_engine()
    Base.metadata.create_all(engine)


def ping_db() -> None:
    engine = get_engine()
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
```

**Step 4: Write `models_local.py`**

Create `apps/api/app/models_local.py`:

```python
"""SQLite-compatible models for local deployment.

Replaces PostgreSQL-specific types:
- UUID(as_uuid=True) → String(36) with str(uuid4) default
- JSONB → JSON (stored as TEXT in SQLite)
- DateTime(timezone=True) → DateTime
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow():
    return datetime.now(timezone.utc)


def _new_uuid():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class TemplateProfile(Base):
    __tablename__ = "template_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50))
    template_s3_key: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    type: Mapped[str] = mapped_column(String(50))
    filename: Mapped[str] = mapped_column(String(255))
    s3_key: Mapped[str] = mapped_column(String(512))
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String(255))
    template_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_profiles.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    template_profile: Mapped[TemplateProfile] = relationship()


class JobMapping(Base):
    __tablename__ = "job_mappings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"))
    placeholder_name: Mapped[str] = mapped_column(String(128))
    expression_json: Mapped[dict] = mapped_column(JSON)

    job: Mapped[Job] = relationship()


class JobTleConfig(Base):
    __tablename__ = "job_tle_config"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id"), primary_key=True
    )
    name_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr1_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr2_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr3_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr1_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr2_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr3_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped[Job] = relationship()


class JobReturnAddress(Base):
    __tablename__ = "job_return_address"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id"), primary_key=True
    )
    return_addr1: Mapped[str] = mapped_column(Text)
    return_addr2: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_addr3: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    job: Mapped[Job] = relationship()


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"))
    status: Mapped[str] = mapped_column(String(50))
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_tle_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    job: Mapped[Job] = relationship()
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_db_local.py -v`
Expected: 3 tests PASS

**Step 6: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/db_local.py apps/api/app/models_local.py apps/api/tests/test_db_local.py
git commit -m "feat: add SQLite-compatible models and db layer for local deployment"
```

---

## Task 2: Create Local Storage Service (Replace S3)

**Files:**
- Create: `apps/api/app/local_storage.py`
- Create: `apps/api/tests/test_local_storage.py`

**Step 1: Write the failing test**

Create `apps/api/tests/test_local_storage.py`:

```python
"""Tests for local file storage (S3 replacement)."""
import os
import tempfile

import pytest


@pytest.fixture
def storage_dir(tmp_path):
    """Set up a temporary storage directory."""
    storage = tmp_path / "storage"
    storage.mkdir()
    os.environ["LOCAL_STORAGE_PATH"] = str(storage)
    yield storage
    os.environ.pop("LOCAL_STORAGE_PATH", None)


def test_save_and_read_file(storage_dir):
    from app.local_storage import save_file, read_file
    save_file("uploads/TEMPLATE/abc/test.pdf", b"fake pdf content")
    data = read_file("uploads/TEMPLATE/abc/test.pdf")
    assert data == b"fake pdf content"


def test_read_missing_file_raises(storage_dir):
    from app.local_storage import read_file
    with pytest.raises(FileNotFoundError):
        read_file("nonexistent/key.pdf")


def test_get_upload_url(storage_dir):
    from app.local_storage import get_upload_url
    url = get_upload_url("uploads/TEMPLATE/abc/test.pdf")
    assert "/local/upload/" in url
    assert "uploads/TEMPLATE/abc/test.pdf" in url


def test_get_download_url(storage_dir):
    from app.local_storage import get_download_url
    url = get_download_url("outputs/run-id.afp")
    assert "/local/download/" in url
    assert "outputs/run-id.afp" in url


def test_file_exists(storage_dir):
    from app.local_storage import save_file, file_exists
    assert not file_exists("test/key.bin")
    save_file("test/key.bin", b"data")
    assert file_exists("test/key.bin")
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_local_storage.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.local_storage'`

**Step 3: Write `local_storage.py`**

Create `apps/api/app/local_storage.py`:

```python
"""Local filesystem storage service — replaces S3 for local deployment.

Files are stored under a configurable root directory (default: ./storage/).
The s3_key is used as the relative path within this directory.

Provides:
- save_file / read_file / file_exists — direct file I/O
- get_upload_url / get_download_url — returns local API endpoint URLs
- FastAPI router with /local/upload and /local/download endpoints
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse

router = APIRouter(tags=["local-storage"])


def _storage_root() -> Path:
    path = os.getenv("LOCAL_STORAGE_PATH")
    if path:
        return Path(path)
    return Path(__file__).resolve().parents[1] / "storage"


def save_file(key: str, data: bytes) -> None:
    """Save bytes to local storage at the given key path."""
    file_path = _storage_root() / key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(data)


def read_file(key: str) -> bytes:
    """Read bytes from local storage at the given key path."""
    file_path = _storage_root() / key
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {key}")
    return file_path.read_bytes()


def file_exists(key: str) -> bool:
    """Check if a file exists at the given key path."""
    return (_storage_root() / key).exists()


def get_upload_url(key: str) -> str:
    """Return the local upload endpoint URL for a given key."""
    return f"/local/upload/{quote(key, safe='/')}"


def get_download_url(key: str) -> str:
    """Return the local download endpoint URL for a given key."""
    return f"/local/download/{quote(key, safe='/')}"


@router.put("/local/upload/{key:path}")
async def upload_file(key: str, request: Request) -> dict[str, str]:
    """Accept a file upload and save it to local storage."""
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty body")
    save_file(key, body)
    return {"status": "ok"}


@router.get("/local/download/{key:path}")
async def download_file(key: str) -> Response:
    """Serve a file from local storage."""
    file_path = _storage_root() / key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    # Prevent path traversal
    try:
        file_path.resolve().relative_to(_storage_root().resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(file_path, filename=file_path.name)
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_local_storage.py -v`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/local_storage.py apps/api/tests/test_local_storage.py
git commit -m "feat: add local filesystem storage service replacing S3"
```

---

## Task 3: Create Local-Mode Assets Endpoints

**Files:**
- Create: `apps/api/app/assets_local.py`
- Create: `apps/api/tests/test_assets_local.py`

Replace the S3 presigned URL flow with local upload/download URLs.

**Step 1: Write the failing test**

Create `apps/api/tests/test_assets_local.py`:

```python
"""Tests for local-mode asset endpoints."""
import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    os.environ["LOCAL_DATABASE_PATH"] = str(tmp_path / "test.db")
    os.environ["LOCAL_STORAGE_PATH"] = str(tmp_path / "storage")

    from app.db_local import init_db, _reset
    _reset()
    init_db()

    from app.main_local import app
    yield TestClient(app)

    os.environ.pop("LOCAL_DATABASE_PATH", None)
    os.environ.pop("LOCAL_STORAGE_PATH", None)
    _reset()


def test_presign_upload_returns_local_url(client):
    resp = client.post("/assets/presign-upload", json={
        "filename": "template.pdf",
        "content_type": "application/pdf",
        "asset_type": "TEMPLATE",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "asset_id" in data
    assert "/local/upload/" in data["presigned_url"]


def test_upload_then_download(client):
    # 1. Get upload URL
    resp = client.post("/assets/presign-upload", json={
        "filename": "logo.png",
        "content_type": "image/png",
        "asset_type": "LOGO",
    })
    data = resp.json()
    upload_url = data["presigned_url"]
    asset_id = data["asset_id"]

    # 2. Upload file to local endpoint
    resp = client.put(upload_url, content=b"fake png data")
    assert resp.status_code == 200

    # 3. Get download URL
    resp = client.get(f"/assets/{asset_id}/presign-download")
    assert resp.status_code == 200
    download_url = resp.json()["url"]
    assert "/local/download/" in download_url

    # 4. Download file
    resp = client.get(download_url)
    assert resp.status_code == 200
    assert resp.content == b"fake png data"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_assets_local.py -v`
Expected: FAIL — modules not found

**Step 3: Write `assets_local.py`**

Create `apps/api/app/assets_local.py`:

```python
"""Local-mode asset endpoints — replaces S3 presigned URL flow."""
from __future__ import annotations

import uuid
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.db_local import get_session
from app.models_local import Asset
from app.local_storage import get_upload_url, get_download_url
from app.security import sanitize_filename

router = APIRouter()


class AssetType(str, Enum):
    TEMPLATE = "TEMPLATE"
    SPREADSHEET = "SPREADSHEET"
    LOGO = "LOGO"
    APPEND_PDF = "APPEND_PDF"
    OUTPUT_AFP = "OUTPUT_AFP"
    OUTPUT_TLE = "OUTPUT_TLE"


class PresignUploadRequest(BaseModel):
    filename: str
    content_type: str
    asset_type: AssetType

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        return sanitize_filename(v)

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if not v or "/" not in v or len(v) > 256:
            raise ValueError("Invalid content type")
        return v


class PresignUploadResponse(BaseModel):
    asset_id: str
    s3_key: str
    presigned_url: str


class CommitAssetRequest(BaseModel):
    asset_id: str
    checksum_sha256: str | None = None


class PresignDownloadResponse(BaseModel):
    url: str


@router.post("/assets/presign-upload", response_model=PresignUploadResponse)
def presign_upload(payload: PresignUploadRequest) -> PresignUploadResponse:
    asset_id = str(uuid.uuid4())
    s3_key = f"uploads/{payload.asset_type}/{asset_id}/{payload.filename}"

    with get_session() as session:
        asset = Asset(
            id=asset_id,
            type=payload.asset_type.value,
            filename=payload.filename,
            s3_key=s3_key,
        )
        session.add(asset)
        session.commit()

    return PresignUploadResponse(
        asset_id=asset_id,
        s3_key=s3_key,
        presigned_url=get_upload_url(s3_key),
    )


@router.post("/assets/commit")
def commit_asset(payload: CommitAssetRequest) -> dict[str, str]:
    with get_session() as session:
        asset = session.get(Asset, payload.asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
        if payload.checksum_sha256 is not None:
            asset.checksum_sha256 = payload.checksum_sha256
        session.commit()
    return {"status": "ok"}


@router.get("/assets/{asset_id}/presign-download", response_model=PresignDownloadResponse)
def presign_download(asset_id: str) -> PresignDownloadResponse:
    with get_session() as session:
        asset = session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
    return PresignDownloadResponse(url=get_download_url(asset.s3_key))
```

**Step 4: Run tests to verify they pass**

This depends on `main_local.py` (Task 5). We'll wire it up and run these tests after Task 5.

**Step 5: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/assets_local.py apps/api/tests/test_assets_local.py
git commit -m "feat: add local-mode asset endpoints replacing S3 presigned URLs"
```

---

## Task 4: Create Local-Mode Runs Endpoints (Replace SQS)

**Files:**
- Create: `apps/api/app/runs_local.py`
- Create: `apps/api/app/worker_thread.py`
- Create: `apps/api/tests/test_runs_local.py`

Replace SQS message send with a DB insert. A background thread polls for QUEUED runs.

**Step 1: Write the failing test**

Create `apps/api/tests/test_runs_local.py`:

```python
"""Tests for local-mode run endpoints and worker thread."""
import os
import uuid
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    os.environ["LOCAL_DATABASE_PATH"] = str(tmp_path / "test.db")
    os.environ["LOCAL_STORAGE_PATH"] = str(tmp_path / "storage")

    from app.db_local import init_db, _reset
    _reset()
    init_db()

    from app.main_local import app
    yield TestClient(app)

    os.environ.pop("LOCAL_DATABASE_PATH", None)
    os.environ.pop("LOCAL_STORAGE_PATH", None)
    _reset()


def _create_job(client) -> str:
    """Helper: create a template profile and job, return job_id."""
    from app.db_local import get_session
    from app.models_local import TemplateProfile, Job

    tp_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    with get_session() as session:
        tp = TemplateProfile(id=tp_id, name="T", version=1, status="ACTIVE", template_s3_key="k")
        session.add(tp)
        session.flush()
        job = Job(id=job_id, name="J", template_profile_id=tp_id)
        session.add(job)
        session.commit()
    return job_id


def test_create_run_sets_queued(client):
    job_id = _create_job(client)
    resp = client.post(f"/jobs/{job_id}/runs")
    assert resp.status_code == 200
    run_id = resp.json()["run_id"]

    resp = client.get(f"/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "QUEUED"
```

**Step 2: Write `runs_local.py`**

Create `apps/api/app/runs_local.py`:

```python
"""Local-mode run endpoints — no SQS, just DB insert."""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db_local import get_session
from app.models_local import Job, JobRun
from app.local_storage import get_download_url

router = APIRouter()


class CreateRunResponse(BaseModel):
    run_id: str


class RunStatusResponse(BaseModel):
    status: str
    progress: int | None
    output_s3_key: str | None
    output_tle_s3_key: str | None
    error: str | None


class RunOutputsResponse(BaseModel):
    afp_url: str | None
    tle_url: str | None


@router.post("/jobs/{job_id}/runs", response_model=CreateRunResponse)
def create_job_run(job_id: str) -> CreateRunResponse:
    with get_session() as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        job_run = JobRun(job_id=job_id, status="QUEUED", progress=0)
        session.add(job_run)
        session.commit()
        session.refresh(job_run)
        return CreateRunResponse(run_id=str(job_run.id))


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run(run_id: str) -> RunStatusResponse:
    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="run not found")
    return RunStatusResponse(
        status=run.status,
        progress=run.progress,
        output_s3_key=run.output_s3_key,
        output_tle_s3_key=run.output_tle_s3_key,
        error=run.error,
    )


@router.get("/runs/{run_id}/outputs", response_model=RunOutputsResponse)
def get_run_outputs(run_id: str) -> RunOutputsResponse:
    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="run not found")

    afp_url = get_download_url(run.output_s3_key) if run.output_s3_key else None
    tle_url = get_download_url(run.output_tle_s3_key) if run.output_tle_s3_key else None
    return RunOutputsResponse(afp_url=afp_url, tle_url=tle_url)
```

**Step 3: Write `worker_thread.py`**

Create `apps/api/app/worker_thread.py`:

```python
"""Background worker thread that polls job_runs for QUEUED status.

Replaces the SQS-based worker for local deployment.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid

from app.db_local import get_session
from app.models_local import Asset, JobReturnAddress, JobRun, JobTleConfig
from app.local_storage import read_file, save_file

logger = logging.getLogger(__name__)

_STOP_EVENT = threading.Event()


def evaluate_expr(expr) -> str | None:
    """Evaluate a TLE expression to a string value."""
    if expr is None:
        return None
    if isinstance(expr, str):
        return expr
    if isinstance(expr, dict):
        if "value" in expr:
            return str(expr["value"])
        if "literal" in expr:
            return str(expr["literal"])
        if "text" in expr:
            return str(expr["text"])
    return None


def _process_run(run_id: str, job_id: str) -> None:
    """Process a single queued run."""
    logger.info(f"Processing run {run_id} for job {job_id}")

    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run or run.status == "CANCELED":
            return
        run.status = "RUNNING"
        run.progress = 10
        session.commit()

        tle = session.get(JobTleConfig, job_id)
        return_address = session.get(JobReturnAddress, job_id)

    name = evaluate_expr(tle.name_expr if tle else None)
    addr1 = evaluate_expr(tle.addr1_expr if tle else None)
    addr2 = evaluate_expr(tle.addr2_expr if tle else None)
    addr3 = evaluate_expr(tle.addr3_expr if tle else None)

    return_addr1 = evaluate_expr(tle.return_addr1_expr if tle else None)
    return_addr2 = evaluate_expr(tle.return_addr2_expr if tle else None)
    return_addr3 = evaluate_expr(tle.return_addr3_expr if tle else None)

    if return_addr1 is None and return_address:
        return_addr1 = return_address.return_addr1
        return_addr2 = return_address.return_addr2
        return_addr3 = return_address.return_addr3

    if not return_addr1:
        with get_session() as session:
            run = session.get(JobRun, run_id)
            if run:
                run.status = "FAILED"
                run.error = "Return address missing"
                session.commit()
        return

    tle_manifest = {
        "Name": name,
        "Address1": addr1,
        "Address2": addr2,
        "Address3": addr3,
        "Return_Addr1": return_addr1,
        "Return_Addr2": return_addr2,
        "Return_Addr3": return_addr3,
    }

    output_key = f"outputs/{run_id}.afp"
    output_tle_key = f"outputs/{run_id}.tle.json"

    # For local mode, generate a stub AFP (the real AFP engine can be integrated later)
    afp_bytes = b"STUB_AFP_OUTPUT"
    save_file(output_key, afp_bytes)
    save_file(output_tle_key, json.dumps(tle_manifest).encode("utf-8"))

    with get_session() as session:
        run = session.get(JobRun, run_id)
        if run:
            run.status = "SUCCEEDED"
            run.progress = 100
            run.output_s3_key = output_key
            run.output_tle_s3_key = output_tle_key
            run.error = None
            session.commit()

    logger.info(f"Run {run_id} completed successfully")


def _poll_loop() -> None:
    """Main polling loop — checks for QUEUED runs every 2 seconds."""
    logger.info("Worker thread started — polling for queued runs")
    while not _STOP_EVENT.is_set():
        try:
            with get_session() as session:
                from sqlalchemy import select
                stmt = select(JobRun).where(JobRun.status == "QUEUED").limit(1)
                run = session.execute(stmt).scalars().first()
                if run:
                    run_id = run.id
                    job_id = run.job_id
            if run:
                try:
                    _process_run(run_id, job_id)
                except Exception as exc:
                    logger.error(f"Error processing run {run_id}: {exc}", exc_info=True)
                    try:
                        with get_session() as session:
                            r = session.get(JobRun, run_id)
                            if r:
                                r.status = "FAILED"
                                r.error = str(exc)
                                session.commit()
                    except Exception:
                        pass
        except Exception as exc:
            logger.error(f"Worker poll error: {exc}", exc_info=True)

        _STOP_EVENT.wait(timeout=2)


def start_worker() -> threading.Thread:
    """Start the background worker thread."""
    _STOP_EVENT.clear()
    thread = threading.Thread(target=_poll_loop, daemon=True, name="worker-thread")
    thread.start()
    return thread


def stop_worker() -> None:
    """Signal the worker thread to stop."""
    _STOP_EVENT.set()
```

**Step 4: Run tests**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_runs_local.py -v`
Expected: Tests pass (depends on Task 5 for `main_local.py`, defer full run)

**Step 5: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/runs_local.py apps/api/app/worker_thread.py apps/api/tests/test_runs_local.py
git commit -m "feat: add local-mode runs endpoints and background worker thread"
```

---

## Task 5: Create Local-Mode FastAPI App (`main_local.py`)

**Files:**
- Create: `apps/api/app/main_local.py`

This is the single entry point that wires everything together for local deployment.

**Step 1: Write `main_local.py`**

Create `apps/api/app/main_local.py`:

```python
"""Local-mode FastAPI application — single process, zero cloud dependencies.

Replaces:
- PostgreSQL → SQLite
- S3 → local filesystem
- SQS → background worker thread
- Next.js → static files served by FastAPI
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.db_local import init_db, ping_db
from app.assets_local import router as assets_router
from app.runs_local import router as runs_router
from app.local_storage import router as storage_router
from app.worker_thread import start_worker, stop_worker
from app.security import SecurityHeadersMiddleware

# Import jobs router — it uses app.db and app.models, so we need to
# monkey-patch the imports to use local versions
import app.db_local as db_local
import app.models_local as models_local
import app.db as db_mod
import app.models as models_mod

# Redirect the cloud modules to local modules
db_mod.get_session = db_local.get_session
db_mod.ping_db = db_local.ping_db
models_mod.TemplateProfile = models_local.TemplateProfile
models_mod.Job = models_local.Job
models_mod.JobMapping = models_local.JobMapping
models_mod.JobTleConfig = models_local.JobTleConfig
models_mod.JobReturnAddress = models_local.JobReturnAddress
models_mod.JobRun = models_local.JobRun
models_mod.Asset = models_local.Asset

from app.jobs import router as jobs_router
from app.print_output import router as print_output_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + start worker. Shutdown: stop worker."""
    init_db()
    logger.info("Database initialized (SQLite)")
    worker = start_worker()
    logger.info("Background worker started")
    yield
    stop_worker()
    logger.info("Background worker stopped")


app = FastAPI(
    title="AdhocPrintStudio (Local)",
    description="Local deployment — zero cloud dependencies",
    version="1.0.0-local",
    lifespan=lifespan,
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS — allow localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(storage_router)
app.include_router(assets_router)
app.include_router(jobs_router)
app.include_router(runs_router)
app.include_router(print_output_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db/ping")
def db_ping() -> dict[str, str]:
    ping_db()
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str | None]:
    return {"git_commit": None, "alembic_revision": "local-sqlite"}


# Mount static frontend LAST (catch-all)
web_dir = Path(__file__).resolve().parents[1] / "web"
if web_dir.exists():
    app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="static-web")
```

**Step 2: Add `_reset()` helper to `db_local.py`**

Add to `apps/api/app/db_local.py` (needed by test fixtures):

```python
def _reset() -> None:
    """Reset engine/session singletons (for testing)."""
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None
```

**Step 3: Run all local tests**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/api && python -m pytest tests/test_db_local.py tests/test_local_storage.py tests/test_assets_local.py tests/test_runs_local.py -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/main_local.py apps/api/app/db_local.py
git commit -m "feat: add main_local.py — single-process local FastAPI app"
```

---

## Task 6: Build Static Frontend

**Files:**
- Modify: `apps/web/next.config.js`
- Modify: `apps/web/src/lib/env.ts`

**Step 1: Update `next.config.js` for static export**

In `apps/web/next.config.js`, change line 18:

```javascript
// Change from:
output: 'standalone',
// Change to:
output: 'export',
```

Also remove the `headers()` function (not supported with static export). The security headers will be served by FastAPI instead.

Full replacement `next.config.js`:

```javascript
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envLocalPath = path.join(__dirname, ".env.local");
const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
};

module.exports = nextConfig;
```

**Step 2: Update `env.ts` to default to same-origin**

In `apps/web/src/lib/env.ts`:

```typescript
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};
```

The empty string means all API calls use relative URLs (same origin as the static files, which FastAPI serves).

**Step 3: Build the frontend**

Run:
```bash
cd /Users/minwang/AdhocPrintStudio/apps/web
npm install && npm run build
```

Expected: Creates `out/` directory with static HTML/JS/CSS files.

**Step 4: Copy `out/` to `apps/api/web/` for local serving**

```bash
cp -r /Users/minwang/AdhocPrintStudio/apps/web/out /Users/minwang/AdhocPrintStudio/apps/api/web
```

**Step 5: Verify locally**

```bash
cd /Users/minwang/AdhocPrintStudio/apps/api
python -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000` — should see the builder UI.

**Step 6: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/web/next.config.js apps/web/src/lib/env.ts
git commit -m "feat: configure frontend for static export with same-origin API"
```

Note: Don't commit the `out/` or `web/` build artifacts — they're generated.

---

## Task 7: Create Windows Build Script

**Files:**
- Create: `scripts/build-windows.sh`
- Create: `dist/start.bat`
- Create: `dist/stop.bat`
- Create: `dist/README.txt`

This script runs on your Mac to assemble the Windows ZIP.

**Step 1: Create `scripts/build-windows.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Build AdhocPrintStudio Windows distribution
# Run this on Mac/Linux. Produces a ZIP for Windows.
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BUILD_DIR="$ROOT/build/AdhocPrintStudio-Windows"
PYTHON_VERSION="3.11.11"
PYTHON_EMBED_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"

echo "=== AdhocPrintStudio Windows Build ==="

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── 1. Download Python Embeddable ──
echo "[1/6] Downloading Python ${PYTHON_VERSION} embeddable for Windows..."
PYTHON_ZIP="$ROOT/build/python-embed.zip"
if [ ! -f "$PYTHON_ZIP" ]; then
    curl -Lo "$PYTHON_ZIP" "$PYTHON_EMBED_URL"
fi
mkdir -p "$BUILD_DIR/python"
unzip -qo "$PYTHON_ZIP" -d "$BUILD_DIR/python"

# Enable pip by uncommenting import site in ._pth file
PTH_FILE="$BUILD_DIR/python/python311._pth"
sed -i '' 's/#import site/import site/' "$PTH_FILE" 2>/dev/null || \
    sed -i 's/#import site/import site/' "$PTH_FILE"

# ── 2. Create local requirements ──
echo "[2/6] Creating local requirements..."
cat > "$BUILD_DIR/requirements-local.txt" << 'REQS'
fastapi==0.115.0
uvicorn==0.30.6
python-dotenv==1.0.1
SQLAlchemy==2.0.35
pillow==10.4.0
openpyxl==3.1.5
python-multipart==0.0.9
defusedxml==0.7.1
PyMuPDF==1.24.5
filetype==1.2.0
REQS

# Note: pip install must be done ON a Windows machine or via cross-platform wheels.
# This script prepares everything; the final pip install step runs on Windows.
# Alternatively, download Windows wheels on Mac using: pip download --platform win_amd64 ...

# ── 3. Copy API source ──
echo "[3/6] Copying API source..."
cp -r "$ROOT/apps/api/app" "$BUILD_DIR/app"

# ── 4. Copy worker source ──
echo "[4/6] Copying worker source..."
cp -r "$ROOT/apps/worker/worker" "$BUILD_DIR/worker"

# ── 5. Build frontend ──
echo "[5/6] Building frontend..."
cd "$ROOT/apps/web"
NEXT_PUBLIC_API_BASE_URL="" npm run build
cp -r out "$BUILD_DIR/web"
cd "$ROOT"

# ── 6. Copy launcher scripts ──
echo "[6/6] Copying launcher scripts..."
cp "$ROOT/dist/start.bat" "$BUILD_DIR/"
cp "$ROOT/dist/stop.bat" "$BUILD_DIR/"
cp "$ROOT/dist/README.txt" "$BUILD_DIR/"
cp "$BUILD_DIR/requirements-local.txt" "$BUILD_DIR/"

# Create empty directories
mkdir -p "$BUILD_DIR/data"
mkdir -p "$BUILD_DIR/storage"

# ── Create first-run setup script ──
cat > "$BUILD_DIR/setup.bat" << 'BAT'
@echo off
echo Installing Python dependencies (first run only)...
python\python.exe -m pip install --no-warn-script-location -r requirements-local.txt
echo.
echo Setup complete! Run start.bat to launch.
pause
BAT

# ── Zip it ──
echo ""
echo "=== Creating ZIP ==="
cd "$ROOT/build"
zip -qr "AdhocPrintStudio-Windows.zip" "AdhocPrintStudio-Windows"
echo "Done! Output: build/AdhocPrintStudio-Windows.zip"
echo "Size: $(du -sh AdhocPrintStudio-Windows.zip | cut -f1)"
```

**Step 2: Create `dist/start.bat`**

```batch
@echo off
title AdhocPrintStudio
echo.
echo  ========================================
echo   AdhocPrintStudio - Local Edition
echo  ========================================
echo.

REM Create directories if needed
if not exist "data" mkdir data
if not exist "storage" mkdir storage

REM Check if dependencies are installed
if not exist "python\Lib\site-packages\fastapi" (
    echo First run detected - installing dependencies...
    echo This may take a minute...
    python\python.exe -m pip install --no-warn-script-location -r requirements-local.txt
    echo.
)

echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop.
echo.

REM Open browser after 2 second delay
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

REM Start the server
python\python.exe -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000
```

**Step 3: Create `dist/stop.bat`**

```batch
@echo off
echo Stopping AdhocPrintStudio...
taskkill /F /FI "WINDOWTITLE eq AdhocPrintStudio" 2>nul
echo Done.
timeout /t 2 /nobreak >nul
```

**Step 4: Create `dist/README.txt`**

```
AdhocPrintStudio — Local Edition
=================================

FIRST TIME SETUP:
  1. Unzip this folder anywhere on your computer
  2. Double-click "start.bat"
  3. Wait for dependencies to install (first run only, ~1 minute)
  4. Your browser will open automatically to http://localhost:8000

DAILY USE:
  1. Double-click "start.bat"
  2. Browser opens automatically
  3. When done, close the command window or press Ctrl+C

TROUBLESHOOTING:
  - If the browser doesn't open, manually go to http://localhost:8000
  - If port 8000 is in use, close other apps using that port
  - Your data is saved in the "data" folder (database) and "storage" folder (files)
  - To reset everything, delete the data and storage folders

SYSTEM REQUIREMENTS:
  - Windows 10 or later (64-bit)
  - No other software installation required
```

**Step 5: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
mkdir -p scripts dist
git add scripts/build-windows.sh dist/start.bat dist/stop.bat dist/README.txt
git commit -m "feat: add Windows build script and launcher files"
```

---

## Task 8: Handle `python-magic` Windows Compatibility

**Files:**
- Modify: `apps/api/app/security.py` (lines 150-188)

`python-magic` requires `libmagic` which is hard to get on Windows. The app already has a built-in `FILE_SIGNATURES` dict with magic byte checking. The `python-magic` import is only used implicitly by the dependency being installed — it's actually NOT imported in `security.py`. Verify this:

**Step 1: Verify `python-magic` is not imported**

Run: `grep -r "import magic" /Users/minwang/AdhocPrintStudio/apps/api/`

If not found, simply remove `python-magic` from the local requirements. The existing `validate_file_content()` function in `security.py` uses its own `FILE_SIGNATURES` dict — no change needed.

**Step 2: If `python-magic` IS imported somewhere, replace with `filetype`**

The local `requirements-local.txt` already lists `filetype==1.2.0` instead of `python-magic`. No code change needed since the existing magic-byte validation in `security.py` is self-contained.

**Step 3: Commit (if any changes)**

```bash
git add -A && git commit -m "fix: ensure Windows compatibility for file type validation"
```

---

## Task 9: Update CSP Headers for Static File Serving

**Files:**
- Modify: `apps/api/app/security.py` (line 86)

The current CSP `default-src 'none'` will block the static frontend from loading JS/CSS. Update it for local mode.

**Step 1: Update CSP in `main_local.py`**

Rather than modifying `security.py` (which would affect cloud mode), override the CSP in `main_local.py`. Add a middleware after `SecurityHeadersMiddleware`:

Add to `apps/api/app/main_local.py`, after the security headers middleware:

```python
from starlette.middleware.base import BaseHTTPMiddleware

class LocalCSPMiddleware(BaseHTTPMiddleware):
    """Override CSP for local mode to allow static frontend."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "font-src 'self' data:; "
            "frame-ancestors 'none'"
        )
        return response

# Add AFTER SecurityHeadersMiddleware so it overrides
app.add_middleware(LocalCSPMiddleware)
```

**Step 2: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/api/app/main_local.py
git commit -m "fix: relax CSP for local static frontend serving"
```

---

## Task 10: End-to-End Local Test

**Files:** No new files — validation only.

**Step 1: Start the local server on Mac**

```bash
cd /Users/minwang/AdhocPrintStudio/apps/api
pip install -r requirements.txt  # existing deps
pip install filetype             # replacement for python-magic
LOCAL_DATABASE_PATH=./data/studio.db LOCAL_STORAGE_PATH=./storage python -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000 --reload
```

**Step 2: Verify health endpoints**

```bash
curl http://localhost:8000/health
# {"status":"ok"}

curl http://localhost:8000/db/ping
# {"status":"ok"}
```

**Step 3: Verify static frontend**

Open `http://localhost:8000` in browser — should see the builder UI.

**Step 4: Verify upload flow**

```bash
# Get upload URL
curl -X POST http://localhost:8000/assets/presign-upload \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","content_type":"application/pdf","asset_type":"TEMPLATE"}'
# Should return {"asset_id":"...","s3_key":"...","presigned_url":"/local/upload/..."}

# Upload a file
curl -X PUT http://localhost:8000/local/upload/uploads/TEMPLATE/test-id/test.pdf \
  --data-binary @some-test-file.pdf
# {"status":"ok"}
```

**Step 5: Verify database persists**

Check `data/studio.db` exists and contains data:
```bash
sqlite3 data/studio.db "SELECT count(*) FROM assets;"
```

**Step 6: Run all unit tests**

```bash
cd /Users/minwang/AdhocPrintStudio/apps/api
python -m pytest tests/test_db_local.py tests/test_local_storage.py tests/test_assets_local.py tests/test_runs_local.py -v
```

Expected: All tests PASS.

**Step 7: Commit final state**

```bash
cd /Users/minwang/AdhocPrintStudio
git add -A
git commit -m "test: verify end-to-end local deployment"
```

---

## Task 11: Build and Package the Windows ZIP

**Step 1: Run the build script**

```bash
cd /Users/minwang/AdhocPrintStudio
chmod +x scripts/build-windows.sh
./scripts/build-windows.sh
```

Expected output: `build/AdhocPrintStudio-Windows.zip`

**Step 2: Test on Windows**

Transfer the ZIP to the Windows machine. Then:
1. Unzip to any folder (e.g., Desktop)
2. Double-click `start.bat`
3. First run: dependencies install automatically (~1-2 minutes)
4. Browser opens to `http://localhost:8000`
5. Verify the builder UI loads and you can create templates

**Step 3: Final commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add -A
git commit -m "feat: complete Windows zero-dependency deployment packaging"
```

---

## Summary: Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| Create | `apps/api/app/db_local.py` | SQLite database engine |
| Create | `apps/api/app/models_local.py` | SQLite-compatible ORM models |
| Create | `apps/api/app/local_storage.py` | Local filesystem storage (S3 replacement) |
| Create | `apps/api/app/assets_local.py` | Local-mode asset endpoints |
| Create | `apps/api/app/runs_local.py` | Local-mode run endpoints (no SQS) |
| Create | `apps/api/app/worker_thread.py` | Background worker thread (SQS replacement) |
| Create | `apps/api/app/main_local.py` | Local-mode FastAPI entry point |
| Create | `apps/api/tests/test_db_local.py` | Tests for SQLite layer |
| Create | `apps/api/tests/test_local_storage.py` | Tests for local storage |
| Create | `apps/api/tests/test_assets_local.py` | Tests for local assets |
| Create | `apps/api/tests/test_runs_local.py` | Tests for local runs |
| Create | `scripts/build-windows.sh` | Windows ZIP build script |
| Create | `dist/start.bat` | Windows launcher |
| Create | `dist/stop.bat` | Windows shutdown |
| Create | `dist/README.txt` | User instructions |
| Modify | `apps/web/next.config.js` | Static export config |
| Modify | `apps/web/src/lib/env.ts` | Same-origin API URL |

**Unchanged** (no modifications): `jobs.py`, `print_output.py`, `afp_*.py`, `xml_streaming_parser.py`, `security.py`, all frontend components, original `models.py`/`db.py`/`aws.py` (cloud deployment preserved).
