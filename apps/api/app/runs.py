from __future__ import annotations

import json
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.aws import get_s3_client, get_sqs_client
from app.db import get_session
from app.models import Job, JobRun


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
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        job = session.get(Job, job_uuid)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")

        job_run = JobRun(job_id=job_uuid, status="QUEUED", progress=0)
        session.add(job_run)
        session.commit()
        session.refresh(job_run)

    queue_url, sqs = get_sqs_client()
    message = {"run_id": str(job_run.id), "job_id": str(job_uuid)}
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))

    return CreateRunResponse(run_id=str(job_run.id))


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run(run_id: str) -> RunStatusResponse:
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid run_id") from exc

    with get_session() as session:
        run = session.get(JobRun, run_uuid)
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
        run_uuid = uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid run_id") from exc

    with get_session() as session:
        run = session.get(JobRun, run_uuid)
        if not run:
            raise HTTPException(status_code=404, detail="run not found")

    bucket, s3 = get_s3_client()
    afp_url = None
    tle_url = None

    if run.output_s3_key:
        afp_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": run.output_s3_key},
            ExpiresIn=3600,
        )

    if run.output_tle_s3_key:
        tle_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": run.output_tle_s3_key},
            ExpiresIn=3600,
        )

    return RunOutputsResponse(afp_url=afp_url, tle_url=tle_url)
