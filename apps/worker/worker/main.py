from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

import boto3
from sqlalchemy import select

from worker.afp_convert import convert_image_to_afp, convert_pdf_to_afp
from worker.afp_engine import EngineErrorContext, RealAFPEngine, RunContext, StubAFPEngine
from worker.db import get_session
from worker.env import load_env
from worker.models import Asset, JobReturnAddress, JobRun, JobTleConfig

load_env()


def evaluate_expr(expr: Any) -> str | None:
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


def update_run_status(run_id: uuid.UUID, **fields: Any) -> None:
    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            return
        for key, value in fields.items():
            setattr(run, key, value)
        session.commit()


def _fetch_latest_asset(session, asset_type: str) -> Asset | None:
    return (
        session.execute(
            select(Asset).where(Asset.type == asset_type).order_by(Asset.created_at.desc())
        )
        .scalars()
        .first()
    )


def _fetch_assets(session, asset_type: str) -> list[Asset]:
    return (
        session.execute(
            select(Asset).where(Asset.type == asset_type).order_by(Asset.created_at.asc())
        )
        .scalars()
        .all()
    )


def process_message(body: str, s3_client: boto3.client, bucket: str, engine_name: str) -> None:
    payload = json.loads(body)
    run_id = uuid.UUID(payload["run_id"])
    job_id = uuid.UUID(payload["job_id"])

    with get_session() as session:
        run = session.get(JobRun, run_id)
        if not run:
            return
        if run.status == "CANCELED":
            return
        run.status = "RUNNING"
        run.progress = 10
        session.commit()

        tle = session.get(JobTleConfig, job_id)
        return_address = session.get(JobReturnAddress, job_id)
        logo_asset = _fetch_latest_asset(session, "LOGO")
        append_assets = _fetch_assets(session, "APPEND_PDF")

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
        update_run_status(run_id, status="FAILED", error="Return address missing")
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

    if logo_asset:
        logo_obj = s3_client.get_object(Bucket=bucket, Key=logo_asset.s3_key)
        logo_bytes = logo_obj["Body"].read()
        logo_afp = convert_image_to_afp(logo_bytes, logo_asset.filename)
        s3_client.put_object(
            Bucket=bucket,
            Key=f"outputs/{run_id}/logo.afp",
            Body=logo_afp,
            ContentType="application/octet-stream",
        )

    for index, asset in enumerate(append_assets, start=1):
        pdf_obj = s3_client.get_object(Bucket=bucket, Key=asset.s3_key)
        pdf_bytes = pdf_obj["Body"].read()
        pdf_afp = convert_pdf_to_afp(pdf_bytes, asset.filename)
        s3_client.put_object(
            Bucket=bucket,
            Key=f"outputs/{run_id}/append_{index}.afp",
            Body=pdf_afp,
            ContentType="application/octet-stream",
        )

    engine = StubAFPEngine() if engine_name == "stub" else RealAFPEngine()
    run_context = RunContext(run_id=str(run_id), job_id=str(job_id), tle_manifest=tle_manifest)
    afp_result = engine.generate(run_context)
    afp_bytes = afp_result.read() if hasattr(afp_result, "read") else afp_result

    s3_client.put_object(
        Bucket=bucket,
        Key=output_key,
        Body=afp_bytes,
        ContentType="application/octet-stream",
    )
    s3_client.put_object(
        Bucket=bucket,
        Key=output_tle_key,
        Body=json.dumps(tle_manifest).encode("utf-8"),
        ContentType="application/json",
    )

    update_run_status(
        run_id,
        status="SUCCEEDED",
        progress=100,
        output_s3_key=output_key,
        output_tle_s3_key=output_tle_key,
        error=None,
    )


def run() -> None:
    queue_url = os.getenv("SQS_QUEUE_URL")
    region = os.getenv("AWS_REGION")
    bucket = os.getenv("S3_BUCKET")
    if not queue_url or not region or not bucket:
        print("SQS_QUEUE_URL, AWS_REGION, or S3_BUCKET not set; worker is idle.")
        return

    sqs_client = boto3.client("sqs", region_name=region)
    s3_client = boto3.client("s3", region_name=region)
    engine_name = os.getenv("AFP_ENGINE", "stub")
    while True:
        response = sqs_client.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=20,
            VisibilityTimeout=30,
        )
        for message in response.get("Messages", []):
            receipt_handle = message["ReceiptHandle"]
            try:
                process_message(message.get("Body", ""), s3_client, bucket, engine_name)
            except EngineErrorContext as exc:
                try:
                    body = json.loads(message.get("Body", ""))
                    run_id = uuid.UUID(body["run_id"])
                    update_run_status(run_id, status="FAILED", error=str(exc))
                except Exception:
                    pass
            except Exception as exc:
                try:
                    body = json.loads(message.get("Body", ""))
                    run_id = uuid.UUID(body["run_id"])
                    update_run_status(run_id, status="FAILED", error=str(exc))
                except Exception:
                    pass
            finally:
                sqs_client.delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=receipt_handle,
                )
        time.sleep(1)


if __name__ == "__main__":
    run()
