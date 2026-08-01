"""Tests for runs_local endpoints."""
from __future__ import annotations

import os
import uuid

import pytest


@pytest.fixture
def client(tmp_path):
    os.environ["LOCAL_DATABASE_PATH"] = str(tmp_path / "test.db")
    os.environ["LOCAL_STORAGE_PATH"] = str(tmp_path / "storage")

    from app.db_local import init_db, _reset
    from app.local_storage import _reset as storage_reset

    _reset()
    storage_reset()
    init_db()

    from fastapi import FastAPI
    from app.runs_local import router as runs_router

    test_app = FastAPI()
    test_app.include_router(runs_router)

    from fastapi.testclient import TestClient

    yield TestClient(test_app)

    os.environ.pop("LOCAL_DATABASE_PATH", None)
    os.environ.pop("LOCAL_STORAGE_PATH", None)
    _reset()
    storage_reset()


def _create_job(tmp_path) -> str:  # noqa: ARG001 – tmp_path unused but kept for symmetry
    from app.db_local import get_session
    from app.models_local import TemplateProfile, Job

    tp_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    with get_session() as session:
        tp = TemplateProfile(
            id=tp_id, name="T", version=1, status="ACTIVE", template_s3_key="k"
        )
        session.add(tp)
        session.flush()
        job = Job(id=job_id, name="J", template_profile_id=tp_id)
        session.add(job)
        session.commit()
    return job_id


def test_create_run_sets_queued(client, tmp_path):
    job_id = _create_job(tmp_path)
    resp = client.post(f"/jobs/{job_id}/runs")
    assert resp.status_code == 200
    data = resp.json()
    assert "run_id" in data

    # Verify status via GET
    run_id = data["run_id"]
    resp2 = client.get(f"/runs/{run_id}")
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["status"] == "QUEUED"
    assert body["progress"] == 0


def test_get_run_not_found(client):
    bad_id = str(uuid.uuid4())
    resp = client.get(f"/runs/{bad_id}")
    assert resp.status_code == 404
