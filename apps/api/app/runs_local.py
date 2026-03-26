"""Local-mode run endpoints (no SQS).

Mirrors runs.py but skips SQS message publishing — the background
worker_thread polls the database for QUEUED rows instead.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db_local import get_session
from app.local_storage import get_download_url
from app.models_local import Job, JobRun

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
    try:
        uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")

        job_run = JobRun(job_id=job_id, status="QUEUED", progress=0)
        session.add(job_run)
        session.commit()
        session.refresh(job_run)
        run_id = job_run.id

    return CreateRunResponse(run_id=run_id)


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run(run_id: str) -> RunStatusResponse:
    try:
        uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid run_id") from exc

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
    try:
        uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid run_id") from exc

    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="run not found")

        afp_url = get_download_url(run.output_s3_key) if run.output_s3_key else None
        tle_url = get_download_url(run.output_tle_s3_key) if run.output_tle_s3_key else None

    return RunOutputsResponse(afp_url=afp_url, tle_url=tle_url)
