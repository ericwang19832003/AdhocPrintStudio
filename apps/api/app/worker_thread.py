"""Background worker thread that polls for QUEUED runs.

Replaces the SQS-based worker with a simple database-polling daemon thread.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from sqlalchemy import select

from app.db_local import get_session
from app.local_storage import save_file
from app.models_local import JobReturnAddress, JobRun, JobTleConfig

logger = logging.getLogger(__name__)

_stop_event = threading.Event()
_thread: threading.Thread | None = None

POLL_INTERVAL_SECONDS = 2


def evaluate_expr(expr: Any) -> str | None:
    """Evaluate a TLE expression to a plain string.

    Supports:
    - ``None`` → ``None``
    - plain ``str`` → returned as-is
    - ``dict`` with ``value``, ``literal``, or ``text`` key → stringified value
    """
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


def _update_run(run_id: str, **fields: Any) -> None:
    """Update a JobRun row with the supplied field values."""
    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            return
        for key, value in fields.items():
            setattr(run, key, value)
        session.commit()


def _process_run(run_id: str, job_id: str) -> None:
    """Process a single queued run."""
    # 1. Mark as RUNNING
    _update_run(run_id, status="RUNNING", progress=10)

    # 2. Read TLE config and return address from DB
    with get_session() as session:
        tle = session.get(JobTleConfig, job_id)
        return_address = session.get(JobReturnAddress, job_id)

    # 3. Evaluate expressions
    name = evaluate_expr(tle.name_expr if tle else None)
    addr1 = evaluate_expr(tle.addr1_expr if tle else None)
    addr2 = evaluate_expr(tle.addr2_expr if tle else None)
    addr3 = evaluate_expr(tle.addr3_expr if tle else None)

    return_addr1 = evaluate_expr(tle.return_addr1_expr if tle else None)
    return_addr2 = evaluate_expr(tle.return_addr2_expr if tle else None)
    return_addr3 = evaluate_expr(tle.return_addr3_expr if tle else None)

    # 4. Fall back to JobReturnAddress if TLE doesn't specify one
    if return_addr1 is None and return_address:
        return_addr1 = return_address.return_addr1
        return_addr2 = return_address.return_addr2
        return_addr3 = return_address.return_addr3

    if not return_addr1:
        _update_run(run_id, status="FAILED", error="Return address missing")
        return

    # 5. Build TLE manifest
    tle_manifest = {
        "Name": name,
        "Address1": addr1,
        "Address2": addr2,
        "Address3": addr3,
        "Return_Addr1": return_addr1,
        "Return_Addr2": return_addr2,
        "Return_Addr3": return_addr3,
    }

    # 6. Generate stub AFP output
    afp_bytes = b"STUB_AFP_OUTPUT"
    tle_bytes = json.dumps(tle_manifest).encode("utf-8")

    output_key = f"outputs/{run_id}.afp"
    output_tle_key = f"outputs/{run_id}.tle.json"

    # 7. Save output files to local storage
    save_file(output_key, afp_bytes)
    save_file(output_tle_key, tle_bytes)

    # 8. Mark SUCCEEDED
    _update_run(
        run_id,
        status="SUCCEEDED",
        progress=100,
        output_s3_key=output_key,
        output_tle_s3_key=output_tle_key,
        error=None,
    )


def _poll_loop() -> None:
    """Continuously poll for QUEUED runs until stop_event is set."""
    logger.info("Worker thread started")
    while not _stop_event.is_set():
        try:
            with get_session() as session:
                queued_runs = (
                    session.execute(
                        select(JobRun).where(JobRun.status == "QUEUED")
                    )
                    .scalars()
                    .all()
                )
                # Materialise run data before closing the session
                run_data = [(r.id, r.job_id) for r in queued_runs]

            for run_id, job_id in run_data:
                if _stop_event.is_set():
                    break
                try:
                    _process_run(run_id, job_id)
                except Exception:
                    logger.exception("Error processing run %s", run_id)
                    try:
                        _update_run(
                            run_id,
                            status="FAILED",
                            error="Internal worker error",
                        )
                    except Exception:
                        logger.exception(
                            "Failed to mark run %s as FAILED", run_id
                        )
        except Exception:
            logger.exception("Error in poll loop")

        _stop_event.wait(timeout=POLL_INTERVAL_SECONDS)
    logger.info("Worker thread stopping")


def start_worker() -> threading.Thread:
    """Start the background poll loop in a daemon thread."""
    global _thread
    _stop_event.clear()
    _thread = threading.Thread(target=_poll_loop, daemon=True, name="worker")
    _thread.start()
    return _thread


def stop_worker() -> None:
    """Signal the worker thread to stop."""
    _stop_event.set()
    if _thread is not None:
        _thread.join(timeout=5)
