# Zero-Dependency Windows Deployment — Design Document

**Date**: 2026-03-26
**Goal**: Package AdhocPrintStudio as a fully self-contained ZIP that runs on any Windows machine with zero prerequisites. Unzip → double-click `start.bat` → browser opens → ready to use.

---

## 1. Architecture Overview

Collapse the current 3-process + 3-cloud-service architecture into a **single Python process** with **zero external dependencies**.

```
CURRENT (Cloud)                      LOCAL (Windows)
─────────────────                    ─────────────────
Next.js (Node.js)  ──→              Static HTML/JS/CSS served by FastAPI
FastAPI  (Python)  ──→              FastAPI (embedded Python, single process)
Worker   (Python)  ──→              Background thread inside FastAPI
PostgreSQL (RDS)   ──→              SQLite (file-based, built into Python)
S3       (AWS)     ──→              Local filesystem (./storage/)
SQS      (AWS)     ──→              DB polling (worker thread checks job_runs)
```

### What ships in the ZIP

```
AdhocPrintStudio-Windows/
├── python/                     # Python 3.11 embeddable + pip + site-packages
│   ├── python.exe
│   ├── python311.dll
│   ├── python311._pth          # Modified to include Lib/site-packages
│   └── Lib/site-packages/      # All pip dependencies pre-installed
├── app/                        # FastAPI application source (from apps/api/app/)
├── worker/                     # Worker source (from apps/worker/worker/)
├── web/                        # Static export of Next.js frontend
├── storage/                    # Local file storage (replaces S3)
├── data/                       # SQLite database file (auto-created)
├── start.bat                   # One-click launcher
├── stop.bat                    # Graceful shutdown
└── README.txt                  # Brief user instructions
```

---

## 2. Component Replacements

### 2.1 PostgreSQL → SQLite

**Why**: SQLite is built into Python's standard library. No server process, no installation. The database is a single file (`data/studio.db`).

**What changes in code**:

| Current (PostgreSQL) | Replacement (SQLite) |
|----------------------|----------------------|
| `sqlalchemy.dialects.postgresql.UUID` | `sqlalchemy.String(36)` with `default=lambda: str(uuid.uuid4())` |
| `sqlalchemy.dialects.postgresql.JSONB` | `sqlalchemy.JSON` (SQLAlchemy's generic JSON, stored as TEXT in SQLite) |
| `DateTime(timezone=True)` with `func.now()` | `DateTime` with `func.now()` (SQLite stores as string, works fine) |
| `func.now()` in `onupdate` | Manual `datetime.utcnow()` in Python (SQLite doesn't support `onupdate` triggers natively via SA) |
| Alembic migrations | Direct `Base.metadata.create_all(engine)` on startup (simpler for local use) |
| `psycopg2` driver | `sqlite3` (built-in, no extra package) |

**Files to modify**:
- `apps/api/app/models.py` — Replace PG-specific column types
- `apps/api/app/db.py` — SQLite connection string, remove Alembic dependency
- `apps/worker/worker/models.py` — Same column type changes
- `apps/worker/worker/db.py` — SQLite connection string

**Concurrency note**: SQLite with WAL mode handles the single-user, single-writer pattern perfectly. Enable WAL on engine creation: `engine.execute("PRAGMA journal_mode=WAL")`.

### 2.2 S3 → Local Filesystem

**Why**: Files are stored and retrieved locally. No AWS credentials needed.

**Design**: Create a new `local_storage.py` module that provides the same interface as the S3 operations but reads/writes to `./storage/` on disk.

**Current S3 touchpoints** (all in `apps/api/app/`):
| File | Function | S3 Operation |
|------|----------|-------------|
| `aws.py` | `get_s3_client()` | Creates boto3 S3 client |
| `assets.py` | `presign_upload()` | `generate_presigned_url("put_object")` |
| `assets.py` | `presign_download()` | `generate_presigned_url("get_object")` |
| `runs.py` | `get_run_outputs()` | `generate_presigned_url("get_object")` |

**Current S3 touchpoints** (in `apps/worker/worker/`):
| File | Function | S3 Operation |
|------|----------|-------------|
| `main.py` | `process_message()` | `get_object()` (read assets), `put_object()` (write outputs) |

**Replacement strategy**:

For the **API**, replace presigned URLs with direct FastAPI file endpoints:
- **Upload**: New `POST /local/upload/{s3_key}` endpoint accepts file body, writes to `./storage/{s3_key}`
- **Download**: New `GET /local/download/{s3_key}` endpoint serves file from `./storage/{s3_key}`
- `presign_upload()` returns the local upload URL instead of an S3 presigned URL
- `presign_download()` returns the local download URL instead of an S3 presigned URL

For the **Worker**, replace boto3 calls with direct filesystem reads/writes:
- `s3_client.get_object()` → `open(storage_path / key, "rb").read()`
- `s3_client.put_object()` → `open(storage_path / key, "wb").write(data)`

**New file**: `apps/api/app/local_storage.py`

```python
# Provides:
# - save_file(s3_key: str, data: bytes) -> None
# - read_file(s3_key: str) -> bytes
# - get_upload_url(s3_key: str) -> str    # returns /local/upload/{s3_key}
# - get_download_url(s3_key: str) -> str  # returns /local/download/{s3_key}
# - FastAPI router with upload/download endpoints
```

### 2.3 SQS → Background Worker Thread with DB Polling

**Why**: No message queue needed for single-user local use. A background thread polling the database is simpler and has zero dependencies.

**Current flow**:
1. `runs.py:create_job_run()` → inserts JobRun(status=QUEUED) → sends SQS message
2. `worker/main.py:run()` → polls SQS → calls `process_message()`

**New flow**:
1. `runs.py:create_job_run()` → inserts JobRun(status=QUEUED) — no SQS message
2. Background thread (started with FastAPI lifespan) → polls `job_runs` table every 2 seconds for `status=QUEUED` → calls `process_run()`

**Files to modify**:
- `apps/api/app/runs.py` — Remove SQS send, just insert QUEUED row
- `apps/api/app/main.py` — Add lifespan event to start/stop worker thread
- `apps/worker/worker/main.py` — Refactor `process_message()` to `process_run()` that reads from DB instead of SQS message body; replace S3 calls with local filesystem

### 2.4 Next.js → Static Export Served by FastAPI

**Why**: The frontend is a pure SPA (`ClientShell.tsx` disables SSR, dynamically imports `BuilderClient`). It can be statically exported as plain HTML/JS/CSS and served by FastAPI's `StaticFiles` middleware — eliminating the Node.js runtime entirely.

**Build step** (done once on your Mac before zipping):
1. Change `next.config.js`: `output: 'standalone'` → `output: 'export'`
2. Set `NEXT_PUBLIC_API_BASE_URL` to empty string (relative URLs, same origin)
3. Run `pnpm build` → produces `out/` directory with static files
4. Copy `out/` to the ZIP as `web/`

**Runtime**: FastAPI mounts `web/` as static files:
```python
app.mount("/", StaticFiles(directory="web", html=True), name="web")
```

**Files to modify**:
- `apps/web/next.config.js` — Change output mode
- `apps/web/src/lib/env.ts` — Default API URL to `""` (same origin)

---

## 3. Python Embeddable Package

**What**: Microsoft provides an official "embeddable" Python distribution — a minimal, portable Python that runs without installation. ~15MB zipped.

**Download**: `python-3.11.x-embed-amd64.zip` from python.org

**Setup** (done once on your Mac or a Windows build machine):
1. Extract the embeddable zip
2. Modify `python311._pth` to uncomment `import site` (enables pip/site-packages)
3. Install pip: `python.exe get-pip.py`
4. Install all dependencies: `python.exe -m pip install -r requirements.txt --target Lib/site-packages`
5. Copy the API app source into the bundle

**Windows-specific dependency notes**:
- `python-magic` requires `libmagic` DLL on Windows — replace with `python-magic-bin` (bundles the DLL) or use `filetype` library instead (pure Python, no native deps)
- `PyMuPDF` provides pre-built Windows wheels — works out of the box
- `Pillow` provides pre-built Windows wheels — works out of the box
- `psycopg2` is NOT needed (SQLite replaces PostgreSQL)
- `boto3` is NOT needed (local storage replaces S3)

---

## 4. Launcher Scripts

### start.bat
```batch
@echo off
echo Starting AdhocPrintStudio...
echo.

REM Create data directory if it doesn't exist
if not exist "data" mkdir data
if not exist "storage" mkdir storage

REM Start the server
echo Server starting at http://localhost:8000
echo Press Ctrl+C to stop.
echo.

REM Open browser after a short delay
start "" "http://localhost:8000"

REM Run FastAPI via embedded Python
python\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### stop.bat
```batch
@echo off
taskkill /F /IM python.exe /FI "WINDOWTITLE eq AdhocPrintStudio*" 2>nul
echo AdhocPrintStudio stopped.
```

---

## 5. Build & Package Process

This is done on your Mac (or any machine with Node.js + Python). The output is a ZIP file you give to your workmate.

### Steps:
1. **Build frontend**: `cd apps/web && pnpm build` (with `output: 'export'`)
2. **Download Python embeddable** for Windows (amd64)
3. **Install Python deps** into embeddable's site-packages
4. **Assemble ZIP**:
   - `python/` — embeddable Python with deps
   - `app/` — API source
   - `worker/` — Worker source
   - `web/` — Static frontend (from `out/`)
   - `storage/` — Empty directory
   - `data/` — Empty directory
   - `start.bat`, `stop.bat`, `README.txt`
5. **Zip it**: `AdhocPrintStudio-Windows.zip`

A `build-windows.sh` script will automate this entire process.

---

## 6. Removed Dependencies

These packages are no longer needed in the Windows bundle:

| Package | Reason |
|---------|--------|
| `boto3` | No AWS (S3/SQS replaced with local alternatives) |
| `psycopg2-binary` | No PostgreSQL (SQLite is built-in) |
| `alembic` | No migrations (tables created directly via `create_all`) |
| `python-magic` | Replace with `filetype` (pure Python) or `python-magic-bin` |
| `slowapi` | Optional for local use (single user, no rate limiting needed) |

---

## 7. Scope of Code Changes

| Area | Files Changed | Complexity |
|------|--------------|------------|
| SQLite adapter | `models.py` (×2), `db.py` (×2) | Medium — type replacements, careful with JSONB→JSON |
| Local storage | New `local_storage.py`, modify `assets.py`, `runs.py` | Medium — new upload/download endpoints |
| Worker → background thread | `main.py` (API), `main.py` (worker) | Low-Medium — refactor SQS poll to DB poll |
| Static frontend | `next.config.js`, `env.ts` | Low — config changes only |
| Windows packaging | New `build-windows.sh`, `start.bat` | Low — scripting |
| Dependency cleanup | `requirements.txt` (new local version) | Low — remove unused packages |

**Total estimated new/modified files**: ~12-15 files
**No changes to**: `print_output.py`, `afp_*.py`, `xml_streaming_parser.py`, `security.py`, `jobs.py`, frontend components

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| SQLite JSON queries behave differently than JSONB | The app only stores/retrieves JSON, no complex JSON path queries — low risk |
| `python-magic` needs native DLL on Windows | Switch to `filetype` (pure Python) or `python-magic-bin` |
| Static export may fail if Next.js uses server features | Verified: app is pure SPA with SSR disabled — safe to export |
| Windows antivirus flags unknown `.exe` | We're using official Python.org distribution, not a custom .exe — low risk |
| SQLite concurrent writes from API + worker thread | WAL mode + single-user usage = safe. Worker thread uses short transactions. |

---

## 9. Success Criteria

1. Workmate unzips to any folder on Windows
2. Double-clicks `start.bat`
3. Browser opens to `http://localhost:8000`
4. Can design templates, upload data, run jobs, download AFP output
5. All data persists between sessions (SQLite + local files)
6. No internet connection required
7. No admin privileges required
8. No software installation required
